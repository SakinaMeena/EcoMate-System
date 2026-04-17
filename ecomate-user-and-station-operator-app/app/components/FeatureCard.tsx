import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppText from "./AppText";
import Colors from "../constants/colors";

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: React.ReactNode;
  onPress?: () => void;
};

export default function FeatureCard({ title, icon, value, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>

      <View style={styles.textWrap}>
        <AppText style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
      </View>

      <View style={styles.valueWrap}>{value}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F4EA",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: "100%",
    minHeight: 96,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#D2ECD9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },

  textWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    justifyContent: "center",
  },

  title: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    lineHeight: 18,
    flexShrink: 1,
  },

  
  valueWrap: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
  },
});