export type UserRole = 'user' | 'driver' | 'station_operator' | 'admin';

export type Status = 
  | 'pending' | 'scheduled' | 'assigned' | 'in_progress' | 'collected' | 'cancelled' | 'reached_depot'
  | 'active' | 'maintenance' | 'closed'
  | 'planned' | 'completed'
  | 'available' | 'in_use' | 'out_of_service';

export interface Driver {
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  points: number;
  user_address?: string;
  user_lat?: number;
  user_lon?: number;
  depot_id?: string; 
  state_assigned?: string;
  created_at: string;
  last_login?: string;
}

export interface Vehicle {
  vehicle_id: string;
  driver_id: string;
  capacity_litres: number;
  license_plate: string;
  status: Status;
  created_at: string;
}

export interface Pickup {
  dropoff_id: string;
  user_id: string;
  collector_id?: string;
  station_id?: string;
  user_address?: string;
  estimated_volume: number;
  actual_volume?: number;
  time_window_start?: string;
  time_window_end?: string;
  dropoff_type: string;
  status: Status;
  scheduled_for?: string;
  notes?: string;
  collected_at?: string;
  created_at: string;
  // For easier use in the app
  latitude?: number;
  longitude?: number;
  user_lat?: number;
  user_lon?: number;
  user_phone?: string;
  user_name?: string;
  user_email?: string;
}

export interface Route {
  route_id: string;
  collector_id: string;
  route_date: string;
  status: Status;
  total_distance_km?: number;
  estimated_duration_min?: number;
  total_volume_collected?: number;
  stops: RouteStop[];
  created_at: string;
  updated_at?: string;
  // Depot transfer fields
  depot_transfer_volume?: number;
  depot_transfer_confirmed?: boolean;
  depot_transfer_time?: string;
}

export interface RouteStop {
  dropoff_id: string;
  sequence: number;
  status?: Status;
  latitude?: number;
  longitude?: number;
  user_address?: string;
  estimated_volume?: number;
  actual_volume?: number;
  user_name?: string;
  phone?: string;
}

export interface DriverStats {
  total_pickups_today: number;
  total_volume_collected: number;
  co2_reduced: number;
  total_distance_km: number;
  total_routes_completed: number;
}