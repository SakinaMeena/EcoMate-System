import React from "react";
import { Tabs } from "expo-router";
import StationOperatorTabBar from "../../components/StationOperatorTabBar";

export default function StationTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <StationOperatorTabBar {...props} />}
    >
      <Tabs.Screen name="station-dashboard" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

