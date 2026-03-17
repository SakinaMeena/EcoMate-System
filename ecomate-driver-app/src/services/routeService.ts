import { supabase } from '../config/supabase';
import { Route } from '../types';

export const routeService = {
  // ✅ Array-based fetch — never throws PGRST116
  getTodayRoute: async (driverId: string): Promise<Route | null> => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // First priority — active or planned route
      const { data: activeData, error: activeError } = await supabase
        .from('routes')
        .select('*')
        .eq('collector_id', driverId)
        .eq('route_date', today)
        .in('status', ['planned', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (activeError) throw activeError;

      if (activeData && activeData.length > 0) {
        return await routeService.enrichRouteWithStops(activeData[0]);
      }

      // Second priority — completed but depot transfer not yet done
      const { data: completedData, error: completedError } = await supabase
        .from('routes')
        .select('*')
        .eq('collector_id', driverId)
        .eq('route_date', today)
        .eq('status', 'completed')
        .eq('depot_transfer_confirmed', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (completedError) throw completedError;

      if (completedData && completedData.length > 0) {
        return await routeService.enrichRouteWithStops(completedData[0]);
      }

      return null;
    } catch (error) {
      console.error('Error fetching today route:', error);
      return null;
    }
  },

  getRouteById: async (routeId: string): Promise<Route | null> => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('route_id', routeId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return await routeService.enrichRouteWithStops(data);
    } catch (error) {
      console.error('Error fetching route:', error);
      return null;
    }
  },

  enrichRouteWithStops: async (route: any): Promise<Route> => {
    try {
      const stops = route.stops || [];
      if (stops.length === 0) return route;

      const dropoffIds = stops.map((s: any) => s.dropoff_id);
      const { data: dropoffs } = await supabase
        .from('dropoffs')
        .select('dropoff_id, status, actual_volume, estimated_volume, user_lat, user_lon, user_address, time_window_start, time_window_end, scheduled_for, user_id')
        .in('dropoff_id', dropoffIds);
      
      const userIds = [...new Set((dropoffs || []).map(d => d.user_id).filter(Boolean))];
      const { data: users } = await supabase
        .from('users')        
        .select('user_id, name')
        .in('user_id', userIds);
      const userMap: Record<string, any> = {};
      (users || []).forEach(u => { userMap[u.user_id] = u; });

      const dropoffMap: Record<string, any> = {};
      (dropoffs || []).forEach(d => { dropoffMap[d.dropoff_id] = d; });

      const enrichedStops = stops.map((stop: any) => {
        const live = dropoffMap[stop.dropoff_id] || {};
        const userInfo = userMap[live.user_id] || {};
        return {
          ...stop,
          status: live.status || stop.status,
          actual_volume: live.actual_volume || stop.actual_volume,
          estimated_volume: live.estimated_volume || stop.estimated_volume,
          latitude: live.user_lat,
          longitude: live.user_lon,
          user_address: live.user_address || stop.user_address,
          user_phone: userInfo.phone || null,
          user_name: userInfo.name || null,
        };
      });

      enrichedStops.sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));

      return { ...route, stops: enrichedStops };
    } catch (error) {
      console.error('Error enriching stops:', error);
      return route;
    }
  },

  getRouteProgress: async (routeId: string): Promise<{ completed: number; total: number; percentage: number }> => {
    try {
      const route = await routeService.getRouteById(routeId);
      if (!route || !route.stops) return { completed: 0, total: 0, percentage: 0 };

      const total = route.stops.length;
      const completed = route.stops.filter(
        (s: any) => s.status === 'collected' ||
                    s.status === 'cancelled' ||
                    s.status === 'reached_depot'
      ).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { completed, total, percentage };
    } catch (error) {
      console.error('Error getting route progress:', error);
      return { completed: 0, total: 0, percentage: 0 };
    }
  },

  getDriverRoutes: async (driverId: string): Promise<Route[]> => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('collector_id', driverId)
        .order('route_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching driver routes:', error);
      return [];
    }
  },

  getCurrentStop: async (routeId: string): Promise<any | null> => {
    try {
      const route = await routeService.getRouteById(routeId);
      if (!route || !route.stops) return null;

      const sortedStops = [...route.stops].sort(
        (a: any, b: any) => (a.sequence || 0) - (b.sequence || 0)
      );

      const nextStop = sortedStops.find(
        (s: any) =>
          s.status !== 'collected' &&
          s.status !== 'cancelled' &&
          s.status !== 'reached_depot'
      );

      return nextStop || null;
    } catch (error) {
      console.error('Error getting current stop:', error);
      return null;
    }
  },

  startRoute: async (routeId: string): Promise<boolean> => {
    try {
      const { data: route } = await supabase
        .from('routes')
        .select('collector_id, stops')
        .eq('route_id', routeId)
        .maybeSingle();

      const { error } = await supabase
        .from('routes')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('route_id', routeId);

      if (error) throw error;

      // Stamp route_id onto all dropoffs
      const dropoffIds = (route?.stops || [])
        .map((s: any) => s.dropoff_id)
        .filter(Boolean);

      if (dropoffIds.length > 0) {
        await supabase
          .from('dropoffs')
          .update({ route_id: routeId })
          .in('dropoff_id', dropoffIds);
      }

      if (route?.collector_id) {
        await supabase
          .from('vehicles')
          .update({ status: 'in_use', updated_at: new Date().toISOString() })
          .eq('driver_id', route.collector_id)
          .eq('status', 'available');
      }

      return true;
    } catch (error) {
      console.error('Error starting route:', error);
      return false;
    }
  },

  completeRoute: async (routeId: string): Promise<boolean> => {
    try {
      const { data: route } = await supabase
        .from('routes')
        .select('collector_id, stops')
        .eq('route_id', routeId)
        .maybeSingle();

      const routeDropoffIds = (route?.stops || [])
        .map((s: any) => s.dropoff_id)
        .filter(Boolean);

      let totalVolume = 0;
      if (routeDropoffIds.length > 0) {
        const { data: dropoffs } = await supabase
          .from('dropoffs')
          .select('actual_volume')
          .in('dropoff_id', routeDropoffIds)
          .in('status', ['collected', 'reached_depot']);

        totalVolume = (dropoffs || []).reduce(
          (sum, d) => sum + (d.actual_volume || 0), 0
        );
      }

      const { error } = await supabase
        .from('routes')
        .update({
          status: 'completed',
          total_volume_collected: totalVolume,
          updated_at: new Date().toISOString(),
        })
        .eq('route_id', routeId);

      if (error) throw error;

      if (route?.collector_id) {
        await supabase
          .from('vehicles')
          .update({ status: 'available', updated_at: new Date().toISOString() })
          .eq('driver_id', route.collector_id)
          .eq('status', 'in_use');
      }

      return true;
    } catch (error) {
      console.error('Error completing route:', error);
      return false;
    }
  },

  startDepotTransfer: async (routeId: string, volume: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('routes')
        .update({
          depot_transfer_volume: volume,
          updated_at: new Date().toISOString(),
        })
        .eq('route_id', routeId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error starting depot transfer:', error);
      return false;
    }
  },

  confirmDepotTransfer: async (routeId: string): Promise<boolean> => {
    try {
      const { data: route } = await supabase
        .from('routes')
        .select('collector_id, stops')
        .eq('route_id', routeId)
        .maybeSingle();

      const routeDropoffIds = (route?.stops || [])
        .map((s: any) => s.dropoff_id)
        .filter(Boolean);

      let totalVolume = 0;
      if (routeDropoffIds.length > 0) {
        const { data: dropoffs } = await supabase
          .from('dropoffs')
          .select('actual_volume')
          .in('dropoff_id', routeDropoffIds)
          .in('status', ['collected', 'reached_depot']);

        totalVolume = (dropoffs || []).reduce(
          (sum, d) => sum + (d.actual_volume || 0), 0
        );
      }

      const { error } = await supabase
        .from('routes')
        .update({
          depot_transfer_confirmed: true,
          depot_transfer_time: new Date().toISOString(),
          depot_transfer_volume: totalVolume,
          updated_at: new Date().toISOString(),
        })
        .eq('route_id', routeId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error confirming depot transfer:', error);
      return false;
    }
  },
};