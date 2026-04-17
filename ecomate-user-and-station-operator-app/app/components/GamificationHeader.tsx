import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Colors from "../constants/colors";
import AppText from "./AppText";

type Props = {
  title?: string;
};

export default function GamificationHeader({ title }: Props) {
  const router = useRouter();

  const goHome = () => {
    router.replace("/(main)/(user)/userHome");
  };

  const goBack = () => {
    if (router.canGoBack?.()) router.back();
    else goHome();
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      
      <Pressable onPress={goBack} hitSlop={12} style={styles.side}>
        <Ionicons name="arrow-back" size={32} color={Colors.primary} />
      </Pressable>

      {!!title && (
        <View style={styles.center} pointerEvents="none">
          <AppText variant="header" style={styles.title}>
            {title}
          </AppText>
        </View>
      )}

      <Pressable onPress={goHome} hitSlop={12} style={[styles.side, styles.right]}>
        <Ionicons name="home-sharp" size={26} color={Colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 15,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  side: {
    width: 60,
    alignItems: "flex-start",
  },
  right: {
    alignItems: "flex-end",
  },
  center: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    color: Colors.primary,
    textAlign: "center",
    top: 4,
  },
});
