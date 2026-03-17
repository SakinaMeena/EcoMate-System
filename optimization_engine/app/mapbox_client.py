import httpx
import math
from app.config import MAPBOX_TOKEN
from typing import List, Tuple


async def get_travel_matrix(
    coordinates: List[Tuple[float, float]]
) -> Tuple[List[List[int]], List[List[int]]]:
    """
    Get travel time (seconds) and distance (metres) matrices from Mapbox.
    coordinates: list of (longitude, latitude) tuples.
    Mapbox Matrix API supports max 25 coordinates.
    """
    if not MAPBOX_TOKEN:
        raise ValueError("MAPBOX_ACCESS_TOKEN not set")

    n = len(coordinates)

    if n > 25:
        raise ValueError(f"Too many coordinates ({n}) for single Mapbox request — use fallback")

    coords_str = ";".join([f"{lon},{lat}" for lon, lat in coordinates])
    url = (
        f"https://api.mapbox.com/directions-matrix/v1/mapbox/driving/{coords_str}"
        f"?annotations=duration,distance&access_token={MAPBOX_TOKEN}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    max_penalty = 99999
    raw_durations = data.get("durations", [])
    raw_distances = data.get("distances", [])

    durations = [
        [int(v) if v is not None else max_penalty for v in row]
        for row in raw_durations
    ]
    distances = [
        [int(v) if v is not None else max_penalty for v in row]
        for row in raw_distances
    ]

    return durations, distances


def build_fallback_matrix(
    coordinates: List[Tuple[float, float]]
) -> Tuple[List[List[int]], List[List[int]]]:
    """
    Haversine fallback matrix when Mapbox is unavailable or >25 coords.
    Returns approximate durations (seconds) and distances (metres).
    """
    n = len(coordinates)
    distances = [[0] * n for _ in range(n)]
    durations  = [[0] * n for _ in range(n)]
    avg_speed_ms = 10  # ~36 km/h urban average

    for i in range(n):
        for j in range(n):
            if i != j:
                lon1, lat1 = coordinates[i]
                lon2, lat2 = coordinates[j]
                dist = _haversine(lon1, lat1, lon2, lat2)
                distances[i][j] = int(dist)
                durations[i][j]  = int(dist / avg_speed_ms)

    return durations, distances


def _haversine(lon1, lat1, lon2, lat2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi       = math.radians(lat2 - lat1)
    dlambda    = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))
