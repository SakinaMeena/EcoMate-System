import { useAuth } from '@/src/contexts/AuthContext';
import { pickupService } from '@/src/services/pickupService';
import { Pickup } from '@/src/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

type Tab = 'active' | 'history';

export default function PickupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activePickups, setActivePickups] = useState<Pickup[]>([]);
  const [historyPickups, setHistoryPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('active');

  useEffect(() => { loadPickups(); }, [user]);

  const loadPickups = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [assigned, history] = await Promise.all([
        pickupService.getAssignedPickups(user.user_id),
        pickupService.getCollectionHistory(user.user_id),
      ]);
      setActivePickups(assigned);
      setHistoryPickups(history);
    } catch (error) {
      console.error('Error loading pickups:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPickups();
    setRefreshing(false);
  };

  const handlePickupPress = (pickup: Pickup) => {
    router.push(`/pickup-details?id=${pickup.dropoff_id}` as any);
  };

  const getStatusConfig = (status: string): {
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  } => {
    switch (status) {
      case 'collected':
        return { color: '#1B5E20', bg: '#E8F5E9', icon: 'checkmark-circle', label: 'COLLECTED' };
      case 'in_progress':
        return { color: '#F57F17', bg: '#FFF8E1', icon: 'car', label: 'IN PROGRESS' };
      case 'assigned':
      case 'reached_depot':
        return { color: Colors.primary, bg: Colors.ecoTileBg, icon: 'business', label: 'AT DEPOT' };
      case 'scheduled':
        return { color: '#1565C0', bg: '#E3F2FD', icon: 'calendar', label: 'SCHEDULED' };
      case 'cancelled':
        return { color: '#C62828', bg: '#FFEBEE', icon: 'close-circle', label: 'CANCELLED' };
      default:
        return { color: '#757575', bg: '#F5F5F5', icon: 'location', label: status.toUpperCase() };
    }
  };

  const renderPickup = ({ item }: { item: Pickup }) => {
    const statusConfig = getStatusConfig(item.status);
    return (
      <TouchableOpacity
        style={styles.pickupCard}
        onPress={() => handlePickupPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.pickupCardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} style={styles.statusIcon} />
            <AppText variant="caption" style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </AppText>
          </View>
          {activeTab === 'active' && item.scheduled_for && (
            <AppText variant="caption" style={styles.dateText}>
              {new Date(item.scheduled_for).toLocaleDateString('en-MY', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </AppText>
          )}
          {activeTab === 'history' && item.collected_at && (
            <AppText variant="caption" style={styles.dateText}>
              {new Date(item.collected_at).toLocaleDateString('en-MY', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </AppText>
          )}
        </View>

        <AppText variant="body" style={styles.address} numberOfLines={2}>
          {item.user_address || 'Address not available'}
        </AppText>

        <View style={styles.volumeRow}>
          <View style={styles.volumeChip}>
            <AppText variant="caption" style={styles.volumeChipLabel}>Est.</AppText>
            <AppText variant="body" style={styles.volumeChipValue}>{item.estimated_volume}L</AppText>
          </View>
          {item.actual_volume ? (
            <View style={[styles.volumeChip, styles.volumeChipActual]}>
              <AppText variant="caption" style={styles.volumeChipLabel}>Actual</AppText>
              <AppText variant="body" style={[styles.volumeChipValue, { color: Colors.primary }]}>
                {item.actual_volume}L
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.viewDetailsRow}>
          <AppText variant="caption" style={styles.viewDetails}>View Details</AppText>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const currentData = activeTab === 'active' ? activePickups : historyPickups;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>Loading pickups...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
          MY PICKUPS
        </AppText>
        <AppText variant="caption" color="#A5D6A7">
          {activeTab === 'active' ? 'Assigned collection tasks' : 'Completed collection history'}
        </AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <AppText variant="caption" style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active{activePickups.length > 0 ? ` (${activePickups.length})` : ''}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <AppText variant="caption" style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History{historyPickups.length > 0 ? ` (${historyPickups.length})` : ''}
            </AppText>
          </TouchableOpacity>
        </View>

        {currentData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name={activeTab === 'active' ? 'cube-outline' : 'document-text-outline'}
                size={48}
                color={Colors.primary}
              />
            </View>
            <AppText variant="sectionTitle" style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No Active Pickups' : 'No History Yet'}
            </AppText>
            <AppText variant="caption" style={styles.emptySubtext}>
              {activeTab === 'active'
                ? 'Pickups will appear here once assigned by dispatch.'
                : 'Completed pickups will appear here once you start collecting.'}
            </AppText>
            <AppButton title="Refresh" onPress={onRefresh} variant="pill" />
          </View>
        ) : (
          <FlatList
            data={currentData}
            renderItem={renderPickup}
            keyExtractor={(item) => item.dropoff_id}
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
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pickupCard: {
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
  pickupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusIcon: {
    marginRight: 2,
  },
  statusBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateText: {
    fontWeight: '500',
    color: '#888',
  },
  address: {
    fontWeight: '600',
    color: '#1B2A1C',
    marginBottom: 12,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  volumeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  volumeChipActual: {
    backgroundColor: '#E8F5E9',
  },
  volumeChipLabel: {
    color: '#888',
    fontWeight: '500',
  },
  volumeChipValue: {
    fontWeight: '700',
    color: '#1B2A1C',
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