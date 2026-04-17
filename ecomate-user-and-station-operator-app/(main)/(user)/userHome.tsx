// app/(main)/(user)/userHome.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Text,
  Image,
} from "react-native";
import { useRouter } from "expo-router";

import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";

const CO2_KG_PER_LITRE = 2.5;
const WATER_L_PER_LITRE = 1000000;

type DashboardStats = {
  totalUcoLitres: number;
  co2ReducedKg: number;
  waterSavedL: number;
};

export default function UserHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUcoLitres: 0,
    co2ReducedKg: 0,
    waterSavedL: 0,
  });

  // ---------- FORMAT VALUES ----------
  const formatted = useMemo(() => {
    return {
      totalUco:
        stats.totalUcoLitres > 0
          ? `${stats.totalUcoLitres.toFixed(1)} L`
          : "—",
      co2:
        stats.co2ReducedKg > 0
          ? `${Math.round(stats.co2ReducedKg)} kg`
          : "—",
      water:
        stats.waterSavedL > 0
          ? stats.waterSavedL >= 1000000
            ? `${(stats.waterSavedL / 1000000).toFixed(1)}M L`
            : `${stats.waterSavedL} L`
          : "—",
    };
  }, [stats]);

  // ---------- FETCH DATA ----------
  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: rows } = await supabase
      .from("dropoffs")
      .select("status, actual_volume")
      .eq("user_id", user.id);

    const collected = (rows ?? []).filter(
      (r) => r.status === "collected"
    );

    const totalLitres = collected.reduce((sum, r) => {
      const v = Number(r.actual_volume ?? 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    setStats({
      totalUcoLitres: totalLitres,
      co2ReducedKg: totalLitres * CO2_KG_PER_LITRE,
      waterSavedL: totalLitres * WATER_L_PER_LITRE,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/role-select");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="header" style={styles.title}>
          HOME DASHBOARD
        </AppText>

        <View style={styles.topCard}>
          <View style={styles.topIconWrap}>
            <Image
              source={require("../../../assets/images/oil-drop.png")}
              style={styles.topImage}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1 }}>
            <AppText style={styles.topLabel}>
              Total UCO Collected
            </AppText>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <AppText style={styles.topValue}>
                {formatted.totalUco}
              </AppText>
            )}
          </View>
        </View>

        {/* SUMMARY CARDS */}
        <View style={styles.grid}>
          {/* CO2 */}
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <AppText style={styles.emoji}>🍃</AppText>
            </View>

            <AppText style={styles.cardTitle}>
              CO₂{"\n"}Reduced
            </AppText>

            <View style={styles.divider} />

            <AppText style={styles.cardValue}>
              {formatted.co2}
            </AppText>
          </View>

          {/* WATER */}
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <AppText style={styles.emoji}>💧</AppText>
            </View>

            <AppText style={styles.cardTitle}>
              Water{"\n"}Protected
            </AppText>

            <View style={styles.divider} />

            <AppText style={styles.cardValue}>
              {formatted.water}
            </AppText>
          </View>
        </View>

        <Text style={styles.footnote}>
          Your contribution helps Malaysia's B20 biodiesel goals.
        </Text>

        
        <View style={styles.buttons}>
          <AppButton
            title="SCHEDULE A PICKUP"
            variant="pill"
            fullWidth
            onPress={() =>
              router.push("/(main)/(user)/schedulePickup")
            }
          />
          <AppButton
            title="VIEW HISTORY"
            variant="pill"
            fullWidth
            onPress={() =>
              router.push("/(main)/(user)/history")
            }
          />
          <AppButton
            title="LOGOUT"
            variant="pill"
            fullWidth
            onPress={onLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screen: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    textAlign: "center",
    color: Colors.primary,
    marginBottom: 12,
  },

  topCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    elevation: 2,
  },
  topIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  topImage: {
    width: 44,
    height: 44,
  },
  topLabel: {
    fontSize: 13,
    color: Colors.mutedText,
    marginBottom: 4,
  },
  topValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.primary,
  },

  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },

  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    height: 185,
    elevation: 3,
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emoji: {
    fontSize: 28,
    lineHeight: 34,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
    textAlign: "center",
    marginBottom: 10,
  },

  divider: {
    width: "70%",
    height: 1,
    backgroundColor: "#E7EEE9",
    marginBottom: 12,
  },

  //FIXED NUMBER CROPPING HERE
  cardValue: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.primary,
    textAlign: "center",
    lineHeight: 30,   // prevents clipping
    paddingTop: 0,    // extra breathing room
  },

  footnote: {
    fontSize: 14,
    color: "#4f6693",
    textAlign: "center",
    marginVertical: 14,
    paddingHorizontal: 20,
  },

  buttons: {
    gap: 10,
    paddingHorizontal: 10,
  },
});