// app/(auth)/stationop-login.tsx

import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import BackButton from "../components/BackButton";
import Colors from "../constants/colors";

export default function StationLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const onLogin = async () => {
    Keyboard.dismiss();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.replace("/(main)/(stationop)/dashboard");
  };

  const onForgot = () => {
    router.push("/(auth)/stationop-forgot-password");
  };

  return (
    <AppLayout style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>

          
              <View style={styles.backWrap}>
                <BackButton />
              </View>

              <AppText variant="appTitle" style={styles.title}>
                LOGIN TO YOUR ACCOUNT
              </AppText>

              <Image
                source={require("../../assets/images/station.png")}
                style={styles.image}
                resizeMode="contain"
              />

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
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  icon="mail-outline"
                />

                <AppInput
                  placeholder="Enter Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                  // @ts-ignore if needed
                  inputRef={passwordRef}
                  icon="lock-closed-outline"
                />

                {!!errorMsg && (
                  <AppText variant="caption" style={styles.errorText}>
                    {errorMsg}
                  </AppText>
                )}
              </View>

              <AppButton
                title="LOGIN"
                variant="pill"
                fullWidth
                onPress={onLogin}
              />

              <Pressable onPress={onForgot}>
                <AppText style={styles.forgot}>
                  Forgot Password?
                </AppText>
              </Pressable>

            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },

  container: {},

  backWrap: {
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  title: {
    textAlign: "center",
    color: Colors.primary,
    marginBottom: 14,
    fontWeight: "800",
  },

  image: {
    width: 220,
    height: 220,
    alignSelf: "center",
  },

  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 10,
    marginBottom: 12,
    marginTop: 6,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.pillBorder,
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

  forgot: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },
});