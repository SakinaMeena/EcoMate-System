import { supabase } from '../config/supabase';
import { Pickup } from '../types';

export const pickupService = {
  // Get assigned pickups for driver
  getAssignedPickups: async (driverId: string): Promise<Pickup[]> => {
    try {
      const { data, error } = await supabase
        .from('dropoffs')
        .select('*')
        .eq('collector_id', driverId)
        .eq('dropoff_type', 'home_pickup')
        .in('status', ['scheduled', 'assigned', 'in_progress'])
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      return (data || []).map(pickup => ({
        ...pickup,
        latitude: pickup.user_lat,
        longitude: pickup.user_lon,
      }));
    } catch (error) {
      console.error('Error fetching assigned pickups:', error);
      return [];
    }
  },

  // Get pickup by ID
  getPickupById: async (pickupId: string): Promise<Pickup | null> => {
    try {
      const { data, error } = await supabase
        .from('dropoffs')
        .select('*')
        .eq('dropoff_id', pickupId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      let user_phone = null;
      let user_name = null;
      let user_email = null; // ✅ added

      // Fetch user details if user_id exists
      if (data.user_id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('phone, name, email') // ✅ added email
          .eq('user_id', data.user_id)
          .maybeSingle();
          user_phone = userData?.phone || null;
          user_name = userData?.name || null;
          user_email = userData?.email || null; // ✅ added
      }

      return {
        ...data,
        latitude: data.user_lat,
        longitude: data.user_lon,
        user_phone,
        user_name,
        user_email, // ✅ added
      };
    } catch (error) {
      console.error('Error fetching pickup:', error);
      return null;
    }
  },

  // Update pickup status — strips any fields that don't exist in dropoffs table
  updatePickupStatus: async (
    pickupId: string,
    status: string
  ): Promise<boolean> => {
    try {
      console.log('updatePickupStatus called:', pickupId, status);
      const { error } = await supabase
        .from('dropoffs')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('dropoff_id', pickupId);

      if (error) {
        console.error('Supabase error in updatePickupStatus:', JSON.stringify(error));
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Error updating pickup status:', error);
      return false;
    }
  },

  // Complete pickup (mark as collected)
  completePickup: async (
    pickupId: string,
    actualVolume: number,
    driverId: string
  ): Promise<boolean> => {
    try {
      console.log('completePickup called:', pickupId, actualVolume);
      const { error } = await supabase
        .from('dropoffs')
        .update({
          status: 'collected',
          actual_volume: actualVolume,
          collected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('dropoff_id', pickupId);

      if (error) {
        console.error('Supabase error in completePickup:', JSON.stringify(error));
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Error completing pickup:', error);
      return false;
    }
  },

  // Get collection history
  getCollectionHistory: async (driverId: string): Promise<Pickup[]> => {
    try {
      const { data, error } = await supabase
        .from('dropoffs')
        .select('*')
        .eq('collector_id', driverId)
        .in('status', ['collected', 'cancelled', 'reached_depot'])
        .order('collected_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map(pickup => ({
        ...pickup,
        latitude: pickup.user_lat,
        longitude: pickup.user_lon,
      }));
    } catch (error) {
      console.error('Error fetching collection history:', error);
      return [];
    }
  },
};