import { useAuth } from '@/src/contexts/AuthContext';
import { routeService } from '@/src/services/routeService';
import { Route } from '@/src/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

export default function RoutesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadRoutes(); }, [user]);

  const loadRoutes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await routeService.getDriverRoutes(user.user_id);
      setRoutes(data);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoutes();
    setRefreshing(false);
  };

  // UPDATED: Handle route press with pending transfer check
  const handleRoutePress = (route: Route) => {
    // Check if route is completed but depot transfer not confirmed
    if (route.status === 'completed' && !route.depot_transfer_confirmed) {
      Alert.alert(
        'Pending Depot Transfer',
        'This route is completed but depot transfer is pending. What would you like to do?',
        [
          { 
            text: 'View Route Details', 
            onPress: () => router.push({ pathname: '/route-details', params: { id: route.route_id } } as any)
          },
          { 
            text: 'Go to Depot Transfer', 
            onPress: () => router.push('/depot-transfer' as any)
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      // Normal route details view for all other routes
      router.push({ pathname: '/route-details', params: { id: route.route_id } } as any);
    }
  };

  const getStatusConfig = (route: Route): {
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  } => {
    // ✅ Fully closed out — completed + transferred
    if (route.status === 'completed' && route.depot_transfer_confirmed) {
      return { color: Colors.primary, bg: '#E8F5E9', icon: 'checkmark-done-circle', label: 'TRANSFERRED' };
    }
    // ✅ Completed but transfer pending
    if (route.status === 'completed' && !route.depot_transfer_confirmed) {
      return { color: '#F57F17', bg: '#FFF8E1', icon: 'time', label: 'PENDING TRANSFER' };
    }
    switch (route.status) {
      case 'active':
        return { color: '#F57F17', bg: '#FFF8E1', icon: 'car', label: 'ACTIVE' };
      case 'planned':
        return { color: '#1565C0', bg: '#E3F2FD', icon: 'calendar', label: 'PLANNED' };
      default:
        return { color: '#757575', bg: '#F5F5F5', icon: 'location', label: route.status.toUpperCase() };
    }
  };

  const renderRoute = ({ item }: { item: Route }) => {
    const statusConfig = getStatusConfig(item);
    const isTransferred = item.status === 'completed' && item.depot_transfer_confirmed;
    const isPendingTransfer = item.status === 'completed' && !item.depot_transfer_confirmed;

    return (
      <TouchableOpacity
        style={styles.routeCard}
        onPress={() => handleRoutePress(item)}
        activeOpacity={0.85}
      >
        {/* Header row */}
        <View style={styles.routeCardHeader}>
          <AppText variant="body" style={styles.routeDate}>
            {new Date(item.route_date).toLocaleDateString('en-MY', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })}
          </AppText>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={11} color={statusConfig.color} />
            <AppText variant="caption" style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </AppText>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <AppText variant="body" style={styles.statNumber}>{item.stops?.length || 0}</AppText>
            <AppText variant="caption" style={styles.statLabel}>Stops</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="body" style={styles.statNumber}>
              {item.total_distance_km?.toFixed(1) || '—'}km
            </AppText>
            <AppText variant="caption" style={styles.statLabel}>Distance</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="body" style={styles.statNumber}>
              {item.estimated_duration_min || '—'}m
            </AppText>
            <AppText variant="caption" style={styles.statLabel}>Duration</AppText>
          </View>
          {item.total_volume_collected ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <AppText variant="body" style={styles.statNumber}>
                  {item.total_volume_collected.toFixed(1)}L
                </AppText>
                <AppText variant="caption" style={styles.statLabel}>Collected</AppText>
              </View>
            </>
          ) : null}
        </View>

        {/* ✅ Depot transfer strip — only shown for completed routes */}
        {isTransferred && (
          <View style={styles.transferStrip}>
            <View style={styles.transferStripLeft}>
              <Ionicons name="business" size={14} color={Colors.primary} />
              <AppText variant="caption" style={styles.transferStripTitle}>
                Depot Transfer Complete
              </AppText>
            </View>
            <View style={styles.transferStripRight}>
              {item.depot_transfer_volume ? (
                <View style={styles.transferChip}>
                  <AppText variant="caption" style={styles.transferChipText}>
                    {item.depot_transfer_volume.toFixed(1)}L
                  </AppText>
                </View>
              ) : null}
              {item.depot_transfer_time ? (
                <AppText variant="caption" style={styles.transferTime}>
                  {new Date(item.depot_transfer_time).toLocaleTimeString('en-MY', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                </AppText>
              ) : null}
            </View>
          </View>
        )}

        {/* ✅ Pending transfer warning strip */}
        {isPendingTransfer && (
          <View style={styles.pendingTransferStrip}>
            <Ionicons name="warning-outline" size={14} color="#F57F17" />
            <AppText variant="caption" style={styles.pendingTransferText}>
              Depot transfer not yet completed
            </AppText>
          </View>
        )}

        <View style={styles.viewDetailsRow}>
          <AppText variant="caption" style={styles.viewDetails}>View Details</AppText>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>Loading routes...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
          MY ROUTES
        </AppText>
        <AppText variant="caption" color="#A5D6A7">
          Collection routes history
        </AppText>
      </View>

      <View style={styles.body}>
        {routes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="map-outline" size={48} color={Colors.primary} />
            </View>
            <AppText variant="sectionTitle" style={styles.emptyTitle}>
              No Routes Found
            </AppText>
            <AppText variant="caption" style={styles.emptySubtext}>
              Routes will appear here once they are assigned by dispatch.
            </AppText>
            <AppButton title="Refresh" onPress={onRefresh} variant="pill" />
          </View>
        ) : (
          <FlatList
            data={routes}
            renderItem={renderRoute}
            keyExtractor={(item) => item.route_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
              />
            }
          />
        )}
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
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeDate: {
    fontWeight: '700',
    color: '#1B2A1C',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F8E9',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8F5E9',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#888',
  },

  // ✅ Transfer complete strip
  transferStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  transferStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transferStripTitle: {
    fontWeight: '700',
    color: Colors.primary,
  },
  transferStripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  transferChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  transferTime: {
    color: '#666',
    fontWeight: '500',
  },

  // ✅ Pending transfer strip
  pendingTransferStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  pendingTransferText: {
    color: '#F57F17',
    fontWeight: '600',
  },

  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  viewDetails: {
    color: Colors.primary,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});