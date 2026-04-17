import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import Colors from "../constants/colors";
import BackButton from "../components/BackButton";

import { supabase } from "../lib/supabase";

export default function StationOpResetPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const TAB_BAR_HEIGHT = 95;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 20;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const canSave = useMemo(() => {
    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();
    return p1.length >= 6 && p2.length >= 6 && p1 === p2;
  }, [newPassword, confirmPassword]);

  const handleUpdatePassword = async () => {
    if (saving) return;

    setErr("");

    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();

    if (!p1 || !p2) {
      setErr("Please enter and confirm your new password.");
      return;
    }

    if (p1.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    if (p1 !== p2) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);


      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;

      Alert.alert("Success", "Password updated successfully.", [
        {
          text: "OK",
          onPress: () => {
   
            router.replace("/(auth)/station-login");
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message ?? "Failed to update password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      
      <View style={styles.headerRow}>
        <View style={styles.backBtnWrap}>
          <BackButton />
        </View>

        <AppText variant="header" style={styles.headerTitle} pointerEvents="none">
          RESET PASSWORD
        </AppText>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="key" size={34} color={Colors.primary} />
          </View>

          <AppText variant="title" style={{ textAlign: "center" }}>
            Set a new password
          </AppText>

          <AppText
            variant="caption"
            style={{ textAlign: "center", marginTop: 8 }}
          >
            Enter and confirm your new password.
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.formGroup}>
            <AppText variant="formLabel" style={styles.formLabel}>
              New Password
            </AppText>

            <AppInput
              label=""
              value={newPassword}
              onChangeText={setNewPassword}
              icon="lock-closed"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <AppText variant="formLabel" style={styles.formLabel}>
              Confirm Password
            </AppText>

            <AppInput
              label=""
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              icon="lock-closed"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {!!err && (
            <AppText variant="caption" style={styles.inlineError}>
              {err}
            </AppText>
          )}

          <View style={styles.actionsRow}>
            <AppButton
              title={saving ? "Updating..." : "Update Password"}
              variant="primary"
              onPress={handleUpdatePassword}
              disabled={saving || !canSave}
              style={{ flex: 1 }}
            />
          </View>

          {saving && (
            <View style={{ marginTop: 14 }}>
              <ActivityIndicator />
            </View>
          )}
        </View>
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  backBtnWrap: {
    zIndex: 5,
    alignSelf: "flex-start",
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },

  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {},

  topSection: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 14,
  },
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "rgba(46,125,50,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    elevation: 6,
  },

  formGroup: {
    marginBottom: 10,
  },
  formLabel: {
    marginBottom: -6,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  inlineError: {
    color: Colors.error,
    marginTop: 6,
  },
});