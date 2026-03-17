from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
WORK_START_SECONDS   = 7 * 3600   # 7 AM MYT
WORK_END_SECONDS     = 19 * 3600  # 7 PM MYT
SERVICE_TIME_SECONDS = 300        # 5 min per stop
MAX_WAIT_SECONDS     = 3600       # max 1 hour waiting at a stop
SOLVER_TIME_LIMIT    = 300        # 5 min — satisfies NFR <15 min for 500 nodes
# ─────────────────────────────────────────────────────────────────────────────


def parse_time_window(ts: str) -> int:
    """Convert TIMESTAMPTZ or TIME string to seconds from midnight."""
    if not ts:
        return 0
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.hour * 3600 + dt.minute * 60 + dt.second
    except Exception:
        return 0


def _nearest_neighbour_fallback(
    pickups: List[Dict[str, Any]],
    vehicles: List[Dict[str, Any]],
    duration_matrix: List[List[int]],
    distance_matrix: List[List[int]],
    max_shift_hours: float,
) -> List[Dict[str, Any]]:
    """
    Greedy nearest neighbour fallback heuristic.
    Only triggered when OR-Tools finds no solution within SOLVER_TIME_LIMIT.
    Uses duration_matrix (seconds) for time, distance_matrix (metres) for distance.
    """
    logger.warning("OR-Tools found no solution - switching to nearest neighbour fallback")

    max_shift_seconds  = int(max_shift_hours * 3600)
    num_vehicles       = len(vehicles)
    vehicle_capacities = [v.get("capacity_litres") or 500 for v in vehicles]

    unvisited    = list(range(1, len(pickups) + 1))
    routes_stops = [[] for _ in range(num_vehicles)]
    route_dist_m = [0]   * num_vehicles
    route_time_s = [0]   * num_vehicles
    route_volume = [0.0] * num_vehicles
    current_node = [0]   * num_vehicles

    while unvisited:
        assigned_any = False
        for v_idx in range(num_vehicles):
            if not unvisited:
                break
            best_node = None
            best_dist = float("inf")
            for node in unvisited:
                travel_s = duration_matrix[current_node[v_idx]][node]
                dist_m   = distance_matrix[current_node[v_idx]][node]
                vol      = pickups[node - 1].get("estimated_volume") or 0
                new_time = route_time_s[v_idx] + travel_s + SERVICE_TIME_SECONDS
                if route_volume[v_idx] + vol > vehicle_capacities[v_idx]:
                    continue
                if new_time > max_shift_seconds:
                    continue
                if dist_m < best_dist:
                    best_dist = dist_m
                    best_node = node
            if best_node is not None:
                routes_stops[v_idx].append(best_node)
                route_dist_m[v_idx] += distance_matrix[current_node[v_idx]][best_node]
                route_time_s[v_idx] += duration_matrix[current_node[v_idx]][best_node] + SERVICE_TIME_SECONDS
                route_volume[v_idx] += pickups[best_node - 1].get("estimated_volume") or 0
                current_node[v_idx]  = best_node
                unvisited.remove(best_node)
                assigned_any = True
        if not assigned_any:
            logger.warning(f"Fallback: {len(unvisited)} stops could not be assigned")
            break

    results = []
    for v_idx, stop_nodes in enumerate(routes_stops):
        if not stop_nodes:
            continue
        stops = []
        for seq, node in enumerate(stop_nodes, start=1):
            p = pickups[node - 1]
            stops.append({
                "dropoff_id":       p["dropoff_id"],
                "sequence":         seq,
                "user_address":     p.get("user_address", ""),
                "estimated_volume": p.get("estimated_volume", 0),
                "status":           "assigned",
            })
        results.append({
            "driver_id":              vehicles[v_idx]["driver_id"],
            "vehicle_id":             vehicles[v_idx]["vehicle_id"],
            "depot_id":               vehicles[v_idx]["depot_id"],
            "stops":                  stops,
            "total_distance_km":      round(route_dist_m[v_idx] / 1000, 2),
            "estimated_duration_min": round(route_time_s[v_idx] / 60),
            "total_stops":            len(stops),
            "solution_type":          "fallback_heuristic",
        })

    logger.info(
        f"Fallback complete: {len(results)} routes, "
        f"{sum(len(r['stops']) for r in results)} assigned"
    )
    return results


def solve_cvrptw(
    pickups: List[Dict[str, Any]],
    vehicles: List[Dict[str, Any]],
    duration_matrix: List[List[int]],
    distance_matrix: List[List[int]],
    max_shift_hours: float = 10.0,
    min_stops_per_vehicle: int = 0,
) -> List[Dict[str, Any]]:
    """
    Solve CVRPTW using Google OR-Tools.
    Constraints: capacity, time windows, max shift duration.
    All stops are mandatory - falls back to nearest neighbour if OR-Tools times out.
    """
    num_vehicles = len(vehicles)
    num_pickups  = len(pickups)

    if num_pickups == 0 or num_vehicles == 0:
        logger.warning("No pickups or vehicles — skipping solver")
        return []

    max_shift_seconds = int(max_shift_hours * 3600)
    logger.info(
        f"Solver: {num_pickups} pickups, {num_vehicles} vehicles, "
        f"max_shift={max_shift_hours}h, time_limit={SOLVER_TIME_LIMIT}s"
    )

    # Capacity demands (×10 for integer arithmetic)
    demands = [0]
    for p in pickups:
        demands.append(int((p.get("estimated_volume") or 0) * 10))

    vehicle_capacities = [
        int((v.get("capacity_litres") or 500) * 10)
        for v in vehicles
    ]

    # Time windows in seconds from midnight
    time_windows = [(WORK_START_SECONDS, WORK_END_SECONDS)]  # depot
    for p in pickups:
        start = parse_time_window(p.get("time_window_start"))
        end   = parse_time_window(p.get("time_window_end"))
        start = max(start, WORK_START_SECONDS) if start > 0 else WORK_START_SECONDS
        end   = min(end,   WORK_END_SECONDS)   if end   > 0 else WORK_END_SECONDS
        if end <= start:
            end = WORK_END_SECONDS
        time_windows.append((start, end))

    # ── OR-Tools setup ────────────────────────────────────────────────────────
    manager = pywrapcp.RoutingIndexManager(len(duration_matrix), num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node   = manager.IndexToNode(to_index)
        travel    = duration_matrix[from_node][to_node]
        service   = SERVICE_TIME_SECONDS if from_node != 0 else 0
        return travel + service

    time_callback_index = routing.RegisterTransitCallback(time_callback)

    # ── Capacity dimension ────────────────────────────────────────────────────
    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index, 0, vehicle_capacities, True, "Capacity"
    )

    # ── Time window + max shift dimension ─────────────────────────────────────
    routing.AddDimension(time_callback_index, MAX_WAIT_SECONDS, WORK_END_SECONDS, False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")

    for location_idx, (tw_start, tw_end) in enumerate(time_windows):
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(tw_start, tw_end)

    for v_idx in range(num_vehicles):
        time_dimension.CumulVar(routing.Start(v_idx)).SetRange(
            WORK_START_SECONDS, WORK_START_SECONDS
        )
        time_dimension.CumulVar(routing.End(v_idx)).SetRange(
            WORK_START_SECONDS, WORK_START_SECONDS + max_shift_seconds
        )

    # ── Constraint 1: each pickup must be visited exactly once (hard) ─────────
    # No AddDisjunction — OR-Tools treats all nodes as mandatory by default

    # ── Min stops per vehicle (optional even distribution) ────────────────────
    if min_stops_per_vehicle > 0:
        counter_callback_index = routing.RegisterUnaryTransitCallback(
            lambda from_index: 1 if manager.IndexToNode(from_index) != 0 else 0
        )
        routing.AddDimensionWithVehicleCapacity(
            counter_callback_index, 0, [num_pickups] * num_vehicles, True, "StopCount"
        )
        stop_count_dim = routing.GetDimensionOrDie("StopCount")
        for v_idx in range(num_vehicles):
            stop_count_dim.CumulVar(routing.End(v_idx)).SetMin(min_stops_per_vehicle)

    # ── Search parameters ─────────────────────────────────────────────────────
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = SOLVER_TIME_LIMIT

    logger.info(f"OR-Tools solving (time limit: {SOLVER_TIME_LIMIT}s)...")
    solution = routing.SolveWithParameters(search_params)

    # ── Fallback if OR-Tools finds no solution ────────────────────────────────
    if not solution:
        logger.error(f"OR-Tools found no solution within {SOLVER_TIME_LIMIT}s")
        return _nearest_neighbour_fallback(
            pickups, vehicles, duration_matrix, distance_matrix, max_shift_hours
        )

    # ── Extract routes ────────────────────────────────────────────────────────
    results = []
    for vehicle_idx in range(num_vehicles):
        index            = routing.Start(vehicle_idx)
        stops            = []
        total_distance_m = 0
        total_duration_s = 0
        sequence         = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                pickup = pickups[node - 1]
                sequence += 1
                stops.append({
                    "dropoff_id":       pickup["dropoff_id"],
                    "sequence":         sequence,
                    "user_address":     pickup.get("user_address", ""),
                    "estimated_volume": pickup.get("estimated_volume", 0),
                    "status":           "assigned",
                })
            next_index        = solution.Value(routing.NextVar(index))
            from_node         = manager.IndexToNode(index)
            to_node           = manager.IndexToNode(next_index)
            total_distance_m += distance_matrix[from_node][to_node]
            total_duration_s += duration_matrix[from_node][to_node]
            index             = next_index

        if not stops:
            continue

        total_duration_s += len(stops) * SERVICE_TIME_SECONDS
        results.append({
            "driver_id":              vehicles[vehicle_idx]["driver_id"],
            "vehicle_id":             vehicles[vehicle_idx]["vehicle_id"],
            "depot_id":               vehicles[vehicle_idx]["depot_id"],
            "stops":                  stops,
            "total_distance_km":      round(total_distance_m / 1000, 2),
            "estimated_duration_min": round(total_duration_s / 60),
            "total_stops":            len(stops),
            "solution_type":          "ortools",
        })

    logger.info(
        f"OR-Tools complete: {len(results)} routes, "
        f"{sum(r['total_stops'] for r in results)} assigned"
    )
    return results
