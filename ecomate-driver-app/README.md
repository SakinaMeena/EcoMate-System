# EcoMate Driver App

A mobile application built with **React Native (Expo)** for UCO (Used Cooking Oil) collection drivers. Drivers use this app to manage their daily collection routes, confirm pickups, track depot transfers, and monitor their collection statistics.

This app is part of the larger **EcoMate** ecosystem, which includes a user-facing app for scheduling pickups and an admin dashboard for monitoring these pickups with spatial analysis.

---

## Features

- **Dashboard** — Today's route overview, live progress bar, contextual action buttons, and all-time driver stats
- **Route Management** — View assigned routes, navigate stop-by-stop, track completion status
- **Pickup Confirmation** — Confirm UCO collection with actual volume entry, skip stops, report issues
- **Depot Transfer** — Three-step transfer flow (Out → Reached → Finish) with volume tracking
- **Route History** — Full history of all routes with depot transfer status per route
- **Pickup History** — Complete collection history with status badges
- **Customer Contact** — Tap phone numbers on stop cards to call or copy customer numbers
- **Driver Profile** — Edit personal details, view vehicle assignment and status
- **Pull-to-Refresh** — All screens support live data refresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK) |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth) |
| Maps & Navigation | Mapbox (directions + live location) |
| Icons | Expo Vector Icons (Ionicons) |
| Language | TypeScript |

---

## Project Structure

```
ecomate-driver-app/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar configuration
│   │   ├── index.tsx            # Dashboard screen
│   │   ├── routes.tsx           # Route history screen
│   │   ├── pickups.tsx          # Pickup history screen
│   │   └── profile.tsx          # Driver profile screen
│   ├── _layout.tsx              # Root layout + auth context
│   ├── login.tsx                # Login screen
│   ├── register.tsx             # Registration screen
│   ├── route-details.tsx        # Single route detail view
│   ├── pickup-details.tsx       # Single pickup detail view
│   ├── navigate.tsx             # Turn-by-turn navigation
│   └── depot-transfer.tsx       # Depot transfer flow
│
├── src/
│   ├── config/
│   │   └── supabase.ts          # Supabase client initialisation
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── services/
│   │   ├── routeService.ts      # Route database operations
│   │   ├── pickupService.ts     # Pickup database operations
│   │   └── driverService.ts     # Driver profile + stats
│   └── types/
│       └── index.ts             # TypeScript type definitions
│
├── components/
│   ├── AppText.tsx              # Themed text component
│   ├── AppButton.tsx            # Themed button component
│   ├── AppInput.tsx             # Themed input component
│   ├── AppTiles.tsx             # Grid tile component
│   └── AppLayout.tsx            # Base screen layout
│
├── constants/
│   └── colors.ts                # App colour palette
│
└── .env                         # Environment variables (not committed)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Expo Go](https://expo.dev/client) app on your physical device, or an Android/iOS emulator
- A [Supabase](https://supabase.com/) project with the EcoMate schema applied
- A [Mapbox](https://www.mapbox.com/) account with an access token

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ecomate-driver-app.git
cd ecomate-driver-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root of the project:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
```

> Never commit your `.env` file. It is already included in `.gitignore`.

### 4. Start the development server

Open android studio and the virtual device of your choice then run in terminal

```bash
npx expo run:android
```

---

## Database Schema

The app connects to a Supabase PostgreSQL database. The key tables used by the driver app are:

### `users`
Stores all app users including drivers.

| Column | Type | Description |
|---|---|---|
| `user_id` | uuid | Primary key |
| `email` | text | Login email |
| `name` | text | Display name |
| `phone` | text | Contact number |
| `role` | text | `driver`, `user`, `admin`, etc. |
| `depot_id` | text | Assigned depot identifier |
| `state_assigned` | text | State coverage area |

### `routes`
Daily collection routes assigned to drivers by the OR-Tools optimisation engine.

| Column | Type | Description |
|---|---|---|
| `route_id` | uuid | Primary key |
| `collector_id` | uuid | FK → users.user_id |
| `route_date` | date | Scheduled date |
| `status` | enum | `planned`, `active`, `completed` |
| `stops` | jsonb | Ordered array of stop objects |
| `total_distance_km` | float | Estimated route distance |
| `estimated_duration_min` | int | Estimated time |
| `total_volume_collected` | float | Total UCO collected (litres) |
| `depot_transfer_confirmed` | boolean | Whether depot transfer is done |
| `depot_transfer_time` | timestamptz | When transfer was confirmed |
| `depot_transfer_volume` | float | Volume transferred to depot |

### `dropoffs`
Individual UCO pickup requests from users.

| Column | Type | Description |
|---|---|---|
| `dropoff_id` | uuid | Primary key |
| `user_id` | uuid | FK → users.user_id (customer) |
| `collector_id` | uuid | FK → users.user_id (driver) |
| `route_id` | uuid | FK → routes.route_id |
| `status` | enum | `pending`, `assigned`, `scheduled`, `in_progress`, `collected`, `cancelled` |
| `estimated_volume` | float | Expected UCO volume (litres) |
| `actual_volume` | float | Actual collected volume (litres) |
| `user_address` | text | Pickup address |
| `user_lat` / `user_lon` | float | Coordinates |
| `scheduled_for` | date | Pickup date |
| `collected_at` | timestamptz | When collected |
| `depot_id` | text | Destination depot |
| `dropoff_type` | text | `home_pickup` or `station` |

### `vehicles`
Vehicles assigned to drivers.

| Column | Type | Description |
|---|---|---|
| `vehicle_id` | uuid | Primary key |
| `driver_id` | uuid | FK → users.user_id |
| `license_plate` | text | Vehicle plate number |
| `capacity_litres` | float | Max UCO capacity |
| `status` | enum | `available`, `in_use`, `out_of_service` |

---

## Route Lifecycle

```
planned → active → completed → depot_transfer_confirmed: true
```

| Status | Trigger |
|---|---|
| `planned` | Created by OR-Tools route optimisation |
| `active` | Driver presses "Start Route" |
| `completed` | Last stop confirmed/skipped (automatic) |
| `depot_transfer_confirmed: true` | Driver completes depot transfer flow |

---

## Navigation Flow

```
Login
  └── Dashboard (tabs)
        ├── Routes tab → Route Details → Navigate → Pickup Details
        ├── Pickups tab → Pickup Details
        ├── Profile tab
        └── Depot Transfer (modal)
```

---

## Key Services

### `routeService.ts`

| Function | Description |
|---|---|
| `getTodayRoute(driverId)` | Fetches today's active/planned/pending-transfer route |
| `getRouteById(routeId)` | Fetches a single route with enriched stop data |
| `enrichRouteWithStops(route)` | Joins live dropoff status + customer phone/name onto stops |
| `startRoute(routeId)` | Sets status → `active`, stamps route_id on dropoffs, sets vehicle `in_use` |
| `completeRoute(routeId)` | Sets status → `completed`, calculates volume, frees vehicle |
| `getCurrentStop(routeId)` | Returns next non-collected stop by sequence |
| `confirmDepotTransfer(routeId)` | Flips `depot_transfer_confirmed` → true |

### `pickupService.ts`

| Function | Description |
|---|---|
| `getPickupById(pickupId)` | Fetches dropoff + joins customer phone and name |
| `getAssignedPickups(driverId)` | Today's active pickups for the driver |
| `getCollectionHistory(driverId)` | All collected/cancelled pickups |
| `completePickup(dropoffId, volume, driverId)` | Sets status → `collected`, records actual volume |
| `updatePickupStatus(dropoffId, status)` | Generic status update |

### `driverService.ts`

| Function | Description |
|---|---|
| `getProfile(userId)` | Fetches driver profile from users table |
| `updateProfile(userId, updates)` | Updates driver profile fields |
| `getVehicle(driverId)` | Fetches assigned vehicle |
| `getStats(driverId)` | Returns pickups today, routes completed, UCO collected, CO₂ reduced |

---

## TypeScript Types

```typescript
// Key types used throughout the app

type Status =
  | 'pending' | 'scheduled' | 'assigned' | 'in_progress'
  | 'collected' | 'cancelled' | 'active' | 'planned'
  | 'completed' | 'available' | 'in_use' | 'out_of_service';

interface Route {
  route_id: string;
  collector_id: string;
  route_date: string;
  status: Status;
  stops: RouteStop[];
  total_distance_km?: number;
  estimated_duration_min?: number;
  total_volume_collected?: number;
  depot_transfer_confirmed?: boolean;
  depot_transfer_time?: string;
  depot_transfer_volume?: number;
}

interface Pickup {
  dropoff_id: string;
  user_id: string;
  collector_id?: string;
  status: Status;
  estimated_volume: number;
  actual_volume?: number;
  user_address?: string;
  scheduled_for?: string;
  collected_at?: string;
  user_phone?: string;
  user_name?: string;
}

interface DriverStats {
  total_pickups_today: number;
  total_volume_collected: number;
  co2_reduced: number;
  total_routes_completed: number;
  total_distance_km: number;
}
```

---

## Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#245B43` | Main green, buttons, icons |
| `secondary` | `#A5D6A7` | Muted green accents |
| `background` | `#F4FAF5` | Screen backgrounds |
| `text` | `#1B2A1C` | Primary text |
| `mutedText` | `#888888` | Labels, captions |
| `ecoTileBg` | `#E8F5E9` | Card backgrounds |
| `ecoYellow` | `#F57F17` | Active/warning states |
| `divider` | `#E0E0E0` | Divider lines |

---

## Known Issues & Fixes Applied

| Issue | Fix |
|---|---|
| `PGRST116` error on `getTodayRoute` | Replaced `.maybeSingle()` with array-based `.limit(1)` fetch split into two queries |
| Depot transfer volume accumulating across routes | Volume query now scoped to current route's `dropoff_id` list only |
| Route status staying `active` after all stops done | `completeRoute` now called automatically in `pickup-details` after last stop |
| Tab bar icons not showing on Android | Replaced `IconSymbol` (iOS only) with `Ionicons` |
| Navigation path cutting through non-road areas | Changed Mapbox profile from `driving` to `driving-traffic` with `overview=full` |

---

## Testing with Emulator

To test GPS navigation on an Android emulator:

1. Open the emulator
2. Click the three-dot menu (⋮) → **Location** tab
3. Set coordinates: **Latitude** `3.135`, **Longitude** `101.615` (Damansara Perdana, PJ)
4. Click **Send**

---

## Team

This driver app is one component of the EcoMate capstone project other components are found in the parent repository
---

## License

This project is developed as part of a university capstone project. All rights reserved.
