import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Animated,
  Easing,
  TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import AppText from "../../components/AppText";
import BackButton from "../../components/BackButton";
import Colors from "../../constants/colors";

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState(["", "", "", "", "", ""]);
  const [manualError, setManualError] = useState("");

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const frameScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const frameOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  const onBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      try {
        const response = await fetch(
          "https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-self-delivery-confirm",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.API_TOKEN}`,
            },
            body: JSON.stringify({
              confirmationToken: data,
            }),
          }
        );

        const result = await response.json();
        console.log("CONFIRM RESPONSE:", JSON.stringify(result));

        if (result.success) {
          Alert.alert("Success!", "Your delivery has been confirmed.", [
            { text: "OK", onPress: () => setScanned(false) },
          ]);
        } else {
          Alert.alert("Failed", result.error || "Could not confirm delivery.", [
            { text: "Try Again", onPress: () => setScanned(false) },
          ]);
        }
      } catch (err) {
        console.error("Confirm error:", err);
        Alert.alert("Error", "Something went wrong. Please try again.", [
          { text: "OK", onPress: () => setScanned(false) },
        ]);
      }
    },
    [scanned]
  );

  const handleGrantPermission = useCallback(async () => {
    const res = await requestPermission();

    if (!res.granted) {
      Alert.alert(
        "Camera permission needed",
        "You previously denied camera access. Please enable it in Settings to scan QR codes.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [requestPermission]);

  const handleManualChange = (text: string, index: number) => {
    setManualError("");
    const clean = text.replace(/[^0-9]/g, "").slice(-1);
    const updated = [...manualCode];
    updated[index] = clean;
    setManualCode(updated);
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleManualKeyPress = (
    e: { nativeEvent: { key: string } },
    index: number
  ) => {
    if (e.nativeEvent.key === "Backspace" && !manualCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleManualSubmit = async () => {
    const enteredCode = manualCode.join("").trim();

    if (enteredCode.length !== 6) {
      setManualError("Please enter the full 6-digit code.");
      return;
    }

    try {
      const response = await fetch(
        "https://olixlbwdwlbmuratrirh.supabase.co/functions/v1/log-self-delivery-confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_TOKEN}`,
          },
          body: JSON.stringify({
            confirmationToken: enteredCode,
          }),
        }
      );

      const result = await response.json();
      console.log("CONFIRM RESPONSE:", JSON.stringify(result));

      if (result.success) {
        Alert.alert("Success!", "Your delivery has been confirmed.", [
          {
            text: "OK",
            onPress: () => {
              setManualCode(["", "", "", "", "", ""]);
              setManualError("");
              setManualMode(false);
            },
          },
        ]);
      } else {
        setManualError(result.error || "Invalid confirmation code.");
      }
    } catch (err) {
      console.error("Confirm error:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <AppText>Loading camera…</AppText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <BackButton />
        <AppText variant="sectionTitle" style={{ textAlign: "center" }}>
          Camera Permission Required
        </AppText>
        <AppText style={styles.permissionText}>
          Please allow camera access to scan QR codes.
        </AppText>
        <Pressable style={styles.button} onPress={handleGrantPermission}>
          <AppText style={styles.buttonText}>Grant Permission</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {manualMode ? (
        <>
          <View style={styles.manualHeaderWrap}>
            <AppText variant="header" style={styles.title}>
              ENTER CODE
            </AppText>
          </View>

          <AppText style={styles.helper}>Enter the 6-digit code provided</AppText>

          <View style={styles.codeRow}>
            {manualCode.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleManualChange(text, index)}
                onKeyPress={(e) => handleManualKeyPress(e, index)}
                style={[
                  styles.codeBox,
                  manualError ? styles.codeBoxError : null,
                ]}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          {manualError ? (
            <AppText style={styles.errorText}>{manualError}</AppText>
          ) : null}

          <Pressable style={styles.button} onPress={handleManualSubmit}>
            <AppText style={styles.buttonText}>Confirm Code</AppText>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setManualCode(["", "", "", "", "", ""]);
              setManualError("");
              setManualMode(false);
            }}
          >
            <AppText style={styles.secondaryButtonText}>
              Go Back to Scan QR
            </AppText>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.headerRow}>
            <BackButton />
            <AppText variant="header" style={styles.title}>
              SCAN QR CODE
            </AppText>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
            />

            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.glow} />
              <Animated.View
                style={[
                  styles.frame,
                  {
                    transform: [{ scale: frameScale }],
                    opacity: frameOpacity,
                  },
                ]}
              >
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </Animated.View>
            </View>
          </View>

          <AppText style={styles.helper}>
            {scanned
              ? "Scanned! Tap Scan Again."
              : "Align the QR code inside the frame"}
          </AppText>

          <AppText style={styles.manualText}>
            Can&apos;t scan? Enter the code given
          </AppText>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => setManualMode(true)}
          >
            <AppText style={styles.secondaryButtonText}>Enter Code</AppText>
          </Pressable>

          <Pressable style={styles.button} onPress={() => setScanned(false)}>
            <AppText style={styles.buttonText}>Scan Again</AppText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 110,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  manualHeaderWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  cameraWrap: {
    height: 380,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    width: FRAME_SIZE + 36,
    height: FRAME_SIZE + 36,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  frame: {
    position: "absolute",
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "rgba(255,255,255,0.95)",
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  helper: {
    marginTop: 12,
    textAlign: "center",
    opacity: 0.85,
  },
  manualText: {
    marginTop: 14,
    textAlign: "center",
    opacity: 0.85,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 28,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "#fff",
    fontSize: 22,
    fontWeight: "700",
    color: Colors.primary,
  },
  codeBoxError: {
    borderColor: Colors.error,
  },
  errorText: {
    marginTop: -10,
    marginBottom: 12,
    textAlign: "center",
    color: Colors.error,
    fontWeight: "600",
  },
  button: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    marginTop: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: "700",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: Colors.background,
  },
  permissionText: {
    textAlign: "center",
    opacity: 0.85,
  },
});