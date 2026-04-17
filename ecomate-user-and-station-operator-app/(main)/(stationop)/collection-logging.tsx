import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import BackButton from "../../components/BackButton";
import Colors from "../../constants/colors";

type StationOption = {
  station_id: string;
  name: string;
};

export default function DeliveryLogging() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [oilVolume, setOilVolume] = useState("");
  const [emailError, setEmailError] = useState("");

  const [stations, setStations] = useState<StationOption[]>([]);
  const [selectedStation, setSelectedStation] =
    useState<StationOption | null>(null);

  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

 
  const [stationQuery, setStationQuery] = useState("");

  const TAB_BAR_HEIGHT = 95;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 24;

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    setLoadingStations(true);

    const { data } = await supabase
      .from("stations")
      .select("station_id, name")
      .order("name", { ascending: true });

    setStations(data || []);
    setLoadingStations(false);
  };

  const validateEmail = async () => {
    const clean = email.trim().toLowerCase();

    if (!clean) {
      setEmailError("Email is required.");
      return false;
    }

    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setEmailError("Please enter a valid email.");
      return false;
    }

    setCheckingEmail(true);

    const { data, error } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", clean)
      .maybeSingle();

    setCheckingEmail(false);

    if (error) {
      setEmailError("Could not verify email. Please try again.");
      return false;
    }

    if (!data) {
      setEmailError("This email is not registered.");
      return false;
    }

    setEmailError("");
    return true;
  };

 const onSubmit = async () => {
  const valid = await validateEmail();
  if (!valid) return;

  if (!selectedStation || !oilVolume.trim()) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    alert('Could not get operator session. Please log in again.');
    return;
  }

  try {
    const response = await fetch(
      'https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-self-delivery-2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
        },
        body: JSON.stringify({
          station_operator_email: user.email,
          user_email: email.trim().toLowerCase(),
          volume_litres: Number(oilVolume.trim()),
          station_id: selectedStation.station_id,
          location: { lat: 0, lon: 0 },
        }),
      }
    );

    const data = await response.json();
    console.log('API RESPONSE:', JSON.stringify(data));

    if (!data.success) {
      alert(data.error || 'Failed to generate QR');
      return;
    }

    router.push({
      pathname: "/(main)/(stationop)/generated-qr",
      params: {
        confirmationToken: data.confirmationToken,
        shortCode: data.shortCode, 
        dropoffId: data.dropoffId,
        stationName: selectedStation.name,
        volume: oilVolume.trim(),
        userEmail: email.trim().toLowerCase(),
      },
    });

  } catch (err) {
    console.error('log-self-delivery error:', err);
    alert('Something went wrong. Please try again.');
  }
};

  const filteredStations = useMemo(() => {
    const q = stationQuery.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => s.name.toLowerCase().includes(q));
  }, [stations, stationQuery]);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPad },
        ]}
      >
       
        <View style={styles.headerRow}>
         
          <BackButton to="/(main)/(stationop)/dashboard" />

          <AppText variant="header" style={styles.headerTitle}>
            COLLECTION LOGGING
          </AppText>
          
          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.card}>
          <AppText variant="sectionTitle" style={styles.sectionHeader}>
            Collection Details
          </AppText>

        
          <View style={styles.fieldGroup}>
            <AppText style={styles.formLabel}>User Email</AppText>

            <View style={styles.inputRow}>
              <View style={styles.iconBubble}>
                <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              </View>

              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (emailError) setEmailError("");
                }}
                onBlur={validateEmail}
                placeholder="Enter registered email"
                placeholderTextColor="#9AA0A6"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              {checkingEmail && (
                <ActivityIndicator size="small" color={Colors.primary} />
              )}
            </View>

            {!!emailError && (
              <AppText variant="error" style={styles.errorText}>
                {emailError}
              </AppText>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <AppText style={styles.formLabel}>Station</AppText>

            <Pressable
              style={styles.inputRow}
              onPress={() => {
                setStationQuery(""); 
                setStationModalOpen(true);
              }}
            >
              <View style={styles.iconBubble}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={Colors.primary}
                />
              </View>

              <AppText
                style={[
                  styles.dropdownText,
                  !selectedStation && styles.placeholderText,
                ]}
              >
                {selectedStation ? selectedStation.name : "Select station"}
              </AppText>

              <Ionicons
                name="chevron-down"
                size={20}
                color={Colors.mutedText}
              />
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <AppText style={styles.formLabel}>Oil Volume</AppText>

            <View style={styles.inputRow}>
              <View style={styles.iconBubble}>
                <Ionicons
                  name="water-outline"
                  size={20}
                  color={Colors.primary}
                />
              </View>

              <TextInput
                value={oilVolume}
                onChangeText={setOilVolume}
                placeholder="Enter litres"
                placeholderTextColor="#9AA0A6"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.buttonWrap}>
            <AppButton
              title="GENERATE QR"
              variant="pill"
              fullWidth
              onPress={onSubmit}
            />
          </View>
        </View>
      </ScrollView>

      <Modal visible={stationModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setStationModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <AppText variant="sectionTitle" style={styles.modalTitle}>
                  Select Station
                </AppText>

                <View style={styles.searchRow}>
                  <Ionicons
                    name="search"
                    size={18}
                    color={Colors.mutedText}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={stationQuery}
                    onChangeText={setStationQuery}
                    placeholder="Search station..."
                    placeholderTextColor="#9AA0A6"
                    style={styles.searchInput}
                    autoCapitalize="none"
                  />
                  {!!stationQuery && (
                    <Pressable onPress={() => setStationQuery("")} hitSlop={10}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={Colors.mutedText}
                      />
                    </Pressable>
                  )}
                </View>

                {loadingStations ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                  <FlatList
                    data={filteredStations}
                    keyExtractor={(item) => item.station_id}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <AppText style={styles.emptyText}>
                        No stations found.
                      </AppText>
                    }
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.stationRow}
                        onPress={() => {
                          setSelectedStation(item);
                          setStationModalOpen(false);
                        }}
                      >
                        <AppText>{item.name}</AppText>
                      </Pressable>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
  },

  headerRightSpacer: {
    width: 40, 
    height: 40,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    elevation: 5,
    paddingHorizontal: 10,
    paddingVertical: 30,
  },

  sectionHeader: {
    marginBottom: 18,
    color: Colors.primary,
  },

  fieldGroup: {
    marginBottom: 24,
  },

  formLabel: {
    marginBottom: 10,
    color: Colors.primary,
    fontWeight: "600",
  },

  inputRow: {
    height: 60,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(36,91,67,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#1f1f1f",
  },

  dropdownText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },

  placeholderText: {
    color: "#9AA0A6",
  },

  errorText: {
    marginTop: 8,
  },

  buttonWrap: {
    marginTop: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    maxHeight: "70%",
  },

  modalTitle: {
    textAlign: "center",
    marginBottom: 12,
  },

  searchRow: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1f1f1f",
  },

  stationRow: {
    paddingVertical: 14,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 10,
    color: Colors.mutedText,
  },
});