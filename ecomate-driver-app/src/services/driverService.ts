import { supabase } from '../config/supabase';
import { Driver, DriverStats, Vehicle } from '../types';

export const driverService = {
  getProfile: async (userId: string): Promise<Driver | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'driver')
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      return null;
    }
  },

  updateProfile: async (userId: string, updates: Partial<Driver>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating driver profile:', error);
      return false;
    }
  },

  getVehicle: async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      return null;
    }
  },

  getVehicles: async (driverId: string): Promise<Vehicle[]> => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  },

  updateVehicleStatus: async (
    vehicleId: string,
    status: 'available' | 'in_use' | 'out_of_service'
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('vehicle_id', vehicleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating vehicle status:', error);
      return false;
    }
  },

  getStats: async (driverId: string): Promise<DriverStats> => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Pickups today
      const { data: todayPickups } = await supabase
        .from('dropoffs')
        .select('dropoff_id, status, actual_volume')
        .eq('collector_id', driverId)
        .eq('dropoff_type', 'home_pickup')
        .gte('scheduled_for', today)
        .lt('scheduled_for', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0]);

      // All-time completed routes
      const { data: completedRoutes } = await supabase
        .from('routes')
        .select('route_id, total_distance_km')
        .eq('collector_id', driverId)
        .eq('status', 'completed');

      // Total UCO collected all time
      const { data: allCollected } = await supabase
        .from('dropoffs')
        .select('actual_volume')
        .eq('collector_id', driverId)
        .in('status', ['collected', 'reached_depot']);

      const totalPickupsToday = todayPickups?.length || 0;
      const totalRoutesCompleted = completedRoutes?.length || 0;
      const totalVolumeCollected = (allCollected || []).reduce(
        (sum, p) => sum + (p.actual_volume || 0), 0
      );
      const co2Reduced = totalVolumeCollected * 2.5;

      const totalDistanceKm = (completedRoutes || []).reduce(
        (sum, r) => sum + (r.total_distance_km || 0), 0
      );

      return {
        total_pickups_today: totalPickupsToday,
        total_volume_collected: totalVolumeCollected,
        co2_reduced: co2Reduced,
        total_routes_completed: totalRoutesCompleted,
        total_distance_km: totalDistanceKm,
      };
    } catch (error) {
      console.error('Error fetching driver stats:', error);
      return {
        total_pickups_today: 0,
        total_volume_collected: 0,
        co2_reduced: 0,
        total_routes_completed: 0,
        total_distance_km: 0,
      };
    }
  },
};

export const getDriverProfile = driverService.getProfile;
export const updateDriverProfile = driverService.updateProfile;
export const getDriverVehicle = driverService.getVehicle;
export const getDriverVehicles = driverService.getVehicles;
export const updateVehicleStatus = driverService.updateVehicleStatus;
export const getDriverStats = driverService.getStats;