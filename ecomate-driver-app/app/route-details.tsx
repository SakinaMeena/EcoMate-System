import { routeService } from '@/src/services/routeService';
import { Route } from '@/src/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

export default function RouteDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ completed: 0, total: 0, percentage: 0 });

  useEffect(() => { loadRouteDetails(); }, [id]);

  const loadRouteDetails = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      setLoading(true);
      const [routeData, progressData] = await Promise.all([
        routeService.getRouteById(id),
        routeService.getRouteProgress(id),
      ]);
      setRoute(routeData);
      setProgress(progressData);
    } catch (error) {
      console.error('Error loading route details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNavigation = async () => {
    if (!route) return;
    const nextStop = await routeService.getCurrentStop(route.route_id);
    if (nextStop) {
      router.push(`/navigate?id=${nextStop.dropoff_id}&routeId=${route.route_id}` as any);
    }
  };

  const handleGoToDepot = () => {
    router.push('/depot-transfer' as any);
  };

  const handlePhonePress = (phone: string, name: string) => {
    Alert.alert(
      name || 'Customer',
      phone,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Number',
          onPress: () => {
            Clipboard.setString(phone);
            Alert.alert('Copied', 'Phone number copied to clipboard');
          },
        },
        {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${phone}`),
        },
      ]
    );
  };

  const getRouteStatusConfig = (status: string): {
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  } => {
    switch (status) {
      case 'active':
        return { color: '#F57F17', bg: '#FFF8E1', icon: 'car', label: 'Active' };
      case 'completed':
        return { color: '#1B5E20', bg: '#E8F5E9', icon: 'checkmark-circle', label: 'Completed' };
      default:
        return { color: '#1565C0', bg: '#E3F2FD', icon: 'calendar', label: 'Planned' };
    }
  };

  const getStopStatusConfig = (status: string): {
    bubbleColor: string;
    badgeBg: string;
    textColor: string;
    label: string;
    borderColor: string;
  } => {
    switch (status) {
      case 'collected':
      case 'reached_depot': // Add reached_depot to show as completed
        return {
          bubbleColor: Colors.primary,
          badgeBg: '#E8F5E9',
          textColor: Colors.primary,
          label: 'Done',
          borderColor: Colors.primary,
        };
      case 'cancelled':
        return {
          bubbleColor: '#888',
          badgeBg: '#F5F5F5',
          textColor: '#888',
          label: 'Skipped',
          borderColor: '#888',
        };
      default:
        return {
          bubbleColor: '#1565C0',
          badgeBg: '#FFF8E1',
          textColor: '#F57F17',
          label: 'Pending',
          borderColor: '#1565C0',
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>Loading route...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!route) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <AppText variant="body" color="#C62828" style={{ marginBottom: 16 }}>
            Route not found
          </AppText>
          <AppButton title="Go Back" onPress={() => router.back()} variant="pill" />
        </View>
      </SafeAreaView>
    );
  }

  const stops = route.stops || [];
  const allStopsDone = progress.total > 0 && progress.completed === progress.total;
  const isCompleted = route.status === 'completed';
  const isPendingTransfer = route.status === 'completed' && !route.depot_transfer_confirmed;
  const routeStatusConfig = getRouteStatusConfig(route.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color="#A5D6A7" />
          <AppText variant="caption" color="#A5D6A7" style={styles.backBtnText}>
            Back
          </AppText>
        </TouchableOpacity>
        <View style={styles.headerBottom}>
          <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
            Route Details
          </AppText>
          <View style={[styles.routeStatusBadge, { backgroundColor: routeStatusConfig.bg }]}>
            <Ionicons name={routeStatusConfig.icon} size={12} color={routeStatusConfig.color} />
            <AppText variant="caption" style={[styles.routeStatusText, { color: routeStatusConfig.color }]}>
              {routeStatusConfig.label}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.card}>
            <AppText variant="sectionTitle" style={styles.routeDate}>
              {new Date(route.route_date).toLocaleDateString('en-MY', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </AppText>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress.percentage}%` as any }]} />
            </View>
            <AppText variant="caption" style={styles.progressText}>
              {progress.completed} of {progress.total} stops completed ({progress.percentage}%)
            </AppText>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statBox}>
              <AppText variant="sectionTitle" style={styles.statNumber}>
                {route.total_distance_km?.toFixed(1) || '—'}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>km</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <AppText variant="sectionTitle" style={styles.statNumber}>
                {route.estimated_duration_min || '—'}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>min</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <AppText variant="sectionTitle" style={styles.statNumber}>
                {stops.length}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>stops</AppText>
            </View>
          </View>

          <AppText variant="caption" style={styles.sectionTitle}>Route Stops</AppText>

          {stops.map((stop: any, index: number) => {
            const stopConfig = getStopStatusConfig(stop.status);
            return (
              <View
                key={stop.dropoff_id}
                style={[
                  styles.stopCard,
                  { borderLeftColor: stopConfig.borderColor },
                  (stop.status === 'collected' || stop.status === 'reached_depot' || stop.status === 'cancelled') && styles.stopCardMuted,
                ]}
              >
                <View style={styles.stopCardLeft}>
                  <View style={[styles.stopNumberBubble, { backgroundColor: stopConfig.bubbleColor }]}>
                    <AppText style={styles.stopNumberText}>{index + 1}</AppText>
                  </View>
                </View>
                <View style={styles.stopCardRight}>
                  <View style={styles.stopCardTopRow}>
                    <AppText variant="body" style={styles.stopAddress} numberOfLines={2}>
                      {stop.user_address || 'Address not available'}
                    </AppText>
                    <View style={[styles.stopStatusBadge, { backgroundColor: stopConfig.badgeBg }]}>
                      <AppText variant="caption" style={[styles.stopStatusText, { color: stopConfig.textColor }]}>
                        {stopConfig.label}
                      </AppText>
                    </View>
                  </View>

                  <AppText variant="caption" style={styles.stopVolume}>
                    Est: {stop.estimated_volume || 0}L
                    {stop.actual_volume ? `  ·  Actual: ${stop.actual_volume}L` : ''}
                  </AppText>

                  {stop.user_phone && (
                    <TouchableOpacity
                      style={styles.phoneRow}
                      onPress={() => handlePhonePress(stop.user_phone, stop.user_name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call-outline" size={13} color={Colors.primary} />
                      <AppText variant="caption" style={styles.phoneText}>
                        {stop.user_phone}
                      </AppText>
                      <Ionicons name="chevron-forward" size={11} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Pending Transfer Section - Add this before the actions area */}
          {isPendingTransfer && (
            <View style={styles.pendingTransferSection}>
              <View style={styles.pendingTransferHeader}>
                <Ionicons name="warning-outline" size={20} color="#F57F17" />
                <AppText variant="body" style={styles.pendingTransferTitle}>
                  Depot Transfer Pending
                </AppText>
              </View>
              <AppText variant="caption" style={styles.pendingTransferDescription}>
                This route is completed but the oil hasn't been transferred to the depot yet.
              </AppText>
              <TouchableOpacity 
                style={styles.completeTransferBtn}
                onPress={handleGoToDepot}
              >
                <Ionicons name="business-outline" size={18} color="#FFFFFF" />
                <AppText variant="button" style={styles.completeTransferBtnText}>
                  Complete Depot Transfer Now
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {!isCompleted && (
            <View style={styles.actionsArea}>
              {allStopsDone ? (
                <TouchableOpacity style={styles.depotBtn} onPress={handleGoToDepot}>
                  <Ionicons name="business" size={18} color="#FFFFFF" />
                  <AppText variant="button" style={styles.depotBtnText}>Go to Depot Transfer</AppText>
                </TouchableOpacity>
              ) : (
                <AppButton
                  title={route.status === 'active' ? 'Continue Navigation' : 'Start Route'}
                  onPress={handleStartNavigation}
                  variant="pill"
                  fullWidth
                />
              )}
            </View>
          )}

          {isCompleted && route.depot_transfer_confirmed && (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              <AppText variant="body" color={Colors.primary} style={styles.completedBannerText}>
                Route Completed
              </AppText>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  centered: { justifyContent: 'center', alignItems: 'center' },
  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backBtnText: { fontWeight: '600' },
  headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { letterSpacing: 0.5, marginBottom: 0 },
  routeStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  routeStatusText: { fontWeight: '700' },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  routeDate: { marginBottom: 14, color: '#1B2A1C' },
  progressBarBg: {
    height: 8, backgroundColor: '#E8F5E9', borderRadius: 4,
    overflow: 'hidden', marginBottom: 8,
  },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progressText: { color: '#777' },
  statsCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 10, marginBottom: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E8F5E9', alignSelf: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  statLabel: { textTransform: 'uppercase', letterSpacing: 0.3, color: '#888' },
  sectionTitle: {
    fontWeight: '700', color: '#1B2A1C', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10,
  },
  stopCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', marginBottom: 10,
    borderRadius: 14, padding: 14, borderLeftWidth: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  stopCardMuted: { opacity: 0.72 },
  stopCardLeft: { marginRight: 12, justifyContent: 'flex-start', paddingTop: 2 },
  stopNumberBubble: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stopNumberText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  stopCardRight: { flex: 1 },
  stopCardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  stopAddress: { fontWeight: '600', color: '#1B2A1C', flex: 1, marginRight: 8, lineHeight: 18 },
  stopStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stopStatusText: { fontWeight: '700' },
  stopVolume: { color: '#888', marginBottom: 4 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F8E9',
  },
  phoneText: { flex: 1, color: Colors.primary, fontWeight: '600' },
  actionsArea: { marginTop: 8, marginBottom: 14 },
  depotBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F57F17', padding: 17, borderRadius: 14,
    shadowColor: '#F57F17', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  depotBtnText: { color: '#FFFFFF' },
  
  // New styles for pending transfer section
  pendingTransferSection: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 18,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F57F17',
  },
  pendingTransferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pendingTransferTitle: {
    fontWeight: '700',
    color: '#F57F17',
  },
  pendingTransferDescription: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  completeTransferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F57F17',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#F57F17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  completeTransferBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 8, marginBottom: 14, backgroundColor: '#E8F5E9',
    padding: 16, borderRadius: 14,
  },
  completedBannerText: { fontWeight: '700' },
});