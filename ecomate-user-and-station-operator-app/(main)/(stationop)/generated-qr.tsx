// app/(main)/(stationop)/generated-qr.tsx
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import Colors from "../../constants/colors";
import AppText from "../../components/AppText";
import AppButton from "../../components/AppButton";

export default function GeneratedQrScreen() {
  const router = useRouter();

  const { confirmationToken, stationName, volume, userEmail, shortCode } = useLocalSearchParams();

  const [showCode, setShowCode] = useState(false);

  const onDone = () => {
    router.replace("/(main)/(stationop)/dashboard");
  };

  return (
    <View style={styles.screen}>
    
      <View style={styles.header}>
        <AppText variant="header" style={styles.title}>
          {showCode ? "GENERATED CODE" : "GENERATED QR"}
        </AppText>

        <AppText variant="caption" style={styles.subtitle}>
          {showCode
            ? "Enter this code to confirm delivery logging"
            : "Scan this QR to confirm delivery logging"}
        </AppText>
      </View>

      
      <View style={styles.card}>
        {/* QR Code OR 6-digit code */}
        <View style={styles.qrBox}>
          {!showCode ? (
            confirmationToken ? (
              <QRCode
                value={String(confirmationToken)}
                size={200}
              />
            ) : (
              <AppText variant="body" style={styles.qrPlaceholderText}>
                No QR token found
              </AppText>
            )
          ) : (
            <View style={styles.codeContainer}>
              <AppText variant="caption" style={styles.codeLabel}>
                Confirmation Code
              </AppText>
              <AppText variant="header" style={styles.codeText}>
                {shortCode ?? "------"}
              </AppText>
            </View>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <AppButton
            title="DONE"
            variant="pill"
            fullWidth
            onPress={onDone}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          {!showCode ? (
            <AppButton
              title="SHOW CODE"
              variant="pill"
              fullWidth
              onPress={() => setShowCode(true)}
            />
          ) : (
            <AppButton
              title="SHOW QR"
              variant="pill"
              fullWidth
              onPress={() => setShowCode(false)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 50,
  },
  title: {
    textAlign: "center",
    color: Colors.primary,
    letterSpacing: 1,
    fontSize: 20,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.mutedText,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  qrBox: {
    height: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    color: Colors.primary,
  },
  codeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  codeLabel: {
    color: Colors.mutedText,
    marginBottom: 10,
    textAlign: "center",
  },
  codeText: {
    color: Colors.primary,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
  },
});