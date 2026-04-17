import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import AppLayout from "../components/AppLayout";
import AppText from "../components/AppText";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import Colors from "../constants/colors";
import { useAuth } from "../components/AuthContext";

export default function UserRegister() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "User name is required";

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!email.includes("@")) newErrors.email = "Invalid email address";

    if (!phone.trim()) newErrors.phone = "Phone number is required";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Minimum 6 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Confirm your password";
    else if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!address.trim()) newErrors.address = "Address is required";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      Alert.alert("Missing / invalid info", "Please fix the highlighted fields.");
      return false;
    }
    return true;
  };

  const onCreateAccount = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signUp(email, password, { name, phone, address });
      Alert.alert(
        "Account Created!",
        "Please check your email and confirm your account before logging in.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/user-login") }]
      );
    } catch (error: any) {
      console.log("FULL ERROR:", JSON.stringify(error));
      Alert.alert("Registration Failed", error.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText variant="appTitle" style={styles.title}>
            CREATE YOUR ECOMATE{"\n"}ACCOUNT
          </AppText>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>User Name</AppText>
              <AppInput
                placeholder="Enter your full name"
                value={name}
                onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: "" })); }}
                autoCapitalize="words"
                error={errors.name}
              />
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>Email</AppText>
              <AppInput
                placeholder="Enter your email"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: "" })); }}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email}
              />
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>Phone Number</AppText>
              <AppInput
                placeholder="Enter your phone number"
                value={phone}
                onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: "" })); }}
                keyboardType="phone-pad"
                error={errors.phone}
              />
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>Password</AppText>
              <AppInput
                placeholder="Enter password"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: "" })); }}
                secureTextEntry
                error={errors.password}
              />
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>Confirm Password</AppText>
              <AppInput
                placeholder="Re-enter password"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: "" })); }}
                secureTextEntry
                error={errors.confirmPassword}
              />
            </View>

            <View style={styles.inputGroup}>
              <AppText variant="formLabel" style={styles.label}>Address</AppText>
              <AppInput
                placeholder="Enter your address"
                value={address}
                onChangeText={(t) => { setAddress(t); setErrors((e) => ({ ...e, address: "" })); }}
                error={errors.address}
              />
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <AppButton
            title={loading ? "CREATING..." : "CREATE ACCOUNT"}
            variant="pill"
            fullWidth
            disabled={loading}
            onPress={onCreateAccount}
          />

          <View style={styles.linkRow}>
            <AppText variant="caption" style={styles.smallText}>
              Already have an account?
            </AppText>
            <Pressable onPress={() => router.replace("/(auth)/user-login")}>
              <AppText variant="caption" style={styles.linkText}>Login</AppText>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { textAlign: "center", color: Colors.primary, marginTop: 10, marginBottom: 20 },
  scrollContent: { paddingBottom: 0 },
  form: { paddingTop: 4 },
  inputGroup: { marginBottom: 18 },
  label: { marginBottom: 8 },
  bottomSpacer: { height: 120 },
  footer: { paddingTop: 10, paddingBottom: 10 },
  linkRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 12 },
  smallText: { color: Colors.mutedText },
  linkText: { color: Colors.primary, fontWeight: "700" },
});