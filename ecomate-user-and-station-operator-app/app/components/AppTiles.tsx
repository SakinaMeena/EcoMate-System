// components/AppTiles.tsx
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import Colors from "../constants/colors";

export type TileItem = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

type Props = {
  data: TileItem[];
};

export default function AppTiles({ data }: Props) {
  return (
    <View style={styles.grid}>
      {data.map((item, index) => (
        <Pressable key={index} style={styles.tile} onPress={item.onPress}>
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={30} color={Colors.primary} />
          </View>

          <AppText style={styles.title}>{item.title}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },

  tile: {
    width: "48%",
    backgroundColor: Colors.ecoTileBg,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.ecoTileIconBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
    lineHeight: 16,
  },
});
