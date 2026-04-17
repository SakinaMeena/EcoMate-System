import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import BackButton from "../components/BackButton"; 
import Colors from "../constants/colors";

import { supabase } from "../lib/supabase"; 

export default function UserLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onLogin = async () => {
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data.session) {
        setErrorMsg("Login failed. Please try again.");
        return;
      }

      router.replace("/(main)/(user)/userHome");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>

      <View style={styles.backWrap}>
        <BackButton />
      </View>

      <AppText variant="appTitle" style={styles.title}>
        LOGIN TO YOUR ECOMATE{"\n"}ACCOUNT
      </AppText>

      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={44} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.welcomeRow}>
        <View style={styles.line} />
        <AppText style={styles.welcome}>WELCOME BACK</AppText>
        <View style={styles.line} />
      </View>

      <View style={styles.form}>
        <AppInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          icon="mail-outline"
        />

        <AppInput
          placeholder="Enter Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          icon="lock-closed-outline"
        />

        {!!errorMsg && (
          <AppText variant="caption" style={styles.errorText}>
            {errorMsg}
          </AppText>
        )}
      </View>

      <View style={styles.linkRow}>
        <AppText variant="caption" style={styles.smallText}>
          Don’t have an account?
        </AppText>

        <Pressable onPress={() => router.push("/(auth)/user-register")}>
          <AppText variant="caption" style={styles.linkText}>
            Create account
          </AppText>
        </Pressable>
      </View>

      <AppButton
        title={loading ? "LOGGING IN..." : "LOGIN"}
        variant="pill"
        fullWidth
        disabled={loading}
        onPress={onLogin}
      />

      <Pressable
        onPress={() => router.push("/(auth)/user-forgot-password")}
        style={styles.forgotWrap}
        disabled={loading}
      >
        <AppText variant="caption" style={styles.forgot}>
          Forgot Password?
        </AppText>
      </Pressable>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
 
  backWrap: {
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  title: {
    textAlign: "center",
    color: Colors.primary,
    marginBottom: 14,
  },

  avatarWrap: {
    alignItems: "center",
    marginBottom: 14,
  },

  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: Colors.pillButton,
    alignItems: "center",
    justifyContent: "center",
  },

  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 10,
    marginBottom: 12,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(30,122,87,0.25)",
  },

  welcome: {
    color: Colors.primary,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  form: {
    gap: 12,
    marginBottom: 18,
  },

  errorText: {
    color: Colors.error,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },

  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },

  smallText: {
    color: Colors.mutedText,
  },

  linkText: {
    color: Colors.primary,
    fontWeight: "700",
  },

  forgotWrap: {
    marginTop: 12,
    alignItems: "center",
  },

  forgot: {
    color: Colors.primary,
    fontWeight: "600",
  },
});