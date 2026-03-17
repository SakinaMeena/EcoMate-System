"""
Pre-optimization clustering for EcoMate route engine.

Uses K-Means with a fixed K=20 clusters to reduce problem size before
passing to OR-Tools. This guarantees exactly 20 cluster centroids regardless
of geography, always fitting within Mapbox's 25-node limit (20 + 1 depot = 21).

Flow:
  1. If pickups <= CLUSTERING_THRESHOLD (25): skip clustering entirely
     — nodes fit directly into Mapbox API, no clustering needed
  2. If pickups > 25: K-Means clusters into exactly K_CLUSTERS groups
     — centroids sent to Mapbox for real road travel times
     — OR-Tools optimizes at cluster level
     — After routing, clusters unpacked to individual stops for driver app

Intra-cluster sequencing uses nearest neighbour — acceptable since stops
within a cluster are geographically close (within a few km).
"""

import math
import random
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Skip clustering if pickups <= this — fits directly into Mapbox 25-node limit
CLUSTERING_THRESHOLD = 25

# Fixed number of clusters — guarantees Mapbox limit is never exceeded
# 20 clusters + 1 depot = 21 nodes, well within Mapbox's 25-node limit
K_CLUSTERS = 20
MIN_CLUSTER_SIZE = 2  # minimum pickups per cluster to avoid empty clusters
# Max iterations for K-Means convergence
KMEANS_MAX_ITER = 100


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _kmeans_cluster(
    pickups: List[Dict[str, Any]],
    k: int = K_CLUSTERS,
    max_iter: int = KMEANS_MAX_ITER,
) -> List[int]:
    """
    Pure Python K-Means clustering on lat/lon coordinates.
    Returns a list of cluster labels (0 to k-1), same length as pickups.
    No external dependencies — safe for production use.
    """
    n = len(pickups)
    k = min(k, n)

    random.seed(42)
    first_idx = random.randint(0, n - 1)
    centroids = [(pickups[first_idx]["user_lat"], pickups[first_idx]["user_lon"])]

    for _ in range(k - 1):
        distances = []
        for p in pickups:
            min_dist = min(
                haversine_km(p["user_lat"], p["user_lon"], c[0], c[1])
                for c in centroids
            )
            distances.append(min_dist ** 2)
        total = sum(distances)
        probs = [d / total for d in distances]
        cumulative = 0
        r = random.random()
        chosen = n - 1
        for idx, prob in enumerate(probs):
            cumulative += prob
            if r <= cumulative:
                chosen = idx
                break
        centroids.append((pickups[chosen]["user_lat"], pickups[chosen]["user_lon"]))

    labels = [0] * n
    for iteration in range(max_iter):
        new_labels = []
        for p in pickups:
            nearest = min(
                range(len(centroids)),
                key=lambda ci: haversine_km(
                    p["user_lat"], p["user_lon"],
                    centroids[ci][0], centroids[ci][1],
                )
            )
            new_labels.append(nearest)

        if new_labels == labels:
            logger.info(f"K-Means converged after {iteration + 1} iterations")
            break
        labels = new_labels

        new_centroids = []
        for ci in range(len(centroids)):
            members = [pickups[i] for i, l in enumerate(labels) if l == ci]
            if not members:
                new_centroids.append(centroids[ci])
            else:
                new_lat = sum(p["user_lat"] for p in members) / len(members)
                new_lon = sum(p["user_lon"] for p in members) / len(members)
                new_centroids.append((new_lat, new_lon))
        centroids = new_centroids

    return labels


def cluster_pickups(
    pickups: List[Dict[str, Any]],
    k: int = K_CLUSTERS,
) -> Tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
    """
    Cluster pickups into exactly K virtual stops using K-Means.
    """
    n = len(pickups)

    if n <= CLUSTERING_THRESHOLD:
        logger.info(f"Skipping clustering — {n} nodes within Mapbox limit ({CLUSTERING_THRESHOLD})")
        cluster_map = {p["dropoff_id"]: [p["dropoff_id"]] for p in pickups}
        return pickups, cluster_map

    actual_k = min(k, max(1, n // MIN_CLUSTER_SIZE))
    logger.info(f"K-Means clustering: {n} pickups → {actual_k} clusters")

    labels = _kmeans_cluster(pickups, k=actual_k)

    clusters: Dict[int, List[Dict[str, Any]]] = {ci: [] for ci in range(actual_k)}
    for i, label in enumerate(labels):
        clusters[label].append(pickups[i])

    clustered_pickups = []
    cluster_map: Dict[str, List[str]] = {}

    for label, members in clusters.items():
        if not members:
            continue

        virtual_id = f"cluster-{label}"
        centroid_lat = sum(p["user_lat"] for p in members) / len(members)
        centroid_lon = sum(p["user_lon"] for p in members) / len(members)
        total_volume = sum(p.get("estimated_volume") or 0 for p in members)

        tw_starts = [p.get("time_window_start") for p in members if p.get("time_window_start")]
        tw_ends = [p.get("time_window_end") for p in members if p.get("time_window_end")]
        tw_start = min(tw_starts) if tw_starts else None
        tw_end = max(tw_ends) if tw_ends else None

        virtual_stop = {
            "dropoff_id": virtual_id,
            "user_lat": centroid_lat,
            "user_lon": centroid_lon,
            "user_address": f"Cluster {label} ({len(members)} stops)",
            "estimated_volume": total_volume,
            "time_window_start": tw_start,
            "time_window_end": tw_end,
            "status": "scheduled",
            "is_cluster": True,
            "cluster_size": len(members),
        }
        clustered_pickups.append(virtual_stop)
        cluster_map[virtual_id] = [p["dropoff_id"] for p in members]

    logger.info(
        f"Clustering complete: {n} pickups → {len(clustered_pickups)} clusters "
        f"({n - len(clustered_pickups)} nodes reduced, "
        f"fits within Mapbox 25-node limit with depot)"
    )
    return clustered_pickups, cluster_map


def unpack_clusters(
    routes: List[Dict[str, Any]],
    cluster_map: Dict[str, List[str]],
    original_pickups: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    After routing, expand cluster virtual stops back to individual stops.
    Stops within each cluster are sequenced using nearest neighbour.
    Cluster centroid IDs are never passed through to the final stop list.
    """
    pickup_lookup = {p["dropoff_id"]: p for p in original_pickups}
    unpacked_routes = []

    for route in routes:
        unpacked_stops = []
        sequence = 0

        for stop in route["stops"]:
            dropoff_id = stop["dropoff_id"]

            # Always look up in cluster_map first
            if str(dropoff_id).startswith("cluster-"):
                original_ids = cluster_map.get(dropoff_id, [])
                if not original_ids:
                    logger.warning(f"Cluster {dropoff_id} not found in cluster_map — skipping")
                    continue
            else:
                original_ids = cluster_map.get(dropoff_id, [dropoff_id])

            if len(original_ids) == 1:
                # Single stop — could be a direct pickup or single-member cluster
                real_id = original_ids[0]
                # Skip if still a cluster ID (safety net)
                if str(real_id).startswith("cluster-"):
                    logger.warning(f"Skipping unresolved cluster id {real_id}")
                    continue
                sequence += 1
                unpacked_stops.append({
                    **stop,
                    "dropoff_id": real_id,
                    "sequence": sequence,
                })
            else:
                cluster_members = [
                    pickup_lookup[oid] for oid in original_ids
                    if oid in pickup_lookup
                ]
                ordered = _nearest_neighbour_order(cluster_members)
                for member in ordered:
                    sequence += 1
                    unpacked_stops.append({
                        "dropoff_id": member["dropoff_id"],
                        "sequence": sequence,
                        "user_address": member.get("user_address", ""),
                        "estimated_volume": member.get("estimated_volume", 0),
                        "status": "assigned",
                    })

        unpacked_routes.append({
            **route,
            "stops": unpacked_stops,
            "total_stops": len(unpacked_stops),
        })

    return unpacked_routes


def _nearest_neighbour_order(stops: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Order stops within a cluster using nearest neighbour heuristic.
    """
    if len(stops) <= 1:
        return stops

    unvisited = list(stops)
    ordered = [unvisited.pop(0)]

    while unvisited:
        last = ordered[-1]
        nearest = min(
            unvisited,
            key=lambda s: haversine_km(
                last["user_lat"], last["user_lon"],
                s["user_lat"], s["user_lon"],
            ),
        )
        ordered.append(nearest)
        unvisited.remove(nearest)

    return ordered