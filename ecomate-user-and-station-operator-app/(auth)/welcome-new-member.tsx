// app/(auth)/welcome-new-user.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import Colors from "../constants/colors";

export default function WelcomeNewUser() {
  const router = useRouter();

  // --- animation values ---
  const oilOpacity = useRef(new Animated.Value(1)).current;
  const oilScale = useRef(new Animated.Value(1)).current;
  const oilRotate = useRef(new Animated.Value(0)).current;

  const leafOpacity = useRef(new Animated.Value(0)).current;
  const leafScale = useRef(new Animated.Value(0.6)).current;
  const leafRotate = useRef(new Animated.Value(-25)).current;

  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.9)).current;

  const buttonPulse = useRef(new Animated.Value(1)).current;

  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
  
    Animated.sequence([
    
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.15,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(150),

      Animated.parallel([
        Animated.timing(oilOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(oilScale, {
          toValue: 0.75,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(oilRotate, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(leafOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(leafScale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(leafRotate, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setIsDone(true));
  }, [glowOpacity, glowScale, leafOpacity, leafRotate, leafScale, oilOpacity, oilRotate, oilScale]);

  useEffect(() => {

    if (!isDone) return;

    Animated.sequence([
      Animated.timing(buttonPulse, {
        toValue: 1.04,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonPulse, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(250),
      Animated.timing(buttonPulse, {
        toValue: 1.04,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonPulse, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isDone, buttonPulse]);

  const oilSpin = oilRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "18deg"],
  });

  const leafSpin = leafRotate.interpolate({
    inputRange: [-25, 0],
    outputRange: ["-25deg", "0deg"],
  });

  return (
    <AppLayout>
      <View style={styles.wrap}>
       
        <View style={styles.iconStage}>
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.iconLayer,
              {
                opacity: oilOpacity,
                transform: [{ scale: oilScale }, { rotate: oilSpin }],
              },
            ]}
          >
            <MaterialCommunityIcons name="oil" size={54} color={Colors.primary} />
          </Animated.View>

          <Animated.View
            style={[
              styles.iconLayer,
              {
                opacity: leafOpacity,
                transform: [{ scale: leafScale }, { rotate: leafSpin }],
              },
            ]}
          >
            <MaterialCommunityIcons name="leaf" size={54} color={Colors.primary} />
          </Animated.View>
        </View>

        <AppText style={styles.title}>WELCOME, ECO WARRIOR 🌱</AppText>

        <AppText style={styles.subtitle}>
          You&apos;ve taken the first step toward{"\n"}
          responsibly recycling used cooking oil{"\n"}
          and keeping our environment clean.
        </AppText>

        <Animated.View style={{ transform: [{ scale: buttonPulse }], width: "100%" }}>
          <AppButton
            title="START MY OIL RECYCLING JOURNEY"
            variant="role"
            fullWidth
            onPress={() => router.replace("/(main)/(user)/userHome")}
          />
        </Animated.View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  iconStage: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  iconLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.secondary,
  },

  title: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: Colors.primary,
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 18,
  },
});
