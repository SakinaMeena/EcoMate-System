import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";
import { getCurrentUserEmail } from '../../lib/getCurrentUserEmail'; // your working path

export default function StationDashboard() {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmail() {
      const email = await getCurrentUserEmail();
      setCurrentEmail(email);
    }
    loadEmail();
  }, []);

  return (
    <View style={styles.container}>
      <AppText variant="header" style={styles.title}>
        STATION OPERATOR DASHBOARD
      </AppText>

      {currentEmail ? (
        <AppText
          style={{
            textAlign: "center",
            marginTop: 12,
            marginBottom: 24,
            fontSize: 16,
            color: Colors.primary,
            fontWeight: "600",
          }}
        >
          Logged in as: {currentEmail}
        </AppText>
      ) : (
        <AppText
          style={{
            textAlign: "center",
            marginTop: 12,
            marginBottom: 24,
            fontSize: 14,
            color: "orange",
          }}
        >
          Loading your email...
        </AppText>
      )}

      <View style={styles.imageWrap}>
        <Image
          source={require("../../../assets/images/station.png")}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <View style={styles.buttonsContainer}>
        <AppButton
          title="LOG COLLECTION"
          variant="role"
          fullWidth
          onPress={() => router.push("/(main)/(stationop)/collection-logging")}
        />
        <AppButton
          title="DEPOT TRANSFER"
          variant="role"
          fullWidth
          onPress={() => router.push("/(main)/(stationop)/depot-transfer")}
        />
        <AppButton
          title="LOGOUT"
          variant="role"
          fullWidth
          onPress={() => router.replace("/(auth)/role-select")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    textAlign: "center",
    color: Colors.primary,
  },
  imageWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  image: {
    width: 240,
    height: 240,
  },
  buttonsContainer: {
    width: "100%",
    gap: 14,
  },
});