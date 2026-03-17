# EcoMate Optimization Engine

Daily UCO (used cooking oil) collection route optimizer for all 16 Malaysian states. Runs automatically at **6:00 AM MYT** every day, solving a multi-depot CVRPTW across 3,700+ pickups and writing optimized routes to Supabase for the EcoMate Driver App.

---

## Stack

| Layer | Technology |
|---|---|
| Solver | Google OR-Tools (CVRPTW) |
| Fallback | Nearest Neighbour Heuristic |
| API | FastAPI |
| Scheduling | APScheduler + AsyncIOExecutor |
| Clustering | K-Means++ (pure Python, K=20) |
| Distance | Mapbox Matrix API / Haversine fallback |
| Database | Supabase (PostgreSQL) |
| Deployment | Render Web Service — Singapore region |

---

## Project Structure

```
app/
  main.py            # FastAPI app, endpoints, parallel execution, cron scheduler
  solver.py          # OR-Tools CVRPTW solver with fallback heuristic
  clustering.py      # K-Means++ clustering and cluster unpack
  supabase_client.py # All Supabase I/O — fetch, save, bulk PATCH
  mapbox_client.py   # Mapbox Matrix API + haversine fallback
  config.py          # Environment variable definitions
  mock_data.py       # Population-proportional mock data for all 16 states
Dockerfile           # python:3.11-slim, no apt-get steps needed
docker-compose.yml   # Local development
render.yaml          # Render deployment manifest
requirements.txt
.env.example
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token
CRON_HOUR=22          # UTC — 22:00 UTC = 6:00 AM MYT
CRON_MINUTE=0
USE_MOCK_DATA=false   # set true to use mock_data.py instead of Supabase
USE_MAPBOX=false      # set true to use Mapbox Matrix API for road times
```

---

## Running Locally

```bash
docker compose build --no-cache
docker compose up
```

Server available at `http://localhost:8000`
Swagger UI at `http://localhost:8000/docs`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Service info, mode, next scheduled run time |
| GET | `/health` | Live status and last run result |
| GET | `/docs` | Swagger UI |
| POST | `/optimize` | Manual trigger — all 16 states in parallel |
| POST | `/optimize/state` | Single state trigger — body: `{ "state": "Selangor" }` |
| POST | `/optimize/tomorrow` | Shortcut for tomorrow — same as daily cron |

All POST endpoints return immediately with `status: accepted`. Poll `GET /health` for live progress via `states_completed`.

---

## How It Works

1. **Promote pending** — unassigned stops from the previous day are moved back to `scheduled`
2. **Fetch data** — pickups, vehicles, and depot coordinates fetched per state from Supabase
3. **K-Means clustering** — if pickups > 25, reduce to exactly 20 cluster centroids (fits Mapbox 25-node limit)
4. **Travel matrix** — Mapbox Matrix API for real road times, or haversine fallback
5. **OR-Tools solver** — CVRPTW with capacity and time window constraints, 300s time limit
6. **Retry logic** — if no solution: retry with 11h shift, then 12h shift
7. **Fallback** — nearest neighbour heuristic after 2 failed retries
8. **Unpack clusters** — expand cluster centroids back to individual stops
9. **Save to Supabase** — insert routes, bulk PATCH all dropoffs in one request per route
10. **Flag unassigned** — remaining stops set to `pending` for tomorrow's run

All 16 states run in parallel via `asyncio.gather`. Total runtime ~16 minutes.

---

## Optimization Coverage

| State | Pickups | Drivers | Expected Solver |
|---|---|---|---|
| Selangor | 504 | 10 | OR-Tools |
| Kuala Lumpur | 456 | 10 | OR-Tools |
| Johor | 400 | 9 | OR-Tools |
| Pulau Pinang | 350 | 8 | OR-Tools |
| Perak | 252 | 6 | OR-Tools |
| Sabah | 252 | 6 | Fallback (vast distances) |
| Sarawak | 252 | 6 | Fallback (vast distances) |
| Pahang | 204 | 5 | OR-Tools |
| Kedah | 204 | 5 | OR-Tools |
| Kelantan | 204 | 5 | OR-Tools |
| Negeri Sembilan | 180 | 5 | OR-Tools |
| Terengganu | 180 | 5 | OR-Tools |
| Melaka | 150 | 4 | OR-Tools |
| Putrajaya | 76 | 3 | OR-Tools |
| Perlis | 60 | 2 | OR-Tools |
| Labuan | 51 | 2 | OR-Tools |

Sabah and Sarawak consistently require the fallback heuristic due to extreme inter-town distances (Kuching to Miri ~800km, KK to Tawau ~400km). Unassigned stops are automatically rolled over to the next day.

---

## Test Results Summary

| Test | Description | Result |
|---|---|---|
| 1 | Selangor minimal — 20 pickups, Mapbox on | PASS |
| 2 | Selangor stress — 504 pickups, Mapbox on, bulk PATCH | PASS |
| 3 | Selangor haversine — USE_MAPBOX=false, 18x write speedup | PASS |
| 4 | 16-state full — 3,775 pickups, 76 routes, 97.6% assigned, 964s | PASS |
| 5 | Cron auto-trigger — real data, target=tomorrow, 77 routes, 96.6% assigned, 973s | PASS |

---

## Deployment (Render)

1. Connect this repository to Render — it will detect `render.yaml` automatically
2. Set secret environment variables in the Render dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `MAPBOX_ACCESS_TOKEN`
3. Set up [cron-job.org](https://cron-job.org) to ping `your-render-url/health` every 10 minutes to prevent free-tier spin-down
4. The cron fires at **22:00 UTC (6:00 AM MYT)** automatically via APScheduler — no Render Cron Job type needed

---

## Cron Time Reference

| CRON_HOUR (UTC) | MYT | Notes |
|---|---|---|
| 22 | 6:00 AM | Current — 44 min buffer before 7 AM driver start |
| 20 | 4:00 AM | Alternative — 30 min buffer |

---

## Database Notes

- Insert pickups via the `location` geography column — `user_lat` and `user_lon` are generated columns, never insert them directly
- The optimizer queries `dropoffs` filtered by `depot_id`, `status=scheduled`, `dropoff_type=home_pickup`, and `scheduled_for`
- Required index: `CREATE INDEX idx_dropoffs_depot_status_date ON dropoffs (depot_id, status, scheduled_for);`
