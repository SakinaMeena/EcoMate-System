import logging
from datetime import datetime
from supabase import create_client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Depot → State mapping ─────────────────────────────────────────────────────
# Derived from depot_id prefix since depots table has no state column.
# Future improvement: derive from users.state_assigned instead.
DEPOT_STATE_MAP = {
    "DEP-SEL-01": "Selangor",
    "DEP-KUL-01": "Kuala Lumpur",
    "DEP-PJY-01": "Putrajaya",
    "DEP-PNG-01": "Pulau Pinang",
    "DEP-JHR-01": "Johor",
    "DEP-PRK-01": "Perak",
    "DEP-NS-01":  "Negeri Sembilan",
    "DEP-MLK-01": "Melaka",
    "DEP-PHG-01": "Pahang",
    "DEP-KDH-01": "Kedah",
    "DEP-KTN-01": "Kelantan",
    "DEP-TRG-01": "Terengganu",
    "DEP-SBH-01": "Sabah",
    "DEP-SWK-01": "Sarawak",
    "DEP-PLS-01": "Perlis",
    "DEP-LBN-01": "Labuan",
}


# ── Status promotion ──────────────────────────────────────────────────────────

def promote_pending_pickups(target_date: str) -> None:
    """
    Promote pending home pickups to scheduled for the target date.
    Called at the start of optimization before fetching pickups.
    Ensures pickups scheduled for today are visible to the optimizer.
    """
    response = supabase.table("dropoffs") \
        .update({"status": "scheduled", "updated_at": datetime.utcnow().isoformat()}) \
        .eq("dropoff_type", "home_pickup") \
        .eq("status", "pending") \
        .eq("scheduled_for", target_date) \
        .execute()
    count = len(response.data or [])
    logger.info(f"Promoted {count} pending pickups to scheduled for {target_date}")


# ── Multi-depot fetch functions ───────────────────────────────────────────────

def fetch_active_depots() -> List[Dict[str, Any]]:
    """
    Fetch all active depots.
    State is derived from depot_id using DEPOT_STATE_MAP since the
    depots table has no state column. Depots not in the map are skipped.
    """
    response = supabase.table("depots") \
        .select("depot_id, name, latitude, longitude") \
        .execute()

    depots = []
    for d in (response.data or []):
        state = DEPOT_STATE_MAP.get(d["depot_id"])
        if not state:
            logger.warning(f"depot_id {d['depot_id']} not found in DEPOT_STATE_MAP — skipping")
            continue
        depots.append({**d, "state": state})

    return depots


def fetch_scheduled_pickups_by_depot(depot_id: str, target_date: str) -> List[Dict[str, Any]]:
    """
    Fetch scheduled home pickups for a specific depot on the target date.
    Pickups are pre-assigned to depots via the auto_assign_depot trigger.
    """
    response = supabase.table("dropoffs") \
        .select(
            "dropoff_id, user_id, user_lat, user_lon, user_address, "
            "estimated_volume, time_window_start, time_window_end, depot_id"
        ) \
        .eq("dropoff_type", "home_pickup") \
        .eq("status", "scheduled") \
        .eq("depot_id", depot_id) \
        .eq("scheduled_for", target_date) \
        .execute()
    return response.data or []

def fetch_available_vehicles_by_depot(depot_id: str) -> List[Dict[str, Any]]:
    # 1. Fetch all available vehicles once
    vehicles_resp = supabase.table("vehicles") \
        .select("vehicle_id, driver_id, capacity_litres, license_plate, status") \
        .eq("status", "available") \
        .execute()
    all_vehicles = vehicles_resp.data or []

    # 2. Fetch all drivers for this depot in one query
    drivers_resp = supabase.table("users") \
        .select("user_id, name, depot_id") \
        .eq("depot_id", depot_id) \
        .eq("role", "driver") \
        .execute()
    
    # Build a lookup dict: user_id -> driver record
    driver_map = {d["user_id"]: d for d in (drivers_resp.data or [])}

    # 3. Fetch depot once
    depot_resp = supabase.table("depots") \
        .select("depot_id, latitude, longitude, name") \
        .eq("depot_id", depot_id) \
        .execute()
    depot_data = depot_resp.data[0] if depot_resp.data else None
    if not depot_data:
        return []

    # 4. Join in memory — no more per-vehicle queries
    enriched = []
    for v in all_vehicles:
        driver_data = driver_map.get(v["driver_id"])
        if not driver_data:
            continue
        enriched.append({
            "vehicle_id":      v["vehicle_id"],
            "driver_id":       v["driver_id"],
            "license_plate":   v["license_plate"],
            "status":          v["status"],
            "capacity_liters": float(v["capacity_litres"]),
            "driver_name":     driver_data["name"],
            "depot_id":        depot_id,
            "depot_lat":       float(depot_data["latitude"]),
            "depot_lon":       float(depot_data["longitude"]),
            "depot_name":      depot_data["name"],
        })

    return enriched


# ── Save routes ───────────────────────────────────────────────────────────────

def save_routes(routes: List[Dict[str, Any]], target_date: str) -> bool:
    """
    Save optimized routes to the routes table.
    Bulk update all assigned dropoffs per route in a single PATCH request
    using the `in` filter — reduces N individual requests to 1 per route.
    """
    try:
        for route in routes:
            route_row = {
                "collector_id":           route["driver_id"],
                "route_date":             target_date,
                "estimated_duration_min": route["estimated_duration_min"],
                "total_distance_km":      route["total_distance_km"],
                "status":                 "planned",
                "stops":                  route["stops"],
            }
            result   = supabase.table("routes").insert(route_row).execute()
            route_id = result.data[0]["route_id"]

            # Bulk update — one PATCH for all stops in this route
            dropoff_ids = [stop["dropoff_id"] for stop in route["stops"]]
            logger.info(f"Bulk updating {len(dropoff_ids)} dropoffs for route {route_id}")
            supabase.table("dropoffs").update({
                "status":       "assigned",
                "collector_id": route["driver_id"],
                "route_id":     route_id,
            }).in_("dropoff_id", dropoff_ids).execute()

        return True
    except Exception as e:
        logger.error(f"Error saving routes: {e}")
        return False


# ── Flag unassigned ───────────────────────────────────────────────────────────

def flag_unassigned_pickups(unassigned_pickups: List[Dict[str, Any]]) -> None:
    """
    Flag pickups that could not be assigned after all retries.
    Sets status back to pending so they are picked up in the next optimization run.
    """
    for pickup in unassigned_pickups:
        try:
            supabase.table("dropoffs").update({
                "status":       "pending",
                "collector_id": None,
            }).eq("dropoff_id", pickup["dropoff_id"]).execute()
        except Exception as e:
            logger.error(f"Failed to flag unassigned pickup {pickup['dropoff_id']}: {e}")

    logger.warning(f"Flagged {len(unassigned_pickups)} pickups as pending for next run")
    