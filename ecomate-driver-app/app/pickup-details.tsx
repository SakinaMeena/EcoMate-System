import { useAuth } from '@/src/contexts/AuthContext';
import { pickupService } from '@/src/services/pickupService';
import { routeService } from '@/src/services/routeService';
import { Pickup } from '@/src/types';
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
import AppInput from '@/components/AppInput';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

const SUPABASE_URL = "https://olixlbwdwlbmuratrirh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saXhsYndkd2xibXVyYXRyaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTY2NTIsImV4cCI6MjA4NTA3MjY1Mn0.uZevC4odhghtgbGe9MVA06Nv7VXtXXpQCkatjkrc8wBzZ_g8_M";

export default function PickupDetailsScreen() {
  const { id, routeId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [actualVolume, setActualVolume] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadPickupDetails(); }, [id]);

  const loadPickupDetails = async () => {
    const pickupId = Array.isArray(id) ? id[0] : id;
    if (!pickupId) return;
    try {
      setLoading(true);
      const data = await pickupService.getPickupById(pickupId);
      setPickup(data);
    } catch (error) {
      console.error('Error loading pickup:', error);
    } finally {
      setLoading(false);
    }
  };

  const goBackToRoute = () => {
    const rId = Array.isArray(routeId) ? routeId[0] : routeId;
    setTimeout(() => {
      if (rId) {
        router.replace(`/route-details?id=${rId}` as any);
      } else {
        router.back();
      }
    }, 300);
  };

  const checkAndCompleteRoute = async () => {
    const rId = Array.isArray(routeId) ? routeId[0] : routeId;
    if (!rId) return;
    try {
      const currentStop = await routeService.getCurrentStop(rId);
      if (!currentStop) {
        await routeService.completeRoute(rId);
      }
    } catch (error) {
      console.error('Error checking route completion:', error);
    }
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

  const handleConfirmCollection = async () => {
    if (!pickup || !user) return;
    const volume = parseFloat(actualVolume);
    if (!volume || volume <= 0) {
      Alert.alert('Invalid Volume', 'Please enter a valid volume amount');
      return;
    }
    Alert.alert(
      'Confirm Collection',
      `Confirm ${volume}L of UCO collected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setSubmitting(true);
              
              const success = await pickupService.completePickup(
                pickup.dropoff_id, volume, user.user_id
              );

              if (success) {
                //API call to log-home-pickup
                try {
                  const response = await fetch(
                    `https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-pickup-2`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saXhsYndkd2xibXVyYXRyaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTY2NTIsImV4cCI6MjA4NTA3MjY1Mn0.uZevC4oGe9MVA06Nv7VXtXXpQCkatjkrc8wBzZ_g8_M`,
                      },
                      body: JSON.stringify({
                        actor_email: user.email,
                        user_email: pickup.user_email ?? pickup.user_email ?? null,
                        estimated_volume: pickup.estimated_volume,
                        actual_volume: volume,
                        location: {
                          lat: pickup.user_lat ?? 0,
                          lon: pickup.user_lon ?? 0,
                        },
                      }),
                    }
                  );
                  const data = await response.json();
                  console.log('log-home-pickup response:', JSON.stringify(data));
                } catch (apiErr) {
                  console.error('log-home-pickup error:', apiErr);
                  // Non-blocking doesn't fail the flow if API has issues
                }

                await checkAndCompleteRoute();
                goBackToRoute();
              } else {
                Alert.alert('Error', 'Failed to complete pickup');
                setSubmitting(false);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to complete pickup');
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleSkipStop = () => {
    Alert.alert(
      'Skip Stop',
      'Why are you skipping this stop?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'User Not Available', onPress: () => skipStop() },
        { text: 'Wrong Address', onPress: () => skipStop() },
        { text: 'Other', onPress: () => skipStop() },
      ]
    );
  };

  const skipStop = async () => {
    if (!pickup) return;
    try {
      await pickupService.updatePickupStatus(pickup.dropoff_id, 'cancelled');
      await checkAndCompleteRoute();
      goBackToRoute();
    } catch (error) {
      Alert.alert('Error', 'Failed to skip stop');
    }
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report Issue',
      'What is the issue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contaminated Oil', onPress: () => reportIssue() },
        { text: 'Access Problem', onPress: () => reportIssue() },
        { text: 'Safety Concern', onPress: () => reportIssue() },
      ]
    );
  };

  const reportIssue = async () => {
    if (!pickup) return;
    try {
      await pickupService.updatePickupStatus(pickup.dropoff_id, 'cancelled');
      await checkAndCompleteRoute();
      goBackToRoute();
    } catch (error) {
      Alert.alert('Error', 'Failed to report issue');
    }
  };

  const getStatusConfig = (status: string): {
    color: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  } => {
    switch (status) {
      case 'collected':
        return { color: Colors.primary, bg: '#E8F5E9', icon: 'checkmark-circle', label: 'Collected' };
      case 'cancelled':
        return { color: '#C62828', bg: '#FFEBEE', icon: 'close-circle', label: 'Cancelled' };
      case 'in_progress':
        return { color: '#F57F17', bg: '#FFF8E1', icon: 'car', label: 'In Progress' };
      case 'reached_depot':
        return { color: '#388E3C', bg: '#E8F5E9', icon: 'home', label: 'Reached Depot' };
      default:
        return { color: '#1565C0', bg: '#E3F2FD', icon: 'calendar', label: 'Scheduled' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>
            Loading pickup details...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!pickup) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <AppText variant="body" color="#C62828" style={{ marginBottom: 16 }}>
            Pickup not found
          </AppText>
          <AppButton title="Go Back" onPress={() => router.back()} variant="pill" />
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted =
    pickup.status === 'collected' ||
    pickup.status === 'reached_depot' ||
    pickup.status === 'cancelled';

  const statusConfig = getStatusConfig(pickup.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={goBackToRoute} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color="#A5D6A7" />
          <AppText variant="caption" color="#A5D6A7" style={styles.backBtnText}>
            Back to Route
          </AppText>
        </TouchableOpacity>
        <View style={styles.headerBottom}>
          <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
            Pickup Details
          </AppText>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
            <AppText variant="caption" style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Location + phone */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <AppText variant="caption" style={styles.cardTitle}>Location</AppText>
            </View>
            <AppText variant="body" style={styles.cardBody}>
              {pickup.user_address || 'Address not available'}
            </AppText>
            {pickup.user_phone && (
              <TouchableOpacity
                style={styles.phoneRow}
                onPress={() => handlePhonePress(pickup.user_phone!, pickup.user_name || '')}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={14} color={Colors.primary} />
                <AppText variant="caption" style={styles.phoneText}>
                  {pickup.user_phone}
                </AppText>
                <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Volume info */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
              <AppText variant="caption" style={styles.cardTitle}>Volume Information</AppText>
            </View>
            <View style={styles.infoRow}>
              <AppText variant="caption" style={styles.infoLabel}>Estimated Volume</AppText>
              <AppText variant="body" style={styles.infoValue}>{pickup.estimated_volume}L</AppText>
            </View>
            {pickup.actual_volume ? (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <AppText variant="caption" style={styles.infoLabel}>Actual Volume</AppText>
                <AppText variant="body" style={[styles.infoValue, { color: Colors.primary }]}>
                  {pickup.actual_volume}L
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Time window */}
          {pickup.time_window_start && pickup.time_window_end && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <AppText variant="caption" style={styles.cardTitle}>Time Window</AppText>
              </View>
              <AppText variant="body" style={styles.cardBody}>
                {pickup.time_window_start} – {pickup.time_window_end}
              </AppText>
            </View>
          )}

          {/* Collection form */}
          {!isCompleted && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <AppText variant="caption" style={styles.cardTitle}>Collection Details</AppText>
              </View>
              <AppInput
                label="Actual Volume Collected (Litres)"
                placeholder="Enter volume in litres"
                keyboardType="decimal-pad"
                value={actualVolume}
                onChangeText={setActualVolume}
                icon="water-outline"
              />
            </View>
          )}

          {/* Action buttons */}
          {!isCompleted && (
            <View style={styles.actionsArea}>
              <AppButton
                title={submitting ? 'Confirming...' : 'Confirm Collection'}
                onPress={handleConfirmCollection}
                variant="pill"
                fullWidth
                disabled={submitting}
              />
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={handleSkipStop}
                  disabled={submitting}
                >
                  <Ionicons name="play-skip-forward" size={14} color="#FFFFFF" />
                  <AppText variant="caption" style={styles.secondaryBtnText}>
                    Skip Stop
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.issueBtn}
                  onPress={handleReportIssue}
                  disabled={submitting}
                >
                  <Ionicons name="warning-outline" size={14} color="#FFFFFF" />
                  <AppText variant="caption" style={styles.secondaryBtnText}>
                    Report Issue
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Completed state */}
          {isCompleted && (
            <View style={styles.completedCard}>
              <View style={styles.completedIconWrap}>
                <Ionicons
                  name={pickup.status === 'cancelled' ? 'close-circle' : 'checkmark-circle'}
                  size={56}
                  color={pickup.status === 'cancelled' ? '#C62828' : Colors.primary}
                />
              </View>
              <AppText
                variant="sectionTitle"
                color={pickup.status === 'cancelled' ? '#C62828' : Colors.primary}
                style={styles.completedTitle}
              >
                {pickup.status === 'cancelled' ? 'Stop Skipped' : 'Pickup Completed'}
              </AppText>
              {pickup.status !== 'cancelled' && (
                <AppText variant="caption" style={styles.completedSubtext}>
                  Collected {pickup.actual_volume}L on{' '}
                  {pickup.collected_at
                    ? new Date(pickup.collected_at).toLocaleDateString('en-MY', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : 'N/A'}
                </AppText>
              )}
              <View style={{ marginTop: 20, width: '100%' }}>
                <AppButton
                  title="Back to Route"
                  onPress={goBackToRoute}
                  variant="pill"
                  fullWidth
                />
              </View>
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
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusBadgeText: { fontWeight: '700' },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: {
    fontWeight: '700', color: '#1B2A1C',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardBody: { color: '#444', lineHeight: 22, marginBottom: 4 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F8E9',
  },
  phoneText: { flex: 1, color: Colors.primary, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  infoLabel: { color: Colors.mutedText },
  infoValue: { fontWeight: '700', color: '#1B2A1C' },
  actionsArea: { marginBottom: 14, gap: 10 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#F57F17', padding: 14, borderRadius: 12,
  },
  issueBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#C62828', padding: 14, borderRadius: 12,
  },
  secondaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  completedCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 28, marginBottom: 14,
    alignItems: 'center', shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  completedIconWrap: { marginBottom: 12 },
  completedTitle: { marginBottom: 6 },
  completedSubtext: { textAlign: 'center', color: Colors.mutedText, lineHeight: 20 },
});