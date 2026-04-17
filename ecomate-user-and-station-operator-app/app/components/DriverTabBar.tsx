import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import Colors from "../constants/colors";
import AppText from "./AppText";

type TabItem = {
  key: "driver-dashboard" | "profile";
  label: string;
};

export default function DriverTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const tabs: TabItem[] = [
    { key: "driver-dashboard", label: "Home" },
    { key: "profile", label: "Profile" },
  ];

  const goTo = (name: TabItem["key"]) => {
    navigation.navigate(name as never);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const routeIndex = state.routes.findIndex(
            (r) => r.name === tab.key
          );
          const active = state.index === routeIndex;

          
          const color = active ? Colors.icon : "rgba(255,255,255,0.75)";

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              onPress={() => goTo(tab.key)}
              android_ripple={{
                color: "rgba(255,255,255,0.12)",
                borderless: true,
              }}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
            >
              {tab.key === "driver-dashboard" ? (
                <Ionicons name="home-sharp" size={26} color={color} />
              ) : (
                <Ionicons name="person" size={24} color={color} />
              )}

              <AppText style={[styles.label, { color }]}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
    zIndex: 999,
    elevation: 999,
  },
  bar: {
    width: "88%",
    height: 60,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14, 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tab: {
    width: 70, 
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.14)", 
  },
  tabPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.95,
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "center",
  },
});
