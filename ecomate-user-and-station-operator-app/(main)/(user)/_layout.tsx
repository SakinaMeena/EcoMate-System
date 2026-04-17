// app/(main)/(user)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import UserTabBar from "../../components/UserTabBar";

export default function UserTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <UserTabBar {...props} />}
    >
      <Tabs.Screen name="userHome" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
