import { useAuth } from '@/src/contexts/AuthContext';
import { driverService } from '@/src/services/driverService';
import { routeService } from '@/src/services/routeService';
import { DriverStats, Route } from '@/src/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [todayRoute, setTodayRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadDashboardData(); }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [statsData, routeData] = await Promise.all([
        driverService.getStats(user.user_id),
        routeService.getTodayRoute(user.user_id),
      ]);
      setStats(statsData);
      setTodayRoute(routeData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleStartRoute = async () => {
    if (!todayRoute) return;
    try {
      if (todayRoute.status === 'planned') {
        await routeService.startRoute(todayRoute.route_id);
      }
      // Always navigate to route details, not just the routes tab
      router.push(`/route-details?id=${todayRoute.route_id}` as any);
    } catch (error) {
      console.error('Error starting route:', error);
      Alert.alert('Error', 'Failed to start route. Please try again.');
    }
  };

  // Route progress helpers
  const getRouteProgress = (route: Route) => {
    const stops = route.stops || [];
    const total = stops.length;
    const completed = stops.filter(
      (s: any) => s.status === 'collected' || s.status === 'cancelled'
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

  const getRouteStatusConfig = (route: Route): {
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  } => {
    if (route.status === 'completed' && route.depot_transfer_confirmed) {
      return { color: Colors.primary, bg: Colors.ecoTileBg, icon: 'checkmark-done-circle', label: 'Transferred' };
    }
    if (route.status === 'completed' && !route.depot_transfer_confirmed) {
      return { color: '#F57F17', bg: '#FFF8E1', icon: 'time', label: 'Pending Transfer' };
    }
    switch (route.status) {
      case 'active':
        return { color: Colors.ecoYellow, bg: '#FFF8E1', icon: 'car', label: 'Active' };
      default:
        return { color: '#1565C0', bg: '#E3F2FD', icon: 'calendar', label: 'Planned' };
    }
  };

  // Determine which action buttons to show
  const showStartRoute = todayRoute &&
    (todayRoute.status === 'planned' || todayRoute.status === 'active');

  const showDepotTransfer = todayRoute &&
    todayRoute.status === 'completed' &&
    !todayRoute.depot_transfer_confirmed;

  const showRouteComplete = todayRoute &&
    todayRoute.status === 'completed' &&
    todayRoute.depot_transfer_confirmed;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>Loading dashboard...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
          ECOMATE DRIVER
        </AppText>
        <AppText variant="caption" color={Colors.secondary}>
          UCO Collection Dashboard
        </AppText>
      </View>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Welcome card */}
          <View style={styles.card}>
            <AppText variant="sectionTitle" style={styles.welcomeText}>
              Welcome back, {user?.name || 'Driver'}!
            </AppText>
            <AppText variant="caption" style={styles.dateText}>
              {new Date().toLocaleDateString('en-MY', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </AppText>
          </View>

          {/* Today's route card */}
          {todayRoute && (() => {
            const routeStatusConfig = getRouteStatusConfig(todayRoute);
            const progress = getRouteProgress(todayRoute);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/route-details?id=${todayRoute.route_id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTitleRow}>
                  <Ionicons name="map-outline" size={16} color={Colors.primary} />
                  <AppText variant="caption" style={styles.cardTitle}>Today's Route</AppText>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={14} color="#BBB" />
                </View>

                <View style={styles.routeStats}>
                  <View style={styles.routeStatItem}>
                    <AppText style={styles.routeStatNumber}>
                      {todayRoute.stops?.length || 0}
                    </AppText>
                    <AppText variant="caption" style={styles.routeStatLabel}>Stops</AppText>
                  </View>
                  <View style={styles.routeStatDivider} />
                  <View style={styles.routeStatItem}>
                    <AppText style={styles.routeStatNumber}>
                      {todayRoute.total_distance_km?.toFixed(1) || 0}km
                    </AppText>
                    <AppText variant="caption" style={styles.routeStatLabel}>Distance</AppText>
                  </View>
                  <View style={styles.routeStatDivider} />
                  <View style={styles.routeStatItem}>
                    <AppText style={styles.routeStatNumber}>
                      {todayRoute.estimated_duration_min || 0}m
                    </AppText>
                    <AppText variant="caption" style={styles.routeStatLabel}>Duration</AppText>
                  </View>
                  <View style={styles.routeStatDivider} />
                  <View style={styles.routeStatItem}>
                    <AppText style={styles.routeStatNumber}>
                      {progress.completed}/{progress.total}
                    </AppText>
                    <AppText variant="caption" style={styles.routeStatLabel}>Done</AppText>
                  </View>
                </View>

                {/* Progress bar */}
                {todayRoute.status === 'active' && (
                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${progress.percentage}%` as any }]} />
                    </View>
                    <AppText variant="caption" style={styles.progressBarLabel}>
                      {progress.percentage}% complete
                    </AppText>
                  </View>
                )}

                <View style={[styles.routeStatusBadge, { backgroundColor: routeStatusConfig.bg }]}>
                  <Ionicons name={routeStatusConfig.icon} size={13} color={routeStatusConfig.color} />
                  <AppText variant="caption" style={[styles.routeStatusText, { color: routeStatusConfig.color }]}>
                    {routeStatusConfig.label}
                  </AppText>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <AppText style={styles.statNumber}>
                {stats?.total_pickups_today || 0}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>Pickups{'\n'}Today</AppText>
            </View>
            <View style={styles.statBox}>
              <AppText style={styles.statNumber}>
                {stats?.total_routes_completed || 0}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>Routes{'\n'}Completed</AppText>
            </View>
            <View style={styles.statBox}>
              <AppText style={styles.statNumber}>
                {stats?.total_volume_collected?.toFixed(1) || 0}L
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>UCO{'\n'}Collected</AppText>
            </View>
          </View>

          {/* Action buttons — context aware */}
          {showStartRoute && (
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                style={[styles.unifiedBtn, styles.continueRouteBtn]}
                onPress={handleStartRoute}
              >
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                <AppText style={styles.unifiedBtnText}>
                  {todayRoute!.status === 'active' ? 'Continue Route' : "Start Today's Route"}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {showDepotTransfer && (
            <View style={styles.buttonWrapper}>
              <TouchableOpacity
                style={[styles.unifiedBtn, styles.depotBtn]}
                onPress={() => router.push('/depot-transfer' as any)}
              >
                <Ionicons name="business-outline" size={16} color="#FFFFFF" />
                <AppText style={styles.unifiedBtnText}>Go to Depot Transfer</AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Route fully done banner */}
          {showRouteComplete && (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-done-circle" size={20} color={Colors.primary} />
              <AppText variant="body" color={Colors.primary} style={styles.completedBannerText}>
                Today's route fully completed
              </AppText>
            </View>
          )}

          {/* View All Pickups */}
          <View style={styles.buttonWrapper}>
            <TouchableOpacity
              style={[styles.unifiedBtn, styles.pickupsBtn]}
              onPress={() => router.push('/(tabs)/pickups' as any)}
            >
              <AppText style={[styles.unifiedBtnText, styles.pickupsBtnText]}>
                View All Pickups
              </AppText>
            </TouchableOpacity>
          </View>

          {/* No route assigned */}
          {!todayRoute && (
            <View style={[styles.card, styles.noRouteCard]}>
              <View style={styles.noRouteIconWrap}>
                <Ionicons name="calendar-outline" size={40} color={Colors.primary} />
              </View>
              <AppText variant="sectionTitle" style={styles.noRouteText}>
                No Route Assigned
              </AppText>
              <AppText variant="caption" style={styles.noRouteSubtext}>
                Check back later or contact dispatch
              </AppText>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <AppText variant="caption" color={Colors.primary} style={styles.refreshBtnText}>
                  Refresh
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick actions */}
          <AppText variant="sectionTitle" style={styles.sectionTitle}>
            Quick Actions
          </AppText>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/routes' as any)}
          >
            <View style={styles.actionBtnLeft}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="map-outline" size={20} color={Colors.primary} />
              </View>
              <AppText variant="body" style={styles.actionText}>Route History</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#BBB" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/profile' as any)}
          >
            <View style={styles.actionBtnLeft}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} />
              </View>
              <AppText variant="body" style={styles.actionText}>My Profile</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#BBB" />
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerTitle: {
    letterSpacing: 2,
    marginBottom: 4,
  },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  cardTitle: {
    fontWeight: '700',
    color: '#1B2A1C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeText: {
    marginBottom: 4,
    color: Colors.text,
  },
  dateText: {
    color: Colors.mutedText,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  routeStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
    alignSelf: 'center',
  },
  routeStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 2,
  },
  routeStatLabel: {
    color: Colors.mutedText,
  },

  // Progress bar
  progressBarWrap: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 7,
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressBarLabel: {
    color: Colors.mutedText,
    textAlign: 'right',
  },

  routeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
  },
  routeStatusText: {
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    flex: 1,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.mutedText,
    textAlign: 'center',
    lineHeight: 15,
  },
  buttonWrapper: {
    marginBottom: 12,
    alignItems: 'center',
  },
  unifiedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    width: '85%',
    borderRadius: 14,
  },
  unifiedBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  continueRouteBtn: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  depotBtn: {
    backgroundColor: '#BF5C00',
    shadowColor: '#BF5C00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pickupsBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  pickupsBtnText: {
    color: Colors.primary,
  },

  //  Completed banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  completedBannerText: {
    fontWeight: '700',
  },

  noRouteCard: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 20,
  },
  noRouteIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.ecoTileBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noRouteText: {
    marginBottom: 4,
    color: Colors.text,
  },
  noRouteSubtext: {
    color: Colors.mutedText,
    marginBottom: 16,
  },
  refreshBtn: {
    backgroundColor: Colors.ecoTileBg,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  refreshBtnText: {
    fontWeight: '700',
  },
  sectionTitle: {
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.ecoTileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '600',
    color: Colors.text,
  },
});