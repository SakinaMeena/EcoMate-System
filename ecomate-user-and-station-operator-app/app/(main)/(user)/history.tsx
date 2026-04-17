import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import AppLayout from "../../components/AppLayout";
import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type Dropoff = {
  dropoff_id: string;
  actual_volume: number | null;
  estimated_volume: number | null;
  status: string;
  dropoff_type: string;
  collected_at: string | null;
  created_at: string;
  batch_id: string | null;
  route_id: string | null;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "collected":
      return "Collected";
    case "sent_to_depot":
      return "Out to Depot";
    case "reached_depot":
      return "Reached Depot";
    default:
      return status;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "collected":
      return "#F5A623";
    case "sent_to_depot":
      return "#4A90D9";
    case "reached_depot":
      return Colors.primary;
    default:
      return "#9AA0A6";
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTypeLabel(type: string) {
  switch (type) {
    case "self_delivery":
      return "Station Drop-off";
    case "home_pickup":
      return "Home Pickup";
    default:
      return type;
  }
}

export default function History() {
  const [dropoffs, setDropoffs] = useState<Dropoff[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: stationDropoffs } = await supabase
          .from("dropoffs")
          .select("dropoff_id, actual_volume, estimated_volume, dropoff_type, collected_at, created_at, status, batch_id, route_id")
          .eq("user_id", user.id)
          .eq("status", "reached_depot")
          .not("batch_id", "is", null);

        const { data: routeDropoffs } = await supabase
          .from("dropoffs")
          .select("dropoff_id, actual_volume, estimated_volume, dropoff_type, collected_at, created_at, status, batch_id, route_id")
          .eq("user_id", user.id)
          .not("route_id", "is", null);

        let confirmedRouteDropoffs: Dropoff[] = [];
        if (routeDropoffs && routeDropoffs.length > 0) {
          const routeIds = [...new Set(routeDropoffs.map((d: any) => d.route_id))];

          const { data: confirmedRoutes } = await supabase
            .from("routes")
            .select("route_id")
            .in("route_id", routeIds)
            .eq("depot_transfer_confirmed", true);

          const confirmedRouteIds = new Set(
            confirmedRoutes?.map((r: any) => r.route_id)
          );

          confirmedRouteDropoffs = routeDropoffs.filter((d: any) =>
            confirmedRouteIds.has(d.route_id)
          ) as Dropoff[];
        }

        const all = [...(stationDropoffs || []), ...confirmedRouteDropoffs];

        const unique = all.filter(
          (d, i, arr) =>
            arr.findIndex((x) => x.dropoff_id === d.dropoff_id) === i
        );

        unique.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

        setDropoffs(unique as Dropoff[]);
      } catch (err) {
        console.error("History fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        data={dropoffs}
        keyExtractor={(item) => item.dropoff_id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <AppText variant="header" style={styles.title}>
              UCO TRANSACTION HISTORY
            </AppText>

            <AppText variant="body" style={styles.headerSubtitle}>
              Track your UCO transaction status
            </AppText>

            <View style={styles.buttonWrap}>
              <AppButton
                title="VIEW UCO JOURNEY"
                variant="role"
                fullWidth
                onPress={() => router.push("/(main)/(user)/uco-journey")}
              />
            </View>

            {loading && (
              <ActivityIndicator
                size="large"
                color={Colors.primary}
                style={{ marginTop: 20 }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const volume = item.actual_volume ?? item.estimated_volume ?? 0;

          return (
            <View style={styles.txCard}>
              <View style={styles.left}>
                <AppText style={styles.txType}>
                  {getTypeLabel(item.dropoff_type)}
                </AppText>

                <AppText style={styles.txVolume}>
                  {Number(volume).toFixed(1)} L
                </AppText>
              </View>

              <View style={styles.right}>
                <AppText style={styles.txDate}>
                  {formatDate(item.collected_at ?? item.created_at)}
                </AppText>

                <AppText style={styles.txStatus}>Reached Depot</AppText>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <AppText variant="body" style={styles.emptyText}>
                No transactions yet.
              </AppText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  list: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
  },

  title: {
    textAlign: "center",
    color: Colors.primary,
    marginBottom: 10,
  },

  headerSubtitle: {
    textAlign: "center",
    color: "#8F8F8F",
    fontSize: 16,
    marginBottom: 26,
  },

  buttonWrap: {
    marginBottom: 26,
  },

  txCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingVertical: 22,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  left: {
    flex: 1,
    paddingRight: 16,
  },

  right: {
    alignItems: "flex-end",
  },

  txType: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1E1E",
    marginBottom: 6,
  },

  txDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8F8F8F",
    marginBottom: 4,
  },

  txVolume: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
  },

  txStatus: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  emptyWrap: {
    paddingTop: 10,
    alignItems: "center",
  },

  emptyText: {
    color: "#7C7C7C",
  },
});