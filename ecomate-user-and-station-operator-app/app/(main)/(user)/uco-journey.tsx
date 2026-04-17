// app/(main)/(user)/uco-journey.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";


import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type Step = {
  id: number;
  title: string;
  subtitle: string;
};

const steps: Step[] = [
  {
    id: 1,
    title: "UCO Collected",
    subtitle: "Your UCO has been collected at the station or picked up",
  },
  {
    id: 2,
    title: "UCO Out to Depot",
    subtitle: "Your UCO is on the way to the depot",
  },
  {
    id: 3,
    title: "UCO Reached Depot",
    subtitle: "Your UCO has arrived at the final depot",
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function UcoJourney() {
  const router = useRouter();
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [loading, setLoading] = useState(true);

  // “current pending transaction” display (UI only)
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [latestVolume, setLatestVolume] = useState<number | null>(null);

  // progress bar width for moving icon
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("dropoffs")
          .select("status, batch_id, created_at, actual_volume, estimated_volume")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) return;

        setLatestDate(data.created_at ?? null);
        const vol =
          data.actual_volume ?? data.estimated_volume ?? (null as number | null);
        setLatestVolume(vol);

        let batchStatus: string | null = null;
        if (data.batch_id) {
          const { data: batch } = await supabase
            .from("batches")
            .select("status")
            .eq("batch_id", data.batch_id)
            .single();
          batchStatus = batch?.status ?? null;
        }

        if (batchStatus === "delivered") {
          setCompletedUpTo(3);
        } else if (batchStatus === "in_transit_to_depot") {
          setCompletedUpTo(2);
        } else if (data.status === "collected") {
          setCompletedUpTo(1);
        } else {
          setCompletedUpTo(0);
        }
      } catch (err) {
        console.error("Journey fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  // progress UI calculations
  const progressPct = Math.max(0, Math.min(1, completedUpTo / 3));
  const isStep1Done = completedUpTo >= 1;
  const isStep2Done = completedUpTo >= 2;
  const isStep3Done = completedUpTo >= 3;

  const progressPercentText = `${Math.round(progressPct * 100)}%`;
  const statusPillText = completedUpTo >= 3 ? "COMPLETED" : "IN PROGRESS";

  const statusTitleText =
    completedUpTo <= 0
      ? "Waiting for collection"
      : completedUpTo === 1
      ? "Collected"
      : completedUpTo === 2
      ? "Out to depot"
      : "Reached depot";

  const MARKER_SIZE = 22;
  const markerLeft =
    barWidth <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            barWidth - MARKER_SIZE,
            progressPct * barWidth - MARKER_SIZE / 2
          )
        );

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  return (
    <ScrollView
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText variant="header" style={styles.title}>
        YOUR UCO JOURNEY
      </AppText>

      {/* Journey status card (auto-updates) */}
      <View style={styles.statusCard}>
        <View style={styles.statusTopRow}>
          <View style={styles.statusPill}>
            <AppText style={styles.statusPillText}>{statusPillText}</AppText>
          </View>

          <AppText style={styles.statusPercent}>{progressPercentText}</AppText>
        </View>

        <View style={styles.statusMidRow}>
          <Ionicons
            name="time-outline"
            size={16}
            color={Colors.primary}
            style={{ marginRight: 8 }}
          />
          <AppText style={styles.statusTitle}>{statusTitleText}</AppText>
        </View>

        <View style={styles.statusBarWrap} onLayout={onBarLayout}>
          <View style={styles.statusBarBase} />
          <View
            style={[
              styles.statusBarFill,
              { width: `${progressPct * 100}%` },
            ]}
          />

          <View style={[styles.progressMarker, { left: markerLeft }]}>
            <Ionicons name="water" size={14} color={Colors.ecoYellow} />
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Colors.primary}
              style={{ marginRight: 6 }}
            />
            <AppText style={styles.metaText}>
              {latestDate ? formatDate(latestDate) : "—"}
            </AppText>
          </View>

          <View style={styles.metaDot} />

          <View style={styles.metaItem}>
            <Ionicons
              name="water"
              size={14}
              color={Colors.ecoYellow}
              style={{ marginRight: 6 }}
            />
            <AppText style={styles.metaText}>
              {latestVolume != null ? `${latestVolume} L` : "—"}
            </AppText>
          </View>
        </View>

        <AppText style={styles.statusDesc}>
          Follow your UCO’s journey as it moves from collection to final depot
          processing.
        </AppText>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <View style={styles.timeline}>
          {steps.map((step, index) => {
            const isCompleted = step.id <= completedUpTo;
            const isLast = index === steps.length - 1;

            return (
              <View key={step.id} style={styles.stepRow}>
              
                <View style={styles.leftCol}>
                  <View
                    style={[
                      styles.circle,
                      isCompleted
                        ? styles.circleCompleted
                        : styles.circlePending,
                    ]}
                  >
                    {isCompleted ? (
                      <AppText style={styles.check}>✓</AppText>
                    ) : (
                      <AppText style={styles.number}>{step.id}</AppText>
                    )}
                  </View>

                  {!isLast && <View style={styles.line} />}
                </View>

                
                <View style={styles.rightCol}>
                  <AppText variant="header" style={styles.stepTitle}>
                    {step.title}
                  </AppText>

                  <AppText variant="caption" style={styles.stepSubtitle}>
                    {step.subtitle}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.btnWrap}>
        <AppButton
          title="VIEW HISTORY"
          variant="role"
          fullWidth
          onPress={() => router.push("/(main)/(user)/history")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  title: {
    textAlign: "center",
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: 18,
  },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(36, 91, 67, 0.10)",
    marginBottom: 18,
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(36, 91, 67, 0.12)",
  },
  statusPillText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  statusPercent: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  statusMidRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statusTitle: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  statusBarWrap: {
    height: 10,
    borderRadius: 999,
    overflow: "visible",
    marginBottom: 12,
    position: "relative",
  },
  statusBarBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
    borderRadius: 999,
  },
  statusBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },

  // moving icon
  progressMarker: {
    position: "absolute",
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    color: "#3b3b3b",
    fontSize: 12,
    fontWeight: "800",
    opacity: 0.85,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginHorizontal: 10,
  },
  statusDesc: {
    color: "#3b3b3b",
    opacity: 0.75,
    fontSize: 12,
    lineHeight: 16,
  },

  timeline: {
    paddingHorizontal: 6,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  leftCol: {
    width: 48,
    alignItems: "center",
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  circleCompleted: {
    backgroundColor: Colors.primary,
  },
  circlePending: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  check: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginTop: -1,
  },
  number: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  line: {
    width: 3,
    height: 52,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 10,
    opacity: 0.9,
  },
  rightCol: {
    flex: 1,
    paddingTop: 2,
    paddingRight: 8,
  },
  stepTitle: {
    color: Colors.primary,
    fontSize: 18,
    marginBottom: 6,
  },
  stepSubtitle: {
    color: "#3b3b3b",
    opacity: 0.75,
    lineHeight: 18,
  },
  btnWrap: {
    marginTop: 26,
    paddingHorizontal: 6,
  },
});