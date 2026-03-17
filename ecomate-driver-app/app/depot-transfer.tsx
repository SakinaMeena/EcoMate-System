import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { routeService } from '@/src/services/routeService';
import { Route } from '@/src/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const SUPABASE_URL = "https://olixlbwdwlbmuratrirh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saXhsYndkd2xibXVyYXRyaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTY2NTIsImV4cCI6MjA4NTA3MjY1Mn0.uZevC4odhghtgbGe9MVA06Nv7VXtXXpQCkatjkrc8wBzZ_g8_M";

type TransferStep = 'idle' | 'out' | 'reached' | 'confirmed';

export default function DepotTransferScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [route, setRoute] = useState<Route | null>(null);
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [transferStep, setTransferStep] = useState<TransferStep>('idle');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  //Batch_id stored after log-bulk-departure
  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => { loadActiveRoute(); }, [user]);

  const loadActiveRoute = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const activeRoute = await routeService.getTodayRoute(user.user_id);
      setRoute(activeRoute);

      if (activeRoute) {
        if (activeRoute.depot_transfer_confirmed) {
          setTransferStep('confirmed');
        }

        // ✅ Only sum dropoffs belonging to THIS route
        const routeDropoffIds = (activeRoute.stops || [])
          .map((s: any) => s.dropoff_id)
          .filter(Boolean);

        let vol = 0;
        if (routeDropoffIds.length > 0) {
          const { data: dropoffs } = await supabase
            .from('dropoffs')
            .select('actual_volume')
            .in('dropoff_id', routeDropoffIds)
            .eq('status', 'collected');

          vol = (dropoffs || []).reduce(
            (sum: number, d: any) => sum + (d.actual_volume || 0), 0
          );
        }
        setTotalVolume(vol);
      }
    } catch (error) {
      console.error('Error loading active route:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTransfer = async () => {
    if (!route) return;
    console.log('user object:', JSON.stringify(user));
    Alert.alert(
      'Start Depot Transfer',
      `You are about to transfer ${totalVolume.toFixed(1)}L of UCO to your assigned depot. Confirm?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            try {
              const success = await routeService.startDepotTransfer(route.route_id, totalVolume);

              if (success) {
                try {
                  const response = await fetch(
                    `https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-bulk-departure-v3`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saXhsYndkd2xibXVyYXRyaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTY2NTIsImV4cCI6MjA4NTA3MjY1Mn0.uZevC4oGe9MVA06Nv7VXtXXpQCkatjkrc8wBzZ_g8_M`,
                      },
                      body: JSON.stringify({
                        actor_email: user?.email,
                        actor_role: 'driver',
                        total_volume: totalVolume,
                        depot_id: user?.depot_id,
                      }),
                    }
                  );
                  const data = await response.json();
                  console.log('log-bulk-departure response:', JSON.stringify(data));

                  if (data.success && data.batch_id) {
                    setBatchId(data.batch_id); //Stores for confirm-depot-arrival
                  }
                } catch (apiErr) {
                  console.error('log-bulk-departure error:', apiErr);
                  // Non-blocking doesn't fail flow if API has issues
                }

                setTransferStep('out');
              } else {
                Alert.alert('Error', 'Could not start transfer. Please try again.');
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReachedDepot = () => {
    // ✅ Her existing logic — unchanged, just UI state
    Alert.alert(
      'Reached Depot?',
      'Confirm you have arrived at the depot.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: "Yes, I've Arrived", onPress: () => setTransferStep('reached') },
      ]
    );
  };

  const handleFinishTransfer = async () => {
    if (!route) return;
    Alert.alert(
      'Finish Transfer',
      "Confirm that the oil has been handed over to the depot. This will complete today's route.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            setActionLoading(true);
            try {
              // ✅ Her existing logic — unchanged
              const success = await routeService.confirmDepotTransfer(route.route_id);

              if (success) {
                // ✅ Our confirm-depot-arrival-3 API call — added alongside her logic
                if (batchId) {
                  try {
                    const response = await fetch(
                      `https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/confirm-depot-arrival-3`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9saXhsYndkd2xibXVyYXRyaXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTY2NTIsImV4cCI6MjA4NTA3MjY1Mn0.uZevC4oGe9MVA06Nv7VXtXXpQCkatjkrc8wBzZ_g8_M`,
                        },
                        body: JSON.stringify({
                          actor_email: user?.email,
                          actor_role: 'driver',
                          batch_id: batchId,
                          depot_id: user?.depot_id,
                        }),
                      }
                    );
                    const data = await response.json();
                    console.log('confirm-depot-arrival response:', JSON.stringify(data));
                  } catch (apiErr) {
                    console.error('confirm-depot-arrival error:', apiErr);
                    // ✅ Non-blocking — don't fail her flow if our API has issues
                  }
                }

                setTransferStep('confirmed');
              } else {
                Alert.alert('Error', 'Could not confirm transfer. Please try again.');
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>
            Loading transfer details...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!route) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#A5D6A7" />
            <AppText variant="caption" color="#A5D6A7" style={styles.backBtnText}>Back</AppText>
          </TouchableOpacity>
          <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
            Depot Transfer
          </AppText>
        </View>
        <View style={[styles.body, styles.centered]}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="close-circle-outline" size={44} color={Colors.primary} />
          </View>
          <AppText variant="sectionTitle" style={styles.emptyTitle}>No Active Route</AppText>
          <AppText variant="caption" style={styles.emptySubtext}>
            You need an active route to perform a depot transfer.
          </AppText>
          <AppButton title="Back to Dashboard" onPress={() => router.back()} variant="pill" />
        </View>
      </SafeAreaView>
    );
  }

  const renderStepIndicator = () => {
    const steps = ['Out', 'Reached', 'Finish'];
    const currentIndex =
      transferStep === 'idle' ? -1 :
      transferStep === 'out' ? 0 :
      transferStep === 'reached' ? 1 : 2;

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                index <= currentIndex ? styles.stepCircleActive : styles.stepCircleInactive,
              ]}>
                {index < currentIndex ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : (
                  <AppText style={[
                    styles.stepCircleText,
                    index <= currentIndex
                      ? styles.stepCircleTextActive
                      : styles.stepCircleTextInactive,
                  ]}>
                    {(index + 1).toString()}
                  </AppText>
                )}
              </View>
              <AppText variant="caption" style={[
                styles.stepLabel,
                index <= currentIndex ? styles.stepLabelActive : styles.stepLabelInactive,
              ]}>
                {step}
              </AppText>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                index < currentIndex ? styles.stepLineActive : styles.stepLineInactive,
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const getActionConfig = (): {
    title: string;
    subtitle: string;
    btnLabel: string;
    btnColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  } | null => {
    switch (transferStep) {
      case 'idle':
        return {
          title: 'Ready to Transfer?',
          subtitle: 'When you are ready to leave for the depot, tap the button below.',
          btnLabel: 'Start Transfer',
          btnColor: Colors.primary,
          icon: 'car-outline',
          onPress: handleStartTransfer,
        };
      case 'out':
        return {
          title: 'En Route to Depot',
          subtitle: 'Drive safely to your depot. Tap below once you have arrived.',
          btnLabel: 'Reached Depot',
          btnColor: '#F57F17',
          icon: 'location-outline',
          onPress: handleReachedDepot,
        };
      case 'reached':
        return {
          title: 'Arrived at Depot',
          subtitle: 'Confirm the oil has been handed over to complete the transfer.',
          btnLabel: 'Finish Transfer',
          btnColor: '#2E7D32',
          icon: 'checkmark-circle-outline',
          onPress: handleFinishTransfer,
        };
      default:
        return null;
    }
  };

  const actionConfig = getActionConfig();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color="#A5D6A7" />
          <AppText variant="caption" color="#A5D6A7" style={styles.backBtnText}>Back</AppText>
        </TouchableOpacity>
        <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
          Depot Transfer
        </AppText>
      </View>

      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {transferStep !== 'confirmed' && (
            <View style={styles.card}>
              {renderStepIndicator()}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <AppText variant="caption" style={styles.cardTitle}>Transfer Summary</AppText>
            </View>

            <View style={styles.infoRow}>
              <AppText variant="caption" style={styles.infoLabel}>Route Date</AppText>
              <AppText variant="caption" style={styles.infoValue}>
                {new Date(route.route_date).toLocaleDateString('en-MY', {
                  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </AppText>
            </View>

            <View style={styles.infoRow}>
              <AppText variant="caption" style={styles.infoLabel}>Stops Completed</AppText>
              <AppText variant="caption" style={styles.infoValue}>
                {(route.stops || []).filter((s: any) => s.status === 'collected').length}
                {' / '}
                {(route.stops || []).length}
              </AppText>
            </View>

            <View style={styles.volumeHighlight}>
              <AppText variant="caption" style={styles.volumeLabel}>
                Total UCO to Transfer
              </AppText>
              <AppText
                style={styles.volumeNumber}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {totalVolume.toFixed(1)}L
              </AppText>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <AppText variant="caption" style={styles.infoLabel}>Destination Depot</AppText>
              <AppText variant="caption" style={styles.infoValue}>
                {user?.depot_id || 'Your Assigned Depot'}
              </AppText>
            </View>
          </View>

          {transferStep === 'confirmed' ? (
            <View style={[styles.card, styles.confirmedCard]}>
              <View style={styles.confirmedIconWrap}>
                <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
              </View>
              <AppText variant="sectionTitle" color={Colors.primary} style={styles.confirmedTitle}>
                Transfer Complete!
              </AppText>
              <AppText variant="caption" style={styles.confirmedSubtext}>
                {totalVolume.toFixed(1)}L of UCO has been successfully transferred to your depot.
              </AppText>
              <AppText variant="caption" style={styles.confirmedSubtext}>
                Today's route is now complete.
              </AppText>
              <View style={styles.confirmedBtnWrapper}>
                <AppButton
                  title="Back to Dashboard"
                  onPress={() => router.replace('/(tabs)' as any)}
                  variant="pill"
                  fullWidth
                />
              </View>
            </View>
          ) : (
            actionConfig && (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name={actionConfig.icon} size={16} color={actionConfig.btnColor} />
                  <AppText variant="caption" style={[styles.cardTitle, { color: actionConfig.btnColor }]}>
                    {actionConfig.title}
                  </AppText>
                </View>
                <AppText variant="caption" style={styles.cardSubtext}>
                  {actionConfig.subtitle}
                </AppText>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: actionConfig.btnColor }]}
                  onPress={actionConfig.onPress}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name={actionConfig.icon} size={18} color="#FFFFFF" />
                      <AppText variant="caption" style={styles.actionBtnText}>
                        {actionConfig.btnLabel}
                      </AppText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backBtnText: { fontWeight: '600' },
  headerTitle: { letterSpacing: 1, marginBottom: 0 },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontWeight: '700', color: '#1B2A1C', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSubtext: { color: '#777', marginBottom: 18, lineHeight: 19 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepCircleActive: { backgroundColor: Colors.primary },
  stepCircleInactive: { backgroundColor: '#E0E0E0' },
  stepCircleText: { fontSize: 14, fontWeight: '700' },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepCircleTextInactive: { color: '#999' },
  stepLabel: { fontWeight: '700', letterSpacing: 0.5 },
  stepLabelActive: { color: Colors.primary },
  stepLabelInactive: { color: '#BDBDBD' },
  stepLine: { flex: 1, height: 2, marginBottom: 22, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLineInactive: { backgroundColor: '#E0E0E0' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F8E9',
  },
  infoLabel: { color: '#888' },
  infoValue: { fontWeight: '600', color: '#1B2A1C', maxWidth: '55%', textAlign: 'right' },
  volumeHighlight: {
    backgroundColor: '#E8F5E9', borderRadius: 12, paddingVertical: 24,
    paddingHorizontal: 20, alignItems: 'center', marginVertical: 14,
  },
  volumeLabel: { color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  volumeNumber: { fontSize: 52, fontWeight: '900', color: Colors.primary, lineHeight: 60, includeFontPadding: false },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 17, borderRadius: 14,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  confirmedCard: { alignItems: 'center', paddingVertical: 28 },
  confirmedIconWrap: { marginBottom: 14 },
  confirmedTitle: { marginBottom: 10 },
  confirmedSubtext: { color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  confirmedBtnWrapper: { marginTop: 20, width: '100%' },
  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 20, backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { marginBottom: 8, color: '#1B2A1C' },
  emptySubtext: { textAlign: 'center', color: '#888', lineHeight: 20, marginBottom: 24 },
});