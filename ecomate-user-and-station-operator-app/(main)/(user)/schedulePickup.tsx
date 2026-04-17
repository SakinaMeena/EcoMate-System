import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  UIManager,
  findNodeHandle,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";

const YELLOW = "#F2C94C";

// dropdown style
const FIELD_BG = Colors.white;
const FIELD_BORDER = "#D7D7D7";
const MENU_BORDER = "#D7D7D7";
const MENU_SHADOW_OPACITY = 0.08;

// ===== Mapbox token =====
const MAPBOX_TOKEN = "pk.your_token_here";

type AnchorRect = { x: number; y: number; width: number; height: number };

type UserRow = {
  user_id: string;
  email: string | null;
  user_address: string | null;
  user_lat?: number | null;
  user_lon?: number | null;
};

type PickupMode = "profile" | "current" | "manual";

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number]; // [lon, lat]
};

export default function SchedulePickup() {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [profileLat, setProfileLat] = useState<number | null>(null);
  const [profileLon, setProfileLon] = useState<number | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);

  const [pickupMode, setPickupMode] = useState<PickupMode>("profile");

  const [currentLocLoading, setCurrentLocLoading] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLon, setCurrentLon] = useState<number | null>(null);
  const [currentAddressLabel, setCurrentAddressLabel] = useState<string>("");

  const [manualQuery, setManualQuery] = useState<string>("");
  const [manualSuggestions, setManualSuggestions] = useState<MapboxFeature[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLon, setManualLon] = useState<number | null>(null);
  const [manualAddressLabel, setManualAddressLabel] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bookedStarts, setBookedStarts] = useState<Set<string>>(new Set());
  const [checkingSlots, setCheckingSlots] = useState(false);

  const [volumeText, setVolumeText] = useState<string>("");
  const volumeLitres = useMemo(() => parseLitres(volumeText), [volumeText]);
  const volumeTooLow = volumeLitres !== null && volumeLitres < 1;

  const [timeOpen, setTimeOpen] = useState(false);
  const [timeAnchor, setTimeAnchor] = useState<AnchorRect | null>(null);
  const timeBoxRef = useRef<View | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timeSlots = useMemo(() => {
    const all = generateOneHourSlots(7, 19);
    const blocked = new Set(["12:00 PM - 1:00 PM", "1:00 PM - 2:00 PM"]);
    return all.filter((slot) => !blocked.has(slot));
  }, []);

  const minSelectableDate = getTomorrowDateString();

  const goDashboard = () => {
    router.replace("/(main)/(user)/userHome");
  };

  const measureAnchor = (
    ref: React.MutableRefObject<View | null>,
    cb: (rect: AnchorRect | null) => void
  ) => {
    const node = findNodeHandle(ref.current);
    if (!node) return cb(null);
    UIManager.measureInWindow(node, (x, y, width, height) => {
      cb({ x, y, width, height });
    });
  };

  const openTimeDropdown = () => {
    measureAnchor(timeBoxRef, (rect) => {
      setTimeAnchor(rect);
      setTimeOpen(true);
    });
  };

  const closeAllDropdowns = () => {
    setTimeOpen(false);
  };

  // ===== Mapbox search =====
  const searchMapbox = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setManualSuggestions([]);
      return;
    }
    try {
      setManualSearching(true);
      const encoded = encodeURIComponent(query);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${process.env.MAPBOX_TOKEN}`;      
      const res = await fetch(url);
      const json = await res.json();
      setManualSuggestions(json.features ?? []);
    } catch {
      setManualSuggestions([]);
    } finally {
      setManualSearching(false);
    }
  };

  const onManualQueryChange = (text: string) => {
    setManualQuery(text);
    setManualLat(null);
    setManualLon(null);
    setManualAddressLabel("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchMapbox(text), 400);
  };

  const selectSuggestion = (feature: MapboxFeature) => {
    setManualQuery(feature.place_name);
    setManualAddressLabel(feature.place_name);
    setManualLon(feature.center[0]);
    setManualLat(feature.center[1]);
    setManualSuggestions([]);
  };

  const chosenCoords = useMemo(() => {
    if (pickupMode === "current") {
      if (currentLat == null || currentLon == null) return null;
      return { lat: currentLat, lon: currentLon };
    }
    if (pickupMode === "manual") {
      if (manualLat == null || manualLon == null) return null;
      return { lat: manualLat, lon: manualLon };
    }
    if (profileLat == null || profileLon == null) return null;
    return { lat: profileLat, lon: profileLon };
  }, [pickupMode, currentLat, currentLon, manualLat, manualLon, profileLat, profileLon]);

  const chosenAddressText = useMemo(() => {
    if (pickupMode === "current") {
      return currentAddressLabel?.trim()
        ? currentAddressLabel.trim()
        : "Current GPS location";
    }
    if (pickupMode === "manual") {
      return manualAddressLabel?.trim() ? manualAddressLabel.trim() : "";
    }
    return pickupAddress?.trim() ? pickupAddress.trim() : "";
  }, [pickupMode, currentAddressLabel, manualAddressLabel, pickupAddress]);

  const chosenPointWkt = useMemo(() => {
    if (!chosenCoords) return null;
    return `SRID=4326;POINT(${Number(chosenCoords.lon)} ${Number(chosenCoords.lat)})`;
  }, [chosenCoords]);

  useEffect(() => {
    if (pickupMode !== "current") return;

    (async () => {
      try {
        setCurrentLocLoading(true);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow location access.");
          setPickupMode("profile");
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setCurrentLat(lat);
        setCurrentLon(lon);

        try {
          const rev = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lon,
          });
          const first = rev?.[0];
          const pretty = first
            ? [
                first.name,
                first.street,
                first.city,
                first.region,
                first.postalCode,
                first.country,
              ]
                .filter(Boolean)
                .join(", ")
            : "";
          setCurrentAddressLabel(
            pretty || `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`
          );
        } catch {
          setCurrentAddressLabel(`Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`);
        }
      } catch (e: any) {
        Alert.alert(
          "Location failed",
          e?.message ?? "Could not fetch your current location."
        );
        setPickupMode("profile");
      } finally {
        setCurrentLocLoading(false);
      }
    })();
  }, [pickupMode]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setAddressLoading(true);

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user;
        if (!user) {
          if (!mounted) return;
          setPickupAddress("");
          setProfileLat(null);
          setProfileLon(null);
          return;
        }

        let row: UserRow | null = null;

        const { data: byId, error: byIdErr } = await supabase
          .from("users")
          .select("user_id,email,user_address,user_lat,user_lon")
          .eq("user_id", user.id)
          .maybeSingle();

        if (byIdErr) throw byIdErr;
        row = (byId as UserRow) ?? null;

        if (!row && user.email) {
          const { data: byEmail, error: byEmailErr } = await supabase
            .from("users")
            .select("user_id,email,user_address,user_lat,user_lon")
            .eq("email", user.email)
            .maybeSingle();

          if (byEmailErr) throw byEmailErr;
          row = (byEmail as UserRow) ?? null;
        }

        if (!mounted) return;

        setPickupAddress(row?.user_address ?? "");
        setProfileLat(row?.user_lat ?? null);
        setProfileLon(row?.user_lon ?? null);
      } catch {
        if (!mounted) return;
        setPickupAddress("");
        setProfileLat(null);
        setProfileLon(null);
      } finally {
        if (!mounted) return;
        setAddressLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBookedStarts(new Set());
        setSelectedTime(null);

        if (!selectedDate) return;
        if (!chosenPointWkt) return;

        setCheckingSlots(true);

        const { data, error } = await supabase.rpc("get_booked_time_starts", {
          p_date: selectedDate,
          p_location: chosenPointWkt,
          p_radius_m: 50,
        });

        if (error) {
          if (!alive) return;
          setBookedStarts(new Set());
          return;
        }

        const set = new Set<string>();
        (data ?? []).forEach((row: any) => {
          if (row?.time_window_start) set.add(String(row.time_window_start));
        });

        if (!alive) return;
        setBookedStarts(set);
      } finally {
        if (!alive) return;
        setCheckingSlots(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedDate, chosenPointWkt]);

  const isSlotBooked = (slotLabel: string) => {
    const parsed = parseTimeSlotToHHMMSS(slotLabel);
    if (!parsed) return false;
    return bookedStarts.has(parsed.start);
  };

  const canSubmit =
    !!selectedDate &&
    !!selectedTime &&
    (pickupMode === "profile"
      ? !!pickupAddress?.trim()
      : pickupMode === "current"
      ? currentLat != null && currentLon != null && !currentLocLoading
      : manualLat != null && manualLon != null) &&
    volumeLitres !== null &&
    volumeLitres >= 1 &&
    !isSlotBooked(selectedTime || "");

  const handlePressSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert("Missing info", "Please select date and time slot.");
      return;
    }

    if (pickupMode === "profile") {
      if (!pickupAddress?.trim()) {
        Alert.alert(
          "Missing address",
          "No pickup address found in your profile. Please update your profile address."
        );
        return;
      }
      if (profileLat == null || profileLon == null) {
        Alert.alert(
          "Location required",
          "We couldn't find your saved latitude/longitude in your profile.\n\nFix:\n• Ensure your public.users row has user_lat and user_lon filled."
        );
        return;
      }
    } else if (pickupMode === "current") {
      if (currentLocLoading) {
        Alert.alert("Hold on", "Fetching your current location...");
        return;
      }
      if (currentLat == null || currentLon == null) {
        Alert.alert("Missing current location", "Could not fetch GPS location.");
        return;
      }
    } else {
      // manual
      if (manualLat == null || manualLon == null) {
        Alert.alert(
          "Address not confirmed",
          "Please select an address from the suggestions list."
        );
        return;
      }
    }

    if (volumeLitres === null) {
      Alert.alert("Missing volume", "Please enter your approximate oil volume.");
      return;
    }
    if (volumeLitres < 1) {
      Alert.alert("Volume too low", "Pickup requires at least 1 litre of oil.");
      return;
    }

    if (isSlotBooked(selectedTime)) {
      Alert.alert(
        "Slot unavailable",
        "This time slot has already been booked for this location. Please pick another time."
      );
      return;
    }

    setConfirmVisible(true);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    if (submitting) return;

    const litres = volumeLitres ?? 0;
    if (litres < 1) return;

    try {
      setSubmitting(true);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert("Error", "Not logged in.");
        return;
      }

      const parsed = parseTimeSlotToHHMMSS(selectedTime);
      if (!parsed) {
        Alert.alert("Invalid time slot", "Please select a valid pickup time slot.");
        return;
      }
      const { start, end } = parsed;

      if (chosenPointWkt) {
        const { data: bookedNow, error: chkErr } = await supabase.rpc(
          "get_booked_time_starts",
          {
            p_date: selectedDate,
            p_location: chosenPointWkt,
            p_radius_m: 50,
          }
        );

        if (!chkErr) {
          const set = new Set<string>(
            (bookedNow ?? [])
              .map((r: any) => r?.time_window_start)
              .filter(Boolean)
              .map((x: any) => String(x))
          );

          if (set.has(start)) {
            Alert.alert(
              "Slot taken",
              "Someone just booked that slot for this location. Please choose another time."
            );
            setBookedStarts(set);
            setConfirmVisible(false);
            setSubmitting(false);
            return;
          }
        }
      }

      const payload: any = {
        user_id: user.id,
        user_address: chosenAddressText,
        estimated_volume: litres,
        scheduled_for: selectedDate,
        time_window_start: start,
        time_window_end: end,
        dropoff_type: "home_pickup",
        status: "pending",
      };

      if (!chosenPointWkt) {
        Alert.alert(
          "Missing location",
          "We couldn't determine your pickup coordinates. Please try again."
        );
        return;
      }
      payload.location = chosenPointWkt;

      const { error: insErr } = await supabase.from("dropoffs").insert([payload]);
      if (insErr) throw insErr;

      setConfirmVisible(false);

      router.push({
        pathname: "/(main)/(user)/uco-journey",
        params: {
          date: selectedDate,
          location: chosenAddressText,
          time: selectedTime,
          volume: String(litres),
        },
      });
    } catch (e: any) {
      Alert.alert(
        "Save failed",
        e?.message ??
          "Could not save your pickup. Check Supabase table name/columns/RLS."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        <View style={styles.headerRow}>
          <Pressable onPress={goDashboard} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>

          <View style={styles.headerText} pointerEvents="none">
            <AppText variant="header">Schedule Pickup</AppText>
            <AppText variant="caption">Select Date</AppText>
          </View>
        </View>

       
        <View style={styles.calendarCard}>
          <Calendar
            minDate={minSelectableDate}
            onDayPress={(day: { dateString: string }) => {
              if (day.dateString < minSelectableDate) return;
              setSelectedDate(day.dateString);
              setSelectedTime(null);
            }}
            dayComponent={({ date }) => {
              const dateString = date?.dateString ?? "";
              const isSelected = selectedDate === dateString;
              const isDisabled = dateString < minSelectableDate;

              return (
                <Pressable
                  disabled={isDisabled}
                  onPress={() => {
                    if (!dateString) return;
                    if (dateString < minSelectableDate) return;
                    setSelectedDate(dateString);
                    setSelectedTime(null);
                  }}
                  style={[styles.dayCell, isDisabled && styles.dayCellDisabled]}
                >
                  {isSelected ? (
                    <OilDrop>
                      <AppText style={styles.dayTextSelected}>{date?.day}</AppText>
                    </OilDrop>
                  ) : (
                    <AppText
                      variant="body"
                      style={[
                        styles.dayText,
                        isDisabled && styles.dayTextDisabled,
                      ]}
                    >
                      {date?.day}
                    </AppText>
                  )}
                </Pressable>
              );
            }}
            theme={{
              calendarBackground: Colors.background,
              backgroundColor: Colors.background,
              textSectionTitleColor: Colors.mutedText,
              monthTextColor: Colors.text,
              arrowColor: Colors.primary,
            }}
            style={styles.calendar}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="sectionTitle">Pickup Location</AppText>

          <View style={styles.radioCard}>
            <RadioRow
              label="Use Profile Address"
              selected={pickupMode === "profile"}
              onPress={() => setPickupMode("profile")}
            />
            <RadioRow
              label="Use Current Location"
              selected={pickupMode === "current"}
              onPress={() => setPickupMode("current")}
            />
            <RadioRow
              label="Type an Address"
              selected={pickupMode === "manual"}
              onPress={() => setPickupMode("manual")}
            />
          </View>

          <View style={styles.noticeRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={Colors.primary}
            />
            <AppText variant="caption" style={styles.noticeText}>
              {pickupMode === "profile"
                ? "Pickup will use your saved profile address. You can change it anytime in your Profile settings."
                : pickupMode === "current"
                ? "Pickup will use your device's current GPS location automatically."
                : "Search and select your pickup address using the search box below."}
            </AppText>
          </View>

          {pickupMode === "profile" && (
            <View style={styles.addressCard}>
              {addressLoading ? (
                <View style={styles.addressLoadingRow}>
                  <ActivityIndicator />
                  <AppText variant="caption" style={{ marginLeft: 10 }}>
                    Loading your profile address...
                  </AppText>
                </View>
              ) : pickupAddress?.trim() ? (
                <>
                  <AppText variant="body" style={styles.addressText}>
                    {pickupAddress}
                  </AppText>
                  <AppText variant="caption" style={styles.addressHint}>
                    Want to change it? Go to Profile → Edit Address.
                  </AppText>
                </>
              ) : (
                <>
                  <AppText variant="body" style={styles.addressMissing}>
                    No address found in your profile.
                  </AppText>
                  <AppText variant="caption" style={styles.addressHint}>
                    Please update your profile address before scheduling a pickup.
                  </AppText>
                </>
              )}
            </View>
          )}

          {pickupMode === "current" && (
            <View style={styles.addressCard}>
              {currentLocLoading ? (
                <View style={styles.addressLoadingRow}>
                  <ActivityIndicator />
                  <AppText variant="caption" style={{ marginLeft: 10 }}>
                    Fetching your current location...
                  </AppText>
                </View>
              ) : (
                <>
                  <AppText variant="body" style={styles.addressText}>
                    {currentAddressLabel?.trim()
                      ? currentAddressLabel
                      : "Current GPS location selected"}
                  </AppText>
                  <AppText variant="caption" style={styles.addressHint}>
                    This will update automatically based on your device GPS.
                  </AppText>
                </>
              )}
            </View>
          )}

          {pickupMode === "manual" && (
            <View style={styles.addressCard}>
             
              <View style={styles.searchInputRow}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={Colors.mutedText}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  value={manualQuery}
                  onChangeText={onManualQueryChange}
                  placeholder="Start typing an address..."
                  placeholderTextColor={Colors.mutedText}
                  style={styles.searchTextInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {manualSearching && (
                  <ActivityIndicator size="small" style={{ marginLeft: 8 }} />
                )}
                {manualQuery.length > 0 && !manualSearching && (
                  <Pressable
                    onPress={() => {
                      setManualQuery("");
                      setManualSuggestions([]);
                      setManualLat(null);
                      setManualLon(null);
                      setManualAddressLabel("");
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={Colors.mutedText}
                      style={{ marginLeft: 8 }}
                    />
                  </Pressable>
                )}
              </View>

             
              {manualSuggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {manualSuggestions.map((feat, index) => (
                    <Pressable
                      key={feat.id}
                      onPress={() => selectSuggestion(feat)}
                      style={[
                        styles.suggestionItem,
                        index === manualSuggestions.length - 1 &&
                          styles.suggestionItemLast,
                      ]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={Colors.primary}
                        style={{ marginTop: 1 }}
                      />
                      <AppText
                        variant="caption"
                        style={styles.suggestionText}
                        numberOfLines={2}
                      >
                        {feat.place_name}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              )}

              {manualLat != null ? (
                <View style={styles.confirmedRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.primary}
                  />
                  <AppText
                    variant="caption"
                    style={{ color: Colors.primary, flex: 1 }}
                  >
                    Location confirmed
                  </AppText>
                </View>
              ) : (
                !manualSearching &&
                manualQuery.length === 0 && (
                  <AppText variant="caption" style={styles.addressHint}>
                    Type at least 3 characters to search for an address.
                  </AppText>
                )
              )}

              {manualQuery.length >= 3 &&
                manualLat == null &&
                !manualSearching &&
                manualSuggestions.length === 0 && (
                  <AppText variant="caption" style={styles.addressHint}>
                    No results found. Try a different search.
                  </AppText>
                )}

              {manualQuery.length >= 3 &&
                manualLat == null &&
                !manualSearching &&
                manualSuggestions.length > 0 && (
                  <AppText variant="caption" style={styles.addressHint}>
                    Tap a suggestion above to confirm your address.
                  </AppText>
                )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <AppText variant="sectionTitle">Time</AppText>

          <AppText variant="caption" style={styles.selectedDateText}>
            {selectedDate ? formatNiceDate(selectedDate) : "Select a date"}
          </AppText>

          <AppText style={styles.timeLabel}>Pickup time slot</AppText>

          <View ref={(r) => (timeBoxRef.current = r)} collapsable={false}>
            <Pressable
              style={[
                styles.dropdownField,
                (!selectedDate ||
                  (pickupMode === "current" && currentLocLoading) ||
                  (pickupMode === "manual" && manualLat == null)) &&
                  styles.disabledField,
              ]}
              onPress={() => {
                if (!selectedDate) return;
                if (pickupMode === "current" && currentLocLoading) return;
                if (pickupMode === "manual" && manualLat == null) return;
                openTimeDropdown();
              }}
            >
              <AppText
                variant="body"
                style={!selectedTime ? styles.placeholder : styles.valueText}
              >
                {selectedTime ?? "Select time"}
              </AppText>
              <Ionicons
                name={timeOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.text}
              />
            </Pressable>
          </View>

          {!selectedDate ? (
            <AppText variant="caption" style={styles.helperText}>
              Please select a date first.
            </AppText>
          ) : pickupMode === "current" && currentLocLoading ? (
            <AppText variant="caption" style={styles.helperText}>
              Waiting for GPS to load before showing available slots...
            </AppText>
          ) : pickupMode === "manual" && manualLat == null ? (
            <AppText variant="caption" style={styles.helperText}>
              Please confirm your address before selecting a time slot.
            </AppText>
          ) : checkingSlots ? (
            <AppText variant="caption" style={styles.helperText}>
              Checking available slots for this location...
            </AppText>
          ) : null}
        </View>

        <View style={styles.section}>
          <AppText variant="sectionTitle">Approx. Oil Volume</AppText>
          <AppText variant="caption" style={styles.helperText}>
            Enter an estimate of your oil in litres (e.g., 1.5)
          </AppText>

          <View style={styles.inputField}>
            <TextInput
              value={volumeText}
              onChangeText={(t) => setVolumeText(sanitizeNumber(t))}
              placeholder="e.g. 1.0"
              placeholderTextColor={Colors.mutedText}
              keyboardType="decimal-pad"
              style={styles.textInput}
            />
            <AppText style={styles.unitText}>L</AppText>
          </View>

          {volumeTooLow ? (
            <AppText style={styles.errorText}>
              Minimum pickup volume is 1 litre. Please ensure that your oil volume
              is more than 1 Litre to schedule a pickup.
            </AppText>
          ) : null}
        </View>

        {/* SUBMIT */}
        <View style={styles.submitWrap}>
          <AppButton
            title={submitting ? "Submitting..." : "Submit"}
            variant="pill"
            fullWidth
            disabled={!canSubmit || submitting}
            onPress={handlePressSubmit}
          />
        </View>
      </ScrollView>

      <Modal transparent visible={timeOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={closeAllDropdowns}>
          <AnchoredMenu anchor={timeAnchor} maxHeightCap={320}>
            <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 320 }}>
              {timeSlots.map((slot) => {
                const active = selectedTime === slot;
                const booked = isSlotBooked(slot);

                return (
                  <Pressable
                    key={slot}
                    onPress={() => {
                      if (booked) {
                        Alert.alert(
                          "Unavailable",
                          "This time slot is already booked for this location."
                        );
                        return;
                      }
                      setSelectedTime(slot);
                      setTimeOpen(false);
                    }}
                    style={[
                      styles.menuItem,
                      active && styles.menuItemActive,
                      booked && styles.menuItemBooked,
                    ]}
                  >
                    <AppText
                      variant="body"
                      style={[
                        styles.menuText,
                        active && styles.menuTextActive,
                        booked && styles.menuTextBooked,
                      ]}
                    >
                      {slot} {booked ? " • Booked" : ""}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </AnchoredMenu>
        </Pressable>
      </Modal>

      <Modal transparent visible={confirmVisible} animationType="fade">
        <Pressable
          style={styles.confirmBackdrop}
          onPress={() => {
            if (submitting) return;
            setConfirmVisible(false);
          }}
        >
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <AppText variant="title" style={{ textAlign: "center" }}>
              Confirm Pickup
            </AppText>

            <View style={styles.confirmNoticeRow}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <AppText variant="caption" style={styles.confirmNoticeText}>
                {pickupMode === "profile"
                  ? "Pickup will be done at your saved profile address."
                  : pickupMode === "current"
                  ? "Pickup will be done at your current GPS location."
                  : "Pickup will be done at the address you typed."}
              </AppText>
            </View>

            <View style={{ marginTop: 8 }}>
              <ConfirmRow
                label="Date"
                value={selectedDate ? formatNiceDate(selectedDate) : "-"}
              />
              <ConfirmRow label="Time Slot" value={selectedTime ?? "-"} />
              <ConfirmRow label="Address" value={chosenAddressText || "-"} />
              <ConfirmRow
                label="Approx. Volume"
                value={volumeLitres !== null ? `${volumeLitres} L` : "-"}
              />
            </View>

            <View style={styles.confirmActions}>
              <AppButton
                title="Cancel"
                variant="cancel"
                onPress={() => {
                  if (submitting) return;
                  setConfirmVisible(false);
                }}
                style={{ flex: 1 }}
              />
              <AppButton
                title={submitting ? "" : "Confirm"}
                variant="save"
                onPress={handleConfirmSubmit}
                disabled={submitting}
                style={{ flex: 1 }}
              />
            </View>

            {submitting ? (
              <View style={{ marginTop: 12, alignItems: "center" }}>
                <ActivityIndicator />
                <AppText variant="caption" style={{ marginTop: 8 }}>
                  Saving to Supabase...
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <AppText variant="formLabel" style={{ opacity: 0.75 }}>
        {label}
      </AppText>
      <AppText variant="body" style={{ textAlign: "right", flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.radioRow}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function AnchoredMenu({
  anchor,
  children,
  maxHeightCap = 320,
}: {
  anchor: AnchorRect | null;
  children: React.ReactNode;
  maxHeightCap?: number;
}) {
  const { width: W, height: H } = Dimensions.get("window");

  const status = StatusBar.currentHeight ?? 0;
  const SAFE_TOP = Math.max(status, 12);
  const SAFE_BOTTOM = 18;

  const fallback = {
    left: 16,
    top: 260,
    width: W - 32,
    maxHeight: maxHeightCap,
  };

  if (!anchor) {
    return <View style={[styles.menu, fallback]}>{children}</View>;
  }

  const gap = 6;
  const desiredWidth = anchor.width;
  const left = clamp(anchor.x, 8, W - desiredWidth - 8);

  const belowTop = anchor.y + anchor.height + gap;
  const spaceBelow = H - SAFE_BOTTOM - belowTop;
  const spaceAbove = anchor.y - gap - SAFE_TOP;

  const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

  const maxHeight = Math.min(maxHeightCap, openBelow ? spaceBelow : spaceAbove);
  const safeMaxHeight = Math.max(140, maxHeight);

  const top = openBelow
    ? belowTop
    : Math.max(SAFE_TOP, anchor.y - gap - safeMaxHeight);

  return (
    <View
      style={[
        styles.menu,
        {
          left,
          top,
          width: desiredWidth,
          maxHeight: safeMaxHeight,
        },
      ]}
    >
      {children}
    </View>
  );
}

function OilDrop({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.dropWrap}>
      <View style={styles.dropPoint} />
      <View style={styles.dropCircle} />
      <View style={styles.dropContent}>{children}</View>
    </View>
  );
}

function formatNiceDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getTomorrowDateString() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  const y = tmr.getFullYear();
  const m = String(tmr.getMonth() + 1).padStart(2, "0");
  const d = String(tmr.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateOneHourSlots(startHour: number, endHour: number) {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h += 1) {
    const from = formatHour(h);
    const to = formatHour(h + 1);
    slots.push(`${from} - ${to}`);
  }
  return slots;
}

function formatHour(hour24: number) {
  const hour = hour24 % 24;
  const isPM = hour >= 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = isPM ? "PM" : "AM";
  return `${hour12}:00 ${suffix}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseLitres(text: string): number | null {
  const cleaned = text.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function sanitizeNumber(input: string) {
  const replaced = input.replace(",", ".");
  let out = replaced.replace(/[^\d.]/g, "");
  const parts = out.split(".");
  if (parts.length > 2) {
    out = parts[0] + "." + parts.slice(1).join("");
  }
  return out;
}

function parseTimeSlotToHHMMSS(
  slot: string
): { start: string; end: string } | null {
  if (!slot || !slot.includes("-")) return null;
  const [a, b] = slot.split("-").map((s) => s.trim());

  const to24 = (t: string) => {
    const parts = t.split(" ");
    if (parts.length < 2) return null;
    const time = parts[0];
    const ampm = parts[1].toUpperCase();
    const [hhStr, mmStr] = time.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

    let h24 = hh % 12;
    if (ampm === "PM") h24 += 12;
    if (ampm !== "AM" && ampm !== "PM") return null;

    const HH = String(h24).padStart(2, "0");
    const MM = String(mm).padStart(2, "0");
    return `${HH}:${MM}:00`;
  };

  const start = to24(a);
  const end = to24(b);
  if (!start || !end) return null;
  return { start, end };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 140 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    minHeight: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,125,50,0.12)",
  },
  headerText: {
    flex: 1,
    alignItems: "center",
    marginRight: 40,
  },

  calendarCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 8,
    borderWidth: 4,
    borderColor: Colors.primary,
    marginBottom: 18,
    overflow: "hidden",
  },
  calendar: { alignSelf: "stretch" },

  dayCell: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 14 },
  dayTextSelected: { fontSize: 13, fontWeight: "800" },
  dayCellDisabled: { opacity: 0.35 },
  dayTextDisabled: { color: Colors.mutedText },

  dropWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  dropPoint: {
    position: "absolute",
    top: 2,
    width: 14,
    height: 14,
    backgroundColor: YELLOW,
    transform: [{ rotate: "45deg" }],
    borderRadius: 3,
  },
  dropCircle: {
    position: "absolute",
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: YELLOW,
  },
  dropContent: { position: "absolute", top: 8 },

  section: { marginBottom: 16 },

  radioCard: {
    marginTop: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 10,
    gap: 10,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: Colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },

  noticeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.15)",
  },
  noticeText: { color: Colors.text, flex: 1 },

  addressCard: {
    marginTop: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 12,
  },
  addressLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  addressText: { color: Colors.text, lineHeight: 20 },
  addressMissing: { color: Colors.text, opacity: 0.85 },
  addressHint: { marginTop: 6, color: Colors.mutedText },

  // Mapbox search styles
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: FIELD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: FIELD_BG,
  },
  searchTextInput: {
    flex: 1,
    height: "100%",
    color: Colors.text,
    fontSize: 14,
  },
  suggestionsBox: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    backgroundColor: Colors.white,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    color: Colors.text,
    lineHeight: 18,
  },
  confirmedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },

  selectedDateText: { marginTop: 4, marginBottom: 6 },
  timeLabel: { marginTop: 6, marginBottom: 6, color: Colors.text, fontSize: 14 },

  dropdownField: {
    marginTop: 4,
    height: 48,
    borderRadius: 10,
    backgroundColor: FIELD_BG,
    borderWidth: 1.2,
    borderColor: FIELD_BORDER,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  disabledField: { opacity: 0.6 },

  placeholder: { color: Colors.mutedText },
  valueText: { color: Colors.text },

  helperText: { marginTop: 8, color: Colors.mutedText },

  inputField: {
    marginTop: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: FIELD_BORDER,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    height: "100%",
    color: Colors.text,
    fontSize: 14,
  },
  unitText: {
    marginLeft: 10,
    color: Colors.mutedText,
    fontSize: 13,
  },
  errorText: {
    marginTop: 8,
    color: Colors.error ?? "#D32F2F",
    fontSize: 12.5,
  },

  submitWrap: { marginTop: 8 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.05)" },

  menu: {
    position: "absolute",
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MENU_BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: MENU_SHADOW_OPACITY,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  menuItem: { height: 44, paddingHorizontal: 14, justifyContent: "center" },
  menuItemActive: { backgroundColor: "rgba(242,201,76,0.30)" },
  menuItemBooked: { opacity: 0.45 },
  menuText: { fontSize: 13 },
  menuTextActive: { fontWeight: "700" },
  menuTextBooked: { textDecorationLine: "line-through" },

  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    elevation: 8,
  },

  confirmNoticeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.15)",
  },
  confirmNoticeText: { flex: 1, color: Colors.text },

  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 16 },
});
