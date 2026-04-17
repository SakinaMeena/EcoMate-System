import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";

import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import Colors from "../constants/colors";
import AppLayout from "../components/AppLayout";
import BackButton from "../components/BackButton";

export default function UserForgotPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const TAB_BAR_HEIGHT = 95;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 20;

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [message, setMessage] = useState("");

  const validateEmail = useCallback((value: string) => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return ok;
  }, []);

  const verifyEmail = async () => {
    setErrorMsg("");
    setMessage("");

    if (!email) {
      setErrorMsg("Please enter your email");
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg("Invalid email address");
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase
        .from("users")
        .select("email")
        .eq("email", email.trim())
        .single();

      if (error || !data) {
        setErrorMsg("Email address does not exist");
        return;
      }

      setMessage("Email verified. Sending OTP...");
      await sendOtp();
    } catch (err) {
      setErrorMsg("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const sendOtp = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || "Failed to send OTP");
        return;
      }

      setMessage("OTP sent to your email.");
      setOtpSent(true);
    } catch (err) {
      setErrorMsg("Failed to contact server");
    }
  };

  const verifyOtp = async () => {
    try {
      setVerifying(true);
      setErrorMsg("");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, otp }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || "Invalid OTP");
        return;
      }

      const access_token = result?.access_token;
      const refresh_token = result?.refresh_token;

      if (access_token && refresh_token) {
        await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
      }

      router.push("/(auth)/user-reset-password");
    } catch (err) {
      setErrorMsg("OTP verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AppLayout>
      <View style={styles.headerRow}>
        <View style={styles.backBtnWrap}>
          <BackButton />
        </View>

        <AppText variant="header" style={styles.headerTitle}>
          FORGOT PASSWORD
        </AppText>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        <View style={styles.topSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={34} color={Colors.primary} />
          </View>

          <AppText variant="title">Reset your password</AppText>

          <AppText variant="caption" style={{ textAlign: "center", marginTop: 8 }}>
            Enter your email and verify with OTP.
          </AppText>
        </View>

        <View style={styles.card}>
          <AppText variant="formLabel">Email</AppText>

          <AppInput
            label=""
            value={email}
            onChangeText={setEmail}
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!otpSent}
          />

          {!otpSent && (
            <AppButton
              title={sending ? "Verifying..." : "Verify Email"}
              onPress={verifyEmail}
              variant="primary"
              style={{ marginTop: 14 }}
            />
          )}

          {otpSent && (
            <>
              <AppText variant="formLabel" style={{ marginTop: 12 }}>
                Enter OTP
              </AppText>

              <AppInput
                label=""
                value={otp}
                onChangeText={setOtp}
                icon="key"
                keyboardType="number-pad"
              />

              {message ? (
                <AppText style={{ color: Colors.primary, marginTop: 8 }}>
                  {message}
                </AppText>
              ) : null}

              <AppButton
                title={verifying ? "Verifying..." : "Verify OTP"}
                onPress={verifyOtp}
                variant="primary"
                style={{ marginTop: 14 }}
              />
            </>
          )}

          {errorMsg ? (
            <AppText style={{ color: Colors.error, marginTop: 10 }}>
              {errorMsg}
            </AppText>
          ) : null}

          {(sending || verifying) && (
            <ActivityIndicator style={{ marginTop: 12 }} />
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
});