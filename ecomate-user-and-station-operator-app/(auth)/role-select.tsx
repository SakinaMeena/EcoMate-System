import { useRouter } from "expo-router";
import React from "react";
import { Image, StyleSheet, View } from "react-native";

import AppButton from "../components/AppButton";
import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import Colors from "../constants/colors";

export default function RoleSelect() {
  const router = useRouter();

  return (
    <AppLayout>
      <View style={styles.container}>
        {/* EcoMate Logo */}
        <Image
          source={require("../../assets/images/ecomate-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Welcome + Buttons */}
        <View style={styles.roleBlock}>
          <View style={styles.welcomeRow}>
            <View style={styles.line} />
            <AppText style={styles.welcome}>WELCOME</AppText>
            <View style={styles.line} />
          </View>

          <View style={styles.buttons}>
            <AppButton
              title="USER"
              variant="role"
              onPress={() => router.push("/(auth)/user-login")}
            />

            <AppButton
              title="STATION OPERATOR"
              variant="role"
              onPress={() => router.push("/(auth)/station-login")}
            />
          </View>
        </View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: "70%",
    maxWidth: 200,
    height: 230,
    marginBottom: 20,
    marginTop: -110,
  },

  roleBlock: {
    width: "100%",
    gap: 18,
    marginTop: 10,
  },

  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 14,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(30,122,87,0.25)",
  },

  welcome: {
    color: Colors.primary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8,
  },

  buttons: {
    width: "100%",
    gap: 14,
  },
});