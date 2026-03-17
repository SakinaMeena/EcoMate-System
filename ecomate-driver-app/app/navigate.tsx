import { useLocation } from '@/src/hooks/useLocation';
import { pickupService } from '@/src/services/pickupService';
import { Pickup } from '@/src/types';
import Mapbox from '@/src/utils/mapbox';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

const { MapView, Camera, MarkerView, ShapeSource, LineLayer, UserLocation } = Mapbox;

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: string;
}

export default function NavigateScreen() {
  const { id, routeId } = useLocalSearchParams();
  const router = useRouter();
  const { location } = useLocation();

  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [distanceToNext, setDistanceToNext] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [directionsFetched, setDirectionsFetched] = useState(false);

  useEffect(() => {
    loadNavigationData();
  }, [id]);

  // ✅ Fetch directions once both location AND pickup are ready
  useEffect(() => {
    if (
      !directionsFetched &&
      location &&
      pickup?.latitude &&
      pickup?.longitude
    ) {
      setDirectionsFetched(true);
      fetchDirections(
        location.longitude,
        location.latitude,
        pickup.longitude!,
        pickup.latitude!
      );
    }
  }, [location, pickup, directionsFetched]);

  // Advance to next step when close to a turn
  useEffect(() => {
    if (location && steps.length > 0) {
      calculateDistanceToNextTurn();
    }
  }, [location]);

  const loadNavigationData = async () => {
    // ✅ Handle string[] from Expo Router
    const pickupId = Array.isArray(id) ? id[0] : id;
    if (!pickupId) return;
    try {
      setLoading(true);
      // Reset all stale state from previous stop
      setRouteGeometry(null);
      setSteps([]);
      setCurrentStepIndex(0);
      setDistanceToNext(0);
      setEta(0);
      setDirectionsFetched(false);

      const pickupData = await pickupService.getPickupById(pickupId);
      setPickup(pickupData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load navigation data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirections = async (
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number
  ) => {
    try {
      const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!MAPBOX_TOKEN) {
        console.error('Mapbox token missing — check EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
        return;
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      console.log('Fetching directions...');

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteGeometry({ type: 'Feature', geometry: route.geometry });

        const routeSteps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          duration: step.duration,
          maneuver: step.maneuver.type,
        }));

        setSteps(routeSteps);
        setEta(Math.round(route.duration)); // duration in seconds
        setDistanceToNext(routeSteps[0]?.distance || 0);
        console.log('Directions ready — steps:', routeSteps.length, 'ETA:', Math.round(route.duration / 60), 'min');
      } else {
        console.warn('No routes returned:', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
    }
  };

  const calculateDistanceToNextTurn = () => {
    if (!steps[currentStepIndex]) return;
    setDistanceToNext(steps[currentStepIndex].distance);
    if (
      steps[currentStepIndex].distance < 20 &&
      currentStepIndex < steps.length - 1
    ) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const getManeuverIcon = (maneuver: string): keyof typeof Ionicons.glyphMap => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      'turn-left': 'arrow-back',
      'turn-right': 'arrow-forward',
      'sharp-left': 'return-up-back',
      'sharp-right': 'return-up-forward',
      'straight': 'arrow-up',
      'uturn': 'refresh',
      'arrive': 'location',
      'depart': 'navigate',
    };
    return icons[maneuver] || 'arrow-up';
  };

  const formatDistance = (metres: number) =>
    metres >= 1000
      ? `${(metres / 1000).toFixed(1)} km`
      : `${Math.round(metres)} m`;

  // ✅ Fix: handle string[] for both id and routeId
  const handleArrived = () => {
    const rId = Array.isArray(routeId) ? routeId[0] : routeId;
    const pId = Array.isArray(id) ? id[0] : id;
    console.log('Arrived — pickupId:', pId, 'routeId:', rId);
    router.replace(`/pickup-details?id=${pId}&routeId=${rId}` as any);
  };

  const handleEndNavigation = () => {
    Alert.alert('End Navigation', 'Stop navigation and return to route?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (loading || !pickup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <AppText variant="caption" style={styles.loadingText}>
          Loading navigation...
        </AppText>
      </View>
    );
  }

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <View style={styles.container} pointerEvents="box-none">

      {/* ── Map layer — full screen, handles gestures ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
        <MapView
          style={styles.map}
          //locationEnabled={true}
          compassEnabled={false}
        >
          {/* followUserLocation keeps camera on driver, not origin */}
          <Camera
            zoomLevel={16}
            followUserLocation={true}
            followUserMode={"normal" as any}
            followZoomLevel={16}
            animationMode={"flyTo" as any}  
            animationDuration={500}
          />
          {/* This replaces locationEnabled and shows the moving blue dot */}
          <UserLocation
            visible={true}
            animated={true}
          />

          {/* Route line */}
          {routeGeometry && (
            <ShapeSource id="routeSource" shape={routeGeometry}>
              <LineLayer
                id="routeLine"
                style={{
                  lineColor: Colors.primary,
                  lineWidth: 6,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* Destination marker */}
          {pickup.latitude && pickup.longitude && (
            <MarkerView coordinate={[pickup.longitude, pickup.latitude]}>
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={40} color="#C62828" />
              </View>
            </MarkerView>
          )}

          {/* No manual location MarkerView — locationEnabled puck handles this */}
        </MapView>
      </View>

      {/* ── UI overlay layer — box-none passes touches through to map ── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

        {/* Instruction card — display only, no touch needed */}
        <View style={styles.instructionCard} pointerEvents="none">
          <View style={styles.instructionRow}>
            <View style={styles.maneuverBubble}>
              <Ionicons
                name={currentStep ? getManeuverIcon(currentStep.maneuver) : 'arrow-up'}
                size={26}
                color={Colors.primary}
              />
            </View>
            <View style={styles.instructionContent}>
              <AppText variant="body" style={styles.instructionText} numberOfLines={2}>
                {currentStep?.instruction || 'Calculating route...'}
              </AppText>
              <AppText style={styles.distanceText}>
                {steps.length > 0 ? formatDistance(distanceToNext) : '—'}
              </AppText>
            </View>
          </View>

          {!isLastStep && steps[currentStepIndex + 1] && (
            <View style={styles.nextStepRow}>
              <AppText variant="caption" style={styles.nextStepLabel}>THEN</AppText>
              <Ionicons
                name={getManeuverIcon(steps[currentStepIndex + 1].maneuver)}
                size={14}
                color={Colors.mutedText}
              />
              <AppText variant="caption" style={styles.nextStepText} numberOfLines={1}>
                {steps[currentStepIndex + 1].instruction}
              </AppText>
            </View>
          )}
        </View>

        {/* Address pill */}
        {pickup.user_address && (
          <View style={styles.addressPill} pointerEvents="none">
            <Ionicons name="location-outline" size={14} color="#FFFFFF" />
            <AppText variant="caption" style={styles.addressPillText} numberOfLines={1}>
              {pickup.user_address}
            </AppText>
          </View>
        )}

        {/* Bottom bar — needs touch, so pointerEvents="auto" */}
        <View style={styles.bottomBar} pointerEvents="auto">
          <View style={styles.etaBox}>
            <AppText variant="caption" style={styles.etaLabel}>ETA</AppText>
            {/* ✅ eta is in seconds, convert to minutes, show — while loading */}
            <AppText style={styles.etaValue}>
              {eta > 0 ? Math.round(eta / 60) : '—'}
            </AppText>
            <AppText variant="caption" style={styles.etaUnit}>min</AppText>
          </View>

          <TouchableOpacity
            style={styles.arrivedBtn}
            onPress={handleArrived}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <AppText style={styles.arrivedBtnText}>Arrived</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endBtn}
            onPress={handleEndNavigation}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
    color: Colors.mutedText,
  },
  map: {
    flex: 1,
  },
  destinationMarker: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Instruction card
  instructionCard: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maneuverBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.ecoTileBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    fontWeight: '700',
    color: '#1B2A1C',
    marginBottom: 4,
    lineHeight: 22,
  },
  distanceText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
    gap: 6,
  },
  nextStepLabel: {
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 1,
  },
  nextStepText: {
    flex: 1,
    color: Colors.mutedText,
    fontWeight: '500',
  },

  // Address pill
  addressPill: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(36, 91, 67, 0.9)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addressPillText: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  etaBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  etaLabel: {
    fontWeight: '700',
    color: Colors.mutedText,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  etaValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 26,
  },
  etaUnit: {
    color: Colors.mutedText,
    fontWeight: '600',
  },
  arrivedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  arrivedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  endBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});