"""
Mock data for testing the EcoMate optimization engine without Supabase.
Pickup volumes and driver counts are population-proportional per state.
Pickups are clustered around populated areas only.

Updated to reflect Test 4 (16-state full optimization) results:
- NS and Terengganu corrected to 180 pickups (matched actual test data)
- Sabah and Sarawak scatter radius widened to reflect genuine geographic spread
  (these states reliably hit the fallback heuristic due to vast distances between towns)
- All other counts confirmed against test results
"""
import random
from datetime import date

random.seed(42)

# ── State configuration: depot, pickup volume, driver count ─────────────────
# Volume and drivers scaled to reflect real population density and urbanisation.
# These numbers are confirmed against Test 4 (2026-03-17) results.
STATE_CONFIG = {
    "Selangor": {
        "depot_id": "DEP-SEL-01",
        "name": "Selangor Processing Facility",
        "latitude": 3.0738,
        "longitude": 101.5183,
        "num_pickups": 504,   # Test 4: 504/504 assigned, 9 routes, OR-Tools
        "num_drivers": 10,
    },
    "Kuala Lumpur": {
        "depot_id": "DEP-KUL-01",
        "name": "Kuala Lumpur Processing Facility",
        "latitude": 3.1390,
        "longitude": 101.6869,
        "num_pickups": 456,   # Test 4: 456/456 assigned, 8 routes, OR-Tools
        "num_drivers": 10,
    },
    "Johor": {
        "depot_id": "DEP-JHR-01",
        "name": "Johor Processing Facility",
        "latitude": 1.4927,
        "longitude": 103.7414,
        "num_pickups": 400,   # Test 4: 400/400 assigned, 7 routes, OR-Tools
        "num_drivers": 9,
    },
    "Pulau Pinang": {
        "depot_id": "DEP-PNG-01",
        "name": "Penang Processing Facility",
        "latitude": 5.4141,
        "longitude": 100.3288,
        "num_pickups": 350,   # Test 4: 350/350 assigned, 7 routes, OR-Tools
        "num_drivers": 8,
    },
    "Perak": {
        "depot_id": "DEP-PRK-01",
        "name": "Perak Processing Facility",
        "latitude": 4.5975,
        "longitude": 101.0901,
        "num_pickups": 252,   # Test 4: 252/252 assigned, 5 routes, OR-Tools
        "num_drivers": 6,
    },
    "Sabah": {
        "depot_id": "DEP-SBH-01",
        "name": "Sabah Processing Facility",
        "latitude": 5.9788,
        "longitude": 116.0753,
        "num_pickups": 252,   # Test 4: 234/252 assigned, 6 routes, fallback (2 retries)
        "num_drivers": 6,
    },
    "Sarawak": {
        "depot_id": "DEP-SWK-01",
        "name": "Sarawak Processing Facility",
        "latitude": 1.5533,
        "longitude": 110.3592,
        "num_pickups": 252,   # Test 4: 180/252 assigned, 6 routes, fallback (2 retries)
        "num_drivers": 6,
    },
    "Pahang": {
        "depot_id": "DEP-PHG-01",
        "name": "Pahang Processing Facility",
        "latitude": 3.8077,
        "longitude": 103.3260,
        "num_pickups": 204,   # Test 4: 204/204 assigned, 4 routes, OR-Tools
        "num_drivers": 5,
    },
    "Kedah": {
        "depot_id": "DEP-KDH-01",
        "name": "Kedah Processing Facility",
        "latitude": 6.1248,
        "longitude": 100.3673,
        "num_pickups": 204,   # Test 4: 204/204 assigned, 4 routes, OR-Tools
        "num_drivers": 5,
    },
    "Kelantan": {
        "depot_id": "DEP-KTN-01",
        "name": "Kelantan Processing Facility",
        "latitude": 6.1254,
        "longitude": 102.2381,
        "num_pickups": 204,   # Test 4: 204/204 assigned, 4 routes, OR-Tools
        "num_drivers": 5,
    },
    "Negeri Sembilan": {
        "depot_id": "DEP-NS-01",
        "name": "Negeri Sembilan Processing Facility",
        "latitude": 2.7297,
        "longitude": 101.9381,
        "num_pickups": 180,   # Test 4: 180/180 assigned, 4 routes, OR-Tools
        "num_drivers": 5,
    },
    "Terengganu": {
        "depot_id": "DEP-TRG-01",
        "name": "Terengganu Processing Facility",
        "latitude": 5.3117,
        "longitude": 103.1324,
        "num_pickups": 180,   # Test 4: 180/180 assigned, 4 routes, OR-Tools
        "num_drivers": 5,
    },
    "Melaka": {
        "depot_id": "DEP-MLK-01",
        "name": "Melaka Processing Facility",
        "latitude": 2.1896,
        "longitude": 102.2501,
        "num_pickups": 150,   # Test 4: 150/150 assigned, 3 routes, OR-Tools
        "num_drivers": 4,
    },
    "Putrajaya": {
        "depot_id": "DEP-PJY-01",
        "name": "Putrajaya Processing Facility",
        "latitude": 2.9264,
        "longitude": 101.6964,
        "num_pickups": 76,    # Test 4: 76/76 assigned, 2 routes, OR-Tools
        "num_drivers": 3,
    },
    "Perlis": {
        "depot_id": "DEP-PLS-01",
        "name": "Perlis Processing Facility",
        "latitude": 6.4449,
        "longitude": 100.2048,
        "num_pickups": 60,    # Test 4: 60/60 assigned, 2 routes, OR-Tools
        "num_drivers": 2,
    },
    "Labuan": {
        "depot_id": "DEP-LBN-01",
        "name": "Labuan Processing Facility",
        "latitude": 5.2831,
        "longitude": 115.2308,
        "num_pickups": 51,    # Test 4: 51/51 assigned, 1 route, OR-Tools
        "num_drivers": 2,
    },
}

# Convenience exports
DEPOTS = {state: {k: v for k, v in config.items() if k not in ("num_pickups", "num_drivers")}
          for state, config in STATE_CONFIG.items()}

# ── Pickup areas per state: populated towns only ────────────────────────────
# Sabah and Sarawak use a larger scatter radius (see STATE_SCATTER below) to
# reflect genuine inter-town distances — this is why they reliably hit the
# fallback heuristic even with 6 drivers and 2 retries.
STATE_AREAS = {
    "Selangor": [
        ("Petaling Jaya", 3.1073, 101.6067),
        ("Shah Alam", 3.0738, 101.5183),
        ("Subang Jaya", 3.0456, 101.5809),
        ("Klang", 3.0449, 101.4478),
        ("Puchong", 3.0269, 101.6200),
        ("Cheras", 3.0800, 101.7300),
        ("Ampang", 3.1500, 101.7600),
        ("Kepong", 3.2100, 101.6300),
        ("Kajang", 2.9934, 101.7862),
        ("Cyberjaya", 2.9213, 101.6559),
        ("Sepang", 2.7297, 101.7029),
        ("Rawang", 3.3200, 101.5800),
    ],
    "Kuala Lumpur": [
        ("KLCC", 3.1578, 101.7123),
        ("Chow Kit", 3.1622, 101.6994),
        ("Bangsar", 3.1294, 101.6786),
        ("Mont Kiara", 3.1726, 101.6503),
        ("Kepong KL", 3.2050, 101.6350),
        ("Titiwangsa", 3.1756, 101.7067),
        ("Setapak", 3.2000, 101.7200),
        ("Wangsa Maju", 3.2050, 101.7400),
    ],
    "Putrajaya": [
        ("Putrajaya Presint 1", 2.9264, 101.6964),
        ("Putrajaya Presint 8", 2.9100, 101.7100),
        ("Putrajaya Presint 11", 2.9350, 101.7050),
        ("Putrajaya Presint 14", 2.9000, 101.7200),
    ],
    "Pulau Pinang": [
        ("George Town", 5.4141, 100.3288),
        ("Bayan Lepas", 5.2974, 100.2660),
        ("Butterworth", 5.3990, 100.3660),
        ("Bukit Mertajam", 5.3638, 100.4651),
        ("Nibong Tebal", 5.1637, 100.4667),
        ("Balik Pulau", 5.3471, 100.2295),
        ("Kepala Batas", 5.5218, 100.4246),
    ],
    "Johor": [
        ("Johor Bahru", 1.4927, 103.7414),
        ("Skudai", 1.5333, 103.6833),
        ("Batu Pahat", 1.8530, 102.9329),
        ("Muar", 2.0442, 102.5689),
        ("Kluang", 2.0250, 103.3189),
        ("Segamat", 2.5150, 102.8150),
        ("Kulai", 1.6594, 103.5963),
        ("Pontian", 1.4800, 103.3900),
    ],
    "Perak": [
        ("Ipoh", 4.5975, 101.0901),
        ("Taiping", 4.8500, 100.7333),
        ("Teluk Intan", 4.0231, 101.0203),
        ("Sitiawan", 4.2177, 100.6997),
        ("Lumut", 4.2333, 100.6333),
        ("Kampar", 4.3060, 101.1490),
        ("Slim River", 3.8380, 101.4020),
    ],
    "Negeri Sembilan": [
        ("Seremban", 2.7297, 101.9381),
        ("Port Dickson", 2.5225, 101.7956),
        ("Nilai", 2.8121, 101.7978),
        ("Bahau", 2.8000, 102.4333),
        ("Tampin", 2.4667, 102.2333),
        ("Rembau", 2.5893, 102.0938),
    ],
    "Melaka": [
        ("Melaka City", 2.1896, 102.2501),
        ("Ayer Keroh", 2.2667, 102.2833),
        ("Alor Gajah", 2.3779, 102.2080),
        ("Jasin", 2.3051, 102.4386),
        ("Masjid Tanah", 2.3436, 102.0769),
    ],
    "Pahang": [
        ("Kuantan", 3.8077, 103.3260),
        ("Temerloh", 3.4500, 102.4167),
        ("Bentong", 3.5167, 101.9167),
        ("Raub", 3.7936, 101.8594),
        ("Maran", 3.9833, 102.7500),
        ("Pekan", 3.4833, 103.3667),
    ],
    "Kedah": [
        ("Alor Setar", 6.1248, 100.3673),
        ("Sungai Petani", 5.6477, 100.4882),
        ("Kulim", 5.3667, 100.5500),
        ("Langkawi", 6.3500, 99.8000),
        ("Baling", 5.6833, 100.9167),
        ("Kuala Kedah", 6.1000, 100.2833),
    ],
    "Kelantan": [
        ("Kota Bharu", 6.1254, 102.2381),
        ("Pasir Mas", 6.0452, 102.1371),
        ("Tanah Merah", 5.8077, 102.1456),
        ("Machang", 5.7667, 102.2167),
        ("Kuala Krai", 5.5333, 102.2000),
        ("Tumpat", 6.1972, 102.1703),
    ],
    "Terengganu": [
        ("Kuala Terengganu", 5.3117, 103.1324),
        ("Kemaman", 4.2333, 103.4167),
        ("Dungun", 4.7667, 103.4167),
        ("Marang", 5.2000, 103.2167),
        ("Besut", 5.7000, 102.5667),
        ("Setiu", 5.6833, 102.9833),
    ],
    # Sabah: towns spread across ~400km (KK to Tawau).
    # Wide scatter reproduces the solver difficulty seen in Test 4.
    "Sabah": [
        ("Kota Kinabalu", 5.9788, 116.0753),
        ("Sandakan", 5.8456, 118.1179),
        ("Tawau", 4.2667, 117.8833),
        ("Lahad Datu", 5.0333, 118.3333),
        ("Keningau", 5.3333, 116.1667),
        ("Beaufort", 5.3667, 115.7500),
        ("Kota Belud", 6.3500, 116.4333),
    ],
    # Sarawak: towns spread across ~800km (Kuching to Miri).
    # This is why Sarawak has the most unassigned stops in Test 4 (7 clusters).
    "Sarawak": [
        ("Kuching", 1.5533, 110.3592),
        ("Miri", 4.3995, 113.9914),
        ("Sibu", 2.3000, 111.8167),
        ("Bintulu", 3.1667, 113.0333),
        ("Limbang", 4.7500, 115.0000),
        ("Sarikei", 2.1167, 111.5167),
        ("Sri Aman", 1.2333, 111.4667),
    ],
    "Perlis": [
        ("Kangar", 6.4449, 100.2048),
        ("Arau", 6.4259, 100.2726),
        ("Padang Besar", 6.6567, 100.1333),
        ("Kuala Perlis", 6.4000, 100.1167),
    ],
    "Labuan": [
        ("Victoria", 5.2831, 115.2308),
        ("Labuan Airport Area", 5.3003, 115.2503),
        ("Rancha Rancha", 5.3167, 115.2000),
    ],
}

# ── Scatter radius per state ─────────────────────────────────────────────────
# Wider for large states to produce realistic inter-pickup distances.
# This directly affects solver difficulty — Sabah/Sarawak reliably need fallback.
STATE_SCATTER = {
    "Sabah": 0.08,    # KK to Tawau ~400km — solver struggles with 6 drivers
    "Sarawak": 0.10,  # Kuching to Miri ~800km — worst case, most unassigned
    "Pahang": 0.06,   # Second largest peninsula state
    "Perak": 0.05,    # Ipoh to Slim River span
    "Johor": 0.05,    # JB to Segamat span
    "Kedah": 0.05,    # Sungai Petani to Langkawi span
    "Kelantan": 0.05,
    "Terengganu": 0.05,
}
DEFAULT_SCATTER = 0.03  # Compact urban states (KL, Selangor, Melaka, etc.)

STATE_PLATES = {
    "Selangor": "B", "Kuala Lumpur": "W", "Putrajaya": "W",
    "Pulau Pinang": "P", "Johor": "J", "Perak": "A",
    "Negeri Sembilan": "D", "Melaka": "M", "Pahang": "C",
    "Kedah": "K", "Kelantan": "N", "Terengganu": "T",
    "Sabah": "S", "Sarawak": "Q", "Perlis": "R", "Labuan": "L",
}


def generate_mock_pickups(n: int = None, state: str = "Selangor"):
    """
    Generate mock pickups for a given state.
    If n is not provided, uses the population-proportional default for that state.
    Scatter radius is wider for geographically large states (Sabah, Sarawak, Pahang).
    """
    config = STATE_CONFIG.get(state, STATE_CONFIG["Selangor"])
    n = n if n is not None else config["num_pickups"]
    areas = STATE_AREAS.get(state, STATE_AREAS["Selangor"])
    scatter = STATE_SCATTER.get(state, DEFAULT_SCATTER)
    today = date.today().isoformat()
    pickups = []

    for i in range(n):
        area_name, base_lat, base_lon = random.choice(areas)
        lat = base_lat + random.uniform(-scatter, scatter)
        lon = base_lon + random.uniform(-scatter, scatter)
        pickups.append({
            "dropoff_id": f"mock-{state[:3].upper()}-{i+1:04d}",
            "user_id": f"mock-user-{state[:3].upper()}-{i+1:04d}",
            "user_lat": round(lat, 6),
            "user_lon": round(lon, 6),
            "user_address": f"No. {random.randint(1, 99)}, {area_name}, {state}",
            "estimated_volume": round(random.uniform(1.0, 15.0), 1),
            "time_window_start": f"{today}T07:00:00+08:00",
            "time_window_end": f"{today}T19:00:00+08:00",
            "status": "scheduled",
            "depot_id": config["depot_id"],
        })
    return pickups


def generate_mock_vehicles(n: int = None, state: str = "Selangor"):
    """
    Generate mock vehicles for a given state depot.
    If n is not provided, uses the population-proportional default for that state.
    """
    config = STATE_CONFIG.get(state, STATE_CONFIG["Selangor"])
    n = n if n is not None else config["num_drivers"]
    plate_prefix = STATE_PLATES.get(state, "W")
    vehicles = []

    for i in range(n):
        vehicles.append({
            "vehicle_id": f"mock-veh-{state[:3].upper()}-{i+1:02d}",
            "driver_id": f"mock-drv-{state[:3].upper()}-{i+1:02d}",
            "driver_name": f"Driver {state} {i+1}",
            "license_plate": f"{plate_prefix} {1000 + i}",
            "capacity_litres": random.choice([300, 400, 500]),
            "status": "available",
            "depot_id": config["depot_id"],
            "depot_lat": config["latitude"],
            "depot_lon": config["longitude"],
            "depot_name": config["name"],
        })
    return vehicles


def generate_all_states():
    """
    Generate population-proportional mock data for all 16 states.
    Returns a dict keyed by state name.

    Expected outcomes based on Test 4 (2026-03-17):
      - 14 states: OR-Tools solves on first attempt, 100% assignment
      - Sabah:   fallback heuristic, 2 retries, ~93% assignment (234/252)
      - Sarawak: fallback heuristic, 2 retries, ~71% assignment (180/252)
                 unassigned stops flagged as pending for next run
      Total: 76 routes across 16 states, 3,685/3,775 assigned, ~964s runtime
    """
    all_data = {}
    for state, config in STATE_CONFIG.items():
        all_data[state] = {
            "depot": DEPOTS[state],
            "pickups": generate_mock_pickups(state=state),
            "vehicles": generate_mock_vehicles(state=state),
        }
    return all_data
