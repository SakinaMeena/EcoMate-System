import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "../../components/AppText";
import BackButton from "../../components/BackButton";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";
import { Alert } from "react-native";

const SUPABASE_URL = "https://your-url";
const SUPABASE_ANON_KEY = "your-anon-key";

type StationRow = {
  station_id: string;
  station_operator_id: string;
  name: string | null;
};

type DepotRow = {
  depot_id: string;
  name: string | null;
};

export default function DepotTransfer() {
  const insets = useSafeAreaInsets();

  const [actorEmail, setActorEmail] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);

  const [outLoading, setOutLoading] = useState(false);
  const [reachedLoading, setReachedLoading] = useState(false);

  const [loadingStations, setLoadingStations] = useState(true);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [stationsError, setStationsError] = useState<string | null>(null);

  const [loadingDepots, setLoadingDepots] = useState(true);
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [depotsError, setDepotsError] = useState<string | null>(null);

  const [selectedStation, setSelectedStation] = useState<StationRow | null>(null);
  const [selectedDepot, setSelectedDepot] = useState<DepotRow | null>(null);
  const [totalVolume, setTotalVolume] = useState("");

  const [status, setStatus] = useState<"out" | "reached" | null>(null);

  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationSearch, setStationSearch] = useState("");

  const [depotModalOpen, setDepotModalOpen] = useState(false);
  const [depotSearch, setDepotSearch] = useState("");

  const stationSearchInputRef = useRef<TextInput>(null);
  const depotSearchInputRef = useRef<TextInput>(null);

  const [segWidth, setSegWidth] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadEmail() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setActorEmail(user?.email ?? null);
    }
    loadEmail();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadStations = async () => {
      try {
        setLoadingStations(true);
        setStationsError(null);
        const { data, error } = await supabase
          .from("stations")
          .select("station_id, station_operator_id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        if (mounted) setStations((data as StationRow[]) || []);
      } catch (e: any) {
        if (mounted) setStationsError(e?.message ?? "Failed to load stations");
      } finally {
        if (mounted) setLoadingStations(false);
      }
    };
    loadStations();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadDepots = async () => {
      try {
        setLoadingDepots(true);
        setDepotsError(null);
        const { data, error } = await supabase
          .from("depots")
          .select("depot_id, name")
          .order("name", { ascending: true });
        if (error) throw error;
        if (mounted) setDepots((data as DepotRow[]) || []);
      } catch (e: any) {
        if (mounted) setDepotsError(e?.message ?? "Failed to load depots");
      } finally {
        if (mounted) setLoadingDepots(false);
      }
    };
    loadDepots();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const id = (s.station_id ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [stations, stationSearch]);

  const filteredDepots = useMemo(() => {
    const q = depotSearch.trim().toLowerCase();
    if (!q) return depots;
    return depots.filter((d) => {
      const name = (d.name ?? "").toLowerCase();
      const id = (d.depot_id ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [depots, depotSearch]);

  const onSelectStation = (s: StationRow) => {
    setSelectedStation(s);
    setStationModalOpen(false);
  };

  const onSelectDepot = (d: DepotRow) => {
    setSelectedDepot(d);
    setDepotModalOpen(false);
  };

  const openStationModal = () => {
    setStationModalOpen(true);
    setTimeout(() => stationSearchInputRef.current?.focus(), 150);
  };

  const openDepotModal = () => {
    setDepotModalOpen(true);
    setTimeout(() => depotSearchInputRef.current?.focus(), 150);
  };

  const resetTransfer = () => {
    setSelectedStation(null);
    setSelectedDepot(null);
    setTotalVolume("");
    setBatchId(null);
    setStatus(null);
    setStationSearch("");
    setStationModalOpen(false);
    setDepotSearch("");
    setDepotModalOpen(false);
    slideX.setValue(0);
  };

  const handleOut = async () => {
    if (!actorEmail) {
      alert("Your login session is not loaded yet. Please wait.");
      return;
    }
    if (!selectedStation) {
      alert("Please select a station first.");
      return;
    }
    if (!selectedDepot) {
      alert("Please select a depot first.");
      return;
    }
    const volumeNum = Number(totalVolume);
    if (isNaN(volumeNum) || volumeNum <= 0) {
      alert("Please enter a valid positive total volume.");
      return;
    }

    setOutLoading(true);

    try {
      const response = await fetch(
        `https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-bulk-departure-v3`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_TOKEN}`,
          },
          body: JSON.stringify({
            actor_email: actorEmail,
            actor_role: "station_operator",
            total_volume: volumeNum,
            depot_id: selectedDepot.depot_id,
          }),
        }
      );

      const data = await response.json();
      console.log("OUT response:", JSON.stringify(data));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create batch");
      }

      setBatchId(data.batch_id);
      setStatus("out");
      Alert.alert("Success", data.message || "Batch created and sent to depot!");
    } catch (err: any) {
      console.error("OUT error:", err);
      alert("Error creating batch: " + (err.message || "Unknown error"));
    } finally {
      setOutLoading(false);
    }
  };

  const handleReached = async () => {
    if (!actorEmail || !batchId) {
      alert("Missing required data. Please complete OUT first.");
      return;
    }
    if (!selectedDepot) {
      alert("Depot is missing.");
      return;
    }

    setReachedLoading(true);

    try {
      const response = await fetch(
        `https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/confirm-depot-arrival-3`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_TOKEN}`,
          },
          body: JSON.stringify({
            actor_email: actorEmail,
            actor_role: "station_operator",
            batch_id: batchId,
            depot_id: selectedDepot.depot_id,
          }),
        }
      );

      const data = await response.json();
      console.log("REACHED response:", JSON.stringify(data));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to confirm arrival");
      }

      setStatus("reached");
      Alert.alert("Success", data.message || "Batch confirmed arrived at depot!");
    } catch (err: any) {
      console.error("REACHED error:", err);
      alert("Error confirming arrival: " + (err.message || "Unknown error"));
    } finally {
      setReachedLoading(false);
    }
  };

  // Form & button logic
  const isFormComplete =
    !!selectedStation && !!selectedDepot && totalVolume.trim().length > 0;

  const outEnabled = isFormComplete && status === null;
  const reachedEnabled = isFormComplete && status === "out" && !!batchId;
  const workflowLocked = status === "reached";

  useEffect(() => {
    if (!isFormComplete && status !== null) setStatus(null);
  }, [isFormComplete, status]);

  useEffect(() => {
    if (!segWidth) return;
    const toValue = status === "reached" ? (segWidth - 12) / 2 : 0;
    if (status === "out" || status === "reached") {
      Animated.timing(slideX, {
        toValue,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      slideX.setValue(0);
    }
  }, [status, segWidth, slideX]);

  return (
    <>
      <ScrollView
        style={{ backgroundColor: Colors.background }}
        contentContainerStyle={[
          styles.container,
          {
            flexGrow: 1,
            paddingBottom: insets.bottom + 160,
            backgroundColor: Colors.background,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.headerRow}>
          <BackButton to="/(main)/(stationop)/dashboard" />
          <AppText variant="header" style={styles.title}>
            DEPOT TRANSFER
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <AppText style={styles.subtitle}>Transfer summary & confirmation</AppText>

        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Transfer Details</AppText>

          {(loadingStations || loadingDepots) && (
            <View style={styles.inlineRow}>
              <ActivityIndicator />
              <AppText style={styles.infoText}>
                {loadingStations && loadingDepots
                  ? "Loading stations & depots…"
                  : loadingStations
                  ? "Loading stations…"
                  : "Loading depots…"}
              </AppText>
            </View>
          )}

          {!!stationsError && (
            <AppText style={[styles.infoText, { color: "#B00020" }]}>
              {stationsError}
            </AppText>
          )}

          {!!depotsError && (
            <AppText style={[styles.infoText, { color: "#B00020" }]}>
              {depotsError}
            </AppText>
          )}

          <Pressable
            style={styles.rowCard}
            onPress={openStationModal}
            disabled={loadingStations || workflowLocked}
          >
            <View style={styles.iconBox}>
              <Ionicons name="location-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.rowLabel}>Station</AppText>
              <AppText style={styles.rowValue} numberOfLines={1}>
                {selectedStation?.name ?? "Tap to search station"}
              </AppText>
            </View>
            <Ionicons name="chevron-down" size={20} color="#8A8A8A" />
          </Pressable>

          <View style={styles.rowCard}>
            <View style={styles.iconBox}>
              <Ionicons name="water-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.rowLabel}>Total Volume</AppText>
              <View style={styles.volumeRow}>
                <TextInput
                  value={totalVolume}
                  editable={!workflowLocked}
                  onChangeText={(t) => {
                    const cleaned = t
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                    setTotalVolume(cleaned);
                  }}
                  placeholder="0.0"
                  placeholderTextColor="#A0A7A2"
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                <AppText style={styles.unit}>L</AppText>
              </View>
            </View>
          </View>

          <Pressable
            style={[styles.rowCard, { marginBottom: 0 }]}
            onPress={openDepotModal}
            disabled={loadingDepots || workflowLocked}
          >
            <View style={styles.iconBox}>
              <Ionicons name="pricetag-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.rowLabel}>Depot</AppText>
              <AppText style={styles.rowValue} numberOfLines={1}>
                {selectedDepot
                  ? `${selectedDepot.name ?? ""} (${selectedDepot.depot_id})`
                  : "Tap to search depot"}
              </AppText>
            </View>
            <Ionicons name="chevron-down" size={20} color="#8A8A8A" />
          </Pressable>
        </View>

        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Status</AppText>

          <View
            style={styles.pillWrap}
            onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          >
            {!!segWidth && (status === "out" || status === "reached") && (
              <Animated.View
                style={[
                  styles.pillThumb,
                  {
                    width: (segWidth - 12) / 2,
                    transform: [{ translateX: slideX }],
                    backgroundColor:
                      status === "reached" ? Colors.primary : "#FFFFFF",
                  },
                ]}
              />
            )}

            <Pressable
              disabled={!outEnabled || workflowLocked || outLoading}
              onPress={handleOut}
              style={[
                styles.pillBtn,
                status === "out" && { backgroundColor: "#FFFFFF" },
                (!outEnabled || workflowLocked || outLoading) &&
                  styles.pillBtnDisabled,
              ]}
            >
              {outLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <AppText
                  style={[
                    styles.pillText,
                    status === "out" && styles.pillTextOutActive,
                    (!outEnabled || workflowLocked || outLoading) &&
                      styles.pillTextDisabled,
                  ]}
                >
                  OUT
                </AppText>
              )}
            </Pressable>

            <Pressable
              disabled={!reachedEnabled || workflowLocked || reachedLoading}
              onPress={handleReached}
              style={[
                styles.pillBtn,
                (!reachedEnabled || workflowLocked || reachedLoading) &&
                  styles.pillBtnDisabled,
              ]}
            >
              {reachedLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <AppText
                  style={[
                    styles.pillText,
                    status === "reached" && styles.pillTextReachedActive,
                    (!reachedEnabled || workflowLocked || reachedLoading) &&
                      styles.pillTextDisabled,
                  ]}
                >
                  REACHED
                </AppText>
              )}
            </Pressable>
          </View>

          {workflowLocked && (
            <View style={{ marginTop: 18 }}>
              <AppText style={styles.lockNote}>
                Status locked: REACHED confirmed.
              </AppText>
              <Pressable style={styles.newTransferBtn} onPress={resetTransfer}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <AppText style={styles.newTransferText}>NEW TRANSFER</AppText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={stationModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setStationModalOpen(false)}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <AppText style={styles.modalTitle}>Search Station</AppText>
                <Pressable onPress={() => setStationModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#222" />
                </Pressable>
              </View>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color="#7E8A82" />
                <TextInput
                  ref={stationSearchInputRef}
                  value={stationSearch}
                  onChangeText={setStationSearch}
                  placeholder="Type station name (e.g. PETRONAS...)"
                  placeholderTextColor="#9AA39C"
                  style={styles.searchInput}
                  returnKeyType="done"
                />
              </View>
              <FlatList
                data={filteredStations}
                keyExtractor={(item) => item.station_id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 10 }}
                ListEmptyComponent={
                  <AppText style={styles.infoText}>No stations found.</AppText>
                }
                renderItem={({ item }) => {
                  const active = selectedStation?.station_id === item.station_id;
                  return (
                    <Pressable
                      style={[styles.stationItem, active && styles.stationItemActive]}
                      onPress={() => onSelectStation(item)}
                    >
                      <View style={styles.stationLeft}>
                        <View style={styles.stationDot} />
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.stationName} numberOfLines={1}>
                            {item.name ?? "Unnamed station"}
                          </AppText>
                          <AppText style={styles.stationIdText} numberOfLines={1}>
                            {item.station_id}
                          </AppText>
                        </View>
                      </View>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={Colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={depotModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setDepotModalOpen(false)}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <AppText style={styles.modalTitle}>Search Depot</AppText>
                <Pressable onPress={() => setDepotModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#222" />
                </Pressable>
              </View>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color="#7E8A82" />
                <TextInput
                  ref={depotSearchInputRef}
                  value={depotSearch}
                  onChangeText={setDepotSearch}
                  placeholder="Type depot name or ID"
                  placeholderTextColor="#9AA39C"
                  style={styles.searchInput}
                  returnKeyType="done"
                />
              </View>
              <FlatList
                data={filteredDepots}
                keyExtractor={(item) => item.depot_id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 10 }}
                ListEmptyComponent={
                  <AppText style={styles.infoText}>No depots found.</AppText>
                }
                renderItem={({ item }) => {
                  const active = selectedDepot?.depot_id === item.depot_id;
                  return (
                    <Pressable
                      style={[styles.stationItem, active && styles.stationItemActive]}
                      onPress={() => onSelectDepot(item)}
                    >
                      <View style={styles.stationLeft}>
                        <View style={styles.stationDot} />
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.stationName} numberOfLines={1}>
                            {item.name ?? "Unnamed depot"}
                          </AppText>
                          <AppText style={styles.stationIdText} numberOfLines={1}>
                            {item.depot_id}
                          </AppText>
                        </View>
                      </View>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={Colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingTop: 18 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { textAlign: "center", letterSpacing: 1 },
  subtitle: {
    textAlign: "center",
    color: "#6F7A72",
    opacity: 0.85,
    marginBottom: 26,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E1E1E",
    marginBottom: 20,
  },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  infoText: { fontSize: 14, fontWeight: "600", color: "#7E8A82" },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EAF6EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowLabel: { fontSize: 16, fontWeight: "800", color: "#2A2A2A", marginBottom: 8 },
  rowValue: { fontSize: 16, fontWeight: "700", color: "#9AA39C" },
  input: { fontSize: 16, fontWeight: "700", color: "#2A2A2A", paddingVertical: 4 },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  unit: { fontSize: 16, fontWeight: "900", color: "#7B867F", paddingLeft: 6 },
  pillWrap: {
    flexDirection: "row",
    backgroundColor: "#EDEDED",
    borderRadius: 18,
    padding: 6,
    position: "relative",
    overflow: "hidden",
  },
  pillThumb: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pillBtnDisabled: { opacity: 0.6 },
  pillText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#A0A7A2",
  },
  pillTextOutActive: { color: Colors.primary },
  pillTextReachedActive: { color: "#FFFFFF" },
  pillTextDisabled: { color: "#9DA39E" },
  lockNote: {
    textAlign: "center",
    fontWeight: "700",
    color: "#6F7A72",
    opacity: 0.85,
    marginBottom: 12,
  },
  newTransferBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 18,
  },
  newTransferText: { color: "#fff", fontWeight: "900", letterSpacing: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E1E1E" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F4F2",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#2A2A2A",
    paddingVertical: 0,
  },
  stationItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  stationItemActive: { backgroundColor: "#EAF6EA" },
  stationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  stationDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.25,
  },
  stationName: { fontSize: 15, fontWeight: "900", color: "#2A2A2A" },
  stationIdText: { fontSize: 12, fontWeight: "800", color: "#7E8A82", marginTop: 3 },
});