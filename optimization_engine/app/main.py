from fastapi import FastAPI, HTTPException, BackgroundTasks
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.executors.asyncio import AsyncIOExecutor
from pydantic import BaseModel
from datetime import date, timedelta, datetime
from typing import Dict, Any, List, Optional
import asyncio
import functools
import logging
import time


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

from app.config import CRON_HOUR, CRON_MINUTE, USE_MOCK_DATA
from app.mapbox_client import get_travel_matrix, build_fallback_matrix

_last_run: Dict[str, Any] = {
    "time": None,
    "duration_seconds": None,
    "status": None,             # "running" | "success" | "error"
    "states_total": None,
    "states_completed": [],     # live progress — states finished so far
    "states_optimized": None,
    "total_routes": None,
    "total_assigned": None,
    "total_unassigned": None,
    "result": None,
}

app = FastAPI(
    title="EcoMate Optimization Engine",
    description="CVRPTW route optimization for UCO home pickups — multi-depot, all Malaysian states",
    version="2.0.0",
)

# Use AsyncIOExecutor so jobs run as coroutines directly in the event loop —
# no thread bridging, no "no running event loop" errors.
scheduler = AsyncIOScheduler(
    executors={"default": AsyncIOExecutor()},
    timezone="Asia/Kuala_Lumpur",
)


class OptimizeRequest(BaseModel):
    target_date: str = None
    num_pickups: int = 500
    num_vehicles: int = 10
    max_shift_hours: float = 10.0
    min_stops_per_vehicle: int = 0
    retry_shift_hours: float = 11.0
    max_retries: int = 2
    state: str = None


class OptimizeStateRequest(BaseModel):
    target_date: str = None
    state: str
    num_pickups: int = 500
    num_vehicles: int = 10
    max_shift_hours: float = 10.0
    min_stops_per_vehicle: int = 0
    retry_shift_hours: float = 11.0
    max_retries: int = 2


async def _solve(pickups, vehicles, duration_matrix, distance_matrix, max_shift_hours, min_stops_per_vehicle):
    """
    Run OR-Tools solver in a thread executor so it does not block the
    event loop — allows /health polling and parallel state execution.
    """
    from app.solver import solve_cvrptw
    loop = asyncio.get_event_loop()
    routes = await loop.run_in_executor(
        None,
        functools.partial(
            solve_cvrptw,
            pickups, vehicles, duration_matrix, distance_matrix,
            max_shift_hours=max_shift_hours,
            min_stops_per_vehicle=min_stops_per_vehicle,
        )
    )
    total_assigned = sum(len(r["stops"]) for r in routes)
    unassigned = len(pickups) - total_assigned
    return routes, unassigned


async def optimize_single_state(
    state: str,
    target_date: str,
    pickups: List[Dict],
    vehicles: List[Dict],
    max_shift_hours: float = 10.0,
    min_stops_per_vehicle: int = 0,
    retry_shift_hours: float = 11.0,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Optimize routes for a single state depot.
    K-Means clusters pickups to fit within Mapbox 25-node limit,
    getting real road travel times instead of haversine approximations.
    OR-Tools runs in a thread executor — non-blocking.
    """
    logger.info(f"  [{state}] Starting — {len(pickups)} pickups, {len(vehicles)} vehicles")

    if not pickups:
        return {"state": state, "status": "skipped", "reason": "no pickups"}
    if not vehicles:
        return {"state": state, "status": "skipped", "reason": "no vehicles"}

    depot = vehicles[0]
    original_pickups = pickups
    clustering_used = False
    cluster_map = None

    # ── K-Means clustering to fit within Mapbox 25-node limit ──────────────
    from app.clustering import cluster_pickups, unpack_clusters, CLUSTERING_THRESHOLD
    if len(pickups) > CLUSTERING_THRESHOLD:
        pickups, cluster_map = cluster_pickups(pickups)
        clustering_used = True
        logger.info(f"  [{state}] K-Means: {len(original_pickups)} pickups → {len(pickups)} clusters")

    # ── Build coordinate list: depot first, then pickups/centroids ──────────
    coords = [(depot["depot_lon"], depot["depot_lat"])]
    for p in pickups:
        coords.append((float(p["user_lon"]), float(p["user_lat"])))

    # ── Travel matrix: Mapbox (real road times) or haversine fallback ───────
    from app.config import USE_MAPBOX
    if USE_MAPBOX:
        try:
            if len(coords) > 25:
                raise ValueError(f"{len(coords)} nodes exceeds Mapbox 25-node limit")
            duration_matrix, distance_matrix = await get_travel_matrix(coords)
            logger.info(f"  [{state}] Mapbox travel matrix — {len(coords)} nodes")
        except Exception as e:
            logger.warning(f"  [{state}] Mapbox unavailable ({e}) — haversine fallback")
            duration_matrix, distance_matrix = build_fallback_matrix(coords)
    else:
        logger.info(f"  [{state}] Skipping Mapbox — using haversine fallback")
        duration_matrix, distance_matrix = build_fallback_matrix(coords)

    # ── First solve attempt ─────────────────────────────────────────────────
    routes, unassigned = await _solve(
        pickups, vehicles, duration_matrix, distance_matrix,
        max_shift_hours, min_stops_per_vehicle,
    )
    logger.info(f"  [{state}] Attempt 1: {len(routes)} routes, {unassigned} unassigned")

    # ── Retry with relaxed shift hours if needed ────────────────────────────
    retry_count = 0
    current_shift = max_shift_hours

    while unassigned > 0 and retry_count < max_retries:
        retry_count += 1
        current_shift = min(retry_shift_hours + (retry_count - 1), 12.0)
        logger.warning(f"  [{state}] Retry {retry_count}: shift={current_shift}h")
        routes, unassigned = await _solve(
            pickups, vehicles, duration_matrix, distance_matrix,
            current_shift, min_stops_per_vehicle,
        )
        logger.info(f"  [{state}] Retry {retry_count}: {len(routes)} routes, {unassigned} unassigned")

    # ── Unpack clusters back to individual stops for driver app ─────────────
    if clustering_used and cluster_map and routes:
        routes = unpack_clusters(routes, cluster_map, original_pickups)
        logger.info(f"  [{state}] Clusters unpacked — {sum(len(r['stops']) for r in routes)} individual stops")

    # ── Flag unassigned for next day (live mode only) ───────────────────────
    if unassigned > 0 and not USE_MOCK_DATA:
        assigned_ids = {stop["dropoff_id"] for r in routes for stop in r["stops"]}
        still_unassigned = [p for p in original_pickups if p["dropoff_id"] not in assigned_ids]
        from app.supabase_client import flag_unassigned_pickups
        flag_unassigned_pickups(still_unassigned)
        logger.warning(f"  [{state}] {len(still_unassigned)} stops flagged for next day")

    # ── Save routes to Supabase (live mode only) ────────────────────────────
    if not USE_MOCK_DATA and routes:
        from app.supabase_client import save_routes
        save_routes(routes, target_date)
        logger.info(f"  [{state}] Saved {len(routes)} routes to Supabase")

    total_assigned = sum(len(r["stops"]) for r in routes)
    solution_types = list({r.get("solution_type", "ortools") for r in routes})

    logger.info(f"  [{state}] Done: {len(routes)} routes, {total_assigned}/{len(original_pickups)} assigned")

    return {
        "state": state,
        "depot_id": depot["depot_id"],
        "status": "success",
        "solver_settings": {
            "initial_max_shift_hours": max_shift_hours,
            "final_max_shift_hours": current_shift,
            "retries_used": retry_count,
            "clustering_used": clustering_used,
            "solution_type": solution_types[0] if len(solution_types) == 1 else solution_types,
        },
        "routes_generated": len(routes),
        "pickups_total": len(original_pickups),
        "pickups_assigned": total_assigned,
        "pickups_unassigned": unassigned,
        "route_summaries": [
            {
                "driver_id": r["driver_id"],
                "stops": r["total_stops"],
                "distance_km": r["total_distance_km"],
                "estimated_duration_min": r["estimated_duration_min"],
            }
            for r in routes
        ],
    }


async def run_optimization(
    target_date: str = None,
    num_pickups: int = 500,
    num_vehicles: int = 10,
    max_shift_hours: float = 10.0,
    min_stops_per_vehicle: int = 0,
    retry_shift_hours: float = 11.0,
    max_retries: int = 2,
    state_filter: str = None,
) -> Dict[str, Any]:
    """
    Run optimization for all 16 states in parallel using asyncio.gather.
    Each state runs independently and simultaneously — total time equals
    the slowest single state (~5-10 min) rather than sum of all states (~80 min).
    target_date defaults to tomorrow when called from the cron scheduler.
    """
    # Default to tomorrow when triggered by cron (no date passed)
    if target_date is None:
        target_date = str(date.today() + timedelta(days=1))

    global _last_run
    mode = "mock" if USE_MOCK_DATA else "live"
    logger.info(
        f"===== Optimization started | date={target_date} | mode={mode} | "
        f"states={'all' if not state_filter else state_filter} ====="
    )
    run_start_time = time.time()

    try:
        # ── Fetch data per state ────────────────────────────────────────────
        if USE_MOCK_DATA:
            from app.mock_data import generate_mock_pickups, generate_mock_vehicles, DEPOTS
            states_to_run = [state_filter] if state_filter else list(DEPOTS.keys())
            state_data = {
                state: {
                    "pickups": generate_mock_pickups(num_pickups if num_pickups != 500 else None, state),
                    "vehicles": generate_mock_vehicles(num_vehicles if num_vehicles != 10 else None, state),
                }
                for state in states_to_run
            }
        else:
            from app.supabase_client import fetch_scheduled_pickups_by_depot, fetch_available_vehicles_by_depot, fetch_active_depots, promote_pending_pickups
            promote_pending_pickups(target_date)
            depots = fetch_active_depots()
            if state_filter:
                depots = [d for d in depots if d["state"] == state_filter]
            state_data = {
                d["state"]: {
                    "pickups": fetch_scheduled_pickups_by_depot(d["depot_id"], target_date),
                    "vehicles": fetch_available_vehicles_by_depot(d["depot_id"]),
                }
                for d in depots
            }

        # ── Mark optimization as running ────────────────────────────────────
        _last_run.update({
            "time": datetime.now().isoformat(),
            "status": "running",
            "states_total": len(state_data),
            "states_completed": [],
            "states_optimized": 0,
            "total_routes": 0,
            "total_assigned": 0,
            "total_unassigned": 0,
            "result": None,
        })

        # ── Build per-state coroutines with progress tracking ───────────────
        async def run_state_with_progress(state, data):
            result = await optimize_single_state(
                state=state,
                target_date=target_date,
                pickups=data["pickups"],
                vehicles=data["vehicles"],
                max_shift_hours=max_shift_hours,
                min_stops_per_vehicle=min_stops_per_vehicle,
                retry_shift_hours=retry_shift_hours,
                max_retries=max_retries,
            )
            _last_run["states_completed"].append(state)
            _last_run["states_optimized"] = len(_last_run["states_completed"])
            _last_run["total_routes"] = (_last_run["total_routes"] or 0) + result.get("routes_generated", 0)
            _last_run["total_assigned"] = (_last_run["total_assigned"] or 0) + result.get("pickups_assigned", 0)
            _last_run["total_unassigned"] = (_last_run["total_unassigned"] or 0) + result.get("pickups_unassigned", 0)
            logger.info(
                f"  Progress: {len(_last_run['states_completed'])}/{len(state_data)} states done "
                f"({state} just completed)"
            )
            return result

        # ── Run all states in parallel ──────────────────────────────────────
        logger.info(f"Running {len(state_data)} states in parallel with asyncio.gather...")
        state_results = await asyncio.gather(
            *[run_state_with_progress(state, data) for state, data in state_data.items()],
            return_exceptions=False,
        )

        # ── Aggregate final totals ──────────────────────────────────────────
        total_routes     = sum(r.get("routes_generated", 0) for r in state_results)
        total_assigned   = sum(r.get("pickups_assigned", 0) for r in state_results)
        total_unassigned = sum(r.get("pickups_unassigned", 0) for r in state_results)
        total_pickups    = sum(r.get("pickups_total", 0) for r in state_results)
        states_success   = [r["state"] for r in state_results if r.get("status") == "success"]
        states_skipped   = [r["state"] for r in state_results if r.get("status") == "skipped"]

        final_result = {
            "status": "success",
            "mode": mode,
            "target_date": target_date,
            "summary": {
                "states_optimized": len(states_success),
                "states_skipped": len(states_skipped),
                "total_routes": total_routes,
                "total_pickups": total_pickups,
                "total_assigned": total_assigned,
                "total_unassigned": total_unassigned,
            },
            "states": list(state_results),
        }

        _last_run.update({
            "status": "success",
            "duration_seconds": round(time.time() - run_start_time, 2),
            "result": final_result,
        })

        logger.info(
            f"===== All states done: {len(states_success)} optimized | "
            f"{total_assigned}/{total_pickups} assigned | "
            f"{total_unassigned} unassigned ====="
        )
        return final_result

    except Exception as e:
        logger.exception(f"Optimization failed: {e}")
        _last_run.update({"status": "error", "duration_seconds": round(time.time() - run_start_time, 2), "result": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def start_scheduler():
    # Pass run_optimization directly as an async function.
    # AsyncIOExecutor calls it as a coroutine in the event loop —
    # no lambda, no thread bridging, no event loop errors.
    scheduler.add_job(
        run_optimization,
        CronTrigger(hour=CRON_HOUR, minute=CRON_MINUTE),
        id="daily_optimization",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — daily optimization at {CRON_HOUR:02d}:{CRON_MINUTE:02d} UTC")


@app.on_event("shutdown")
async def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped cleanly")


@app.get("/")
def root():
    job = scheduler.get_job("daily_optimization")
    return {
        "service": "EcoMate Optimization Engine",
        "version": "2.0.0",
        "status": "running",
        "mode": "mock" if USE_MOCK_DATA else "live",
        "coverage": "16 Malaysian states/territories",
        "next_scheduled_run": str(job.next_run_time) if job else "not scheduled",
    }


@app.get("/health")
def health():
    """
    Health check with live optimization progress.
    While running: states_completed grows as each state finishes in parallel.
    When done: status = success, full result in last_run.result.
    """
    return {
        "status": "healthy",
        "mode": "mock" if USE_MOCK_DATA else "live",
        "scheduler_running": scheduler.running,
        "last_run": _last_run,
    }


@app.post("/optimize")
async def trigger_optimization(request: OptimizeRequest, background_tasks: BackgroundTasks):
    """
    Trigger optimization as a background task — returns immediately.
    All 16 states run in parallel. Poll GET /health for live progress.
    Pass state='Selangor' to optimize a single state only.
    """
    target_date = request.target_date or str(date.today())
    try:
        date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    background_tasks.add_task(
        run_optimization,
        target_date,
        request.num_pickups,
        request.num_vehicles,
        request.max_shift_hours,
        request.min_stops_per_vehicle,
        request.retry_shift_hours,
        request.max_retries,
        request.state,
    )

    states_count = f"1 state ({request.state})" if request.state else "all 16 states in parallel"
    return {
        "status": "accepted",
        "message": f"Optimization started for {states_count} on {target_date}. Poll GET /health for progress.",
        "target_date": target_date,
        "states": request.state or "all",
    }


@app.post("/optimize/state")
async def optimize_single_state_endpoint(request: OptimizeStateRequest, background_tasks: BackgroundTasks):
    """
    Optimize a single state by name as a background task.
    Example: { "state": "Selangor" }
    """
    target_date = request.target_date or str(date.today())
    try:
        date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    background_tasks.add_task(
        run_optimization,
        target_date,
        request.num_pickups,
        request.num_vehicles,
        request.max_shift_hours,
        request.min_stops_per_vehicle,
        request.retry_shift_hours,
        request.max_retries,
        request.state,
    )

    return {
        "status": "accepted",
        "message": f"Optimization started for {request.state} on {target_date}. Poll GET /health for progress.",
        "target_date": target_date,
        "state": request.state,
    }


@app.post("/optimize/tomorrow")
async def optimize_tomorrow(background_tasks: BackgroundTasks):
    """Optimize all 16 states for tomorrow in parallel — equivalent to the daily cron job."""
    target_date = str(date.today() + timedelta(days=1))
    background_tasks.add_task(run_optimization, target_date)
    return {
        "status": "accepted",
        "message": f"Optimization queued for {target_date} across all 16 states in parallel. Poll GET /health for progress.",
    }
