import React, { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

import AppText from "../../components/AppText";
import AppInput from "../../components/AppInput";
import AppButton from "../../components/AppButton";
import Colors from "../../constants/colors";

type UserRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_address: string | null;
};

export default function OperatorProfile() {
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 95;
  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 20;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userAddress, setUserAddress] = useState("");

  const [editedName, setEditedName] = useState("");
  const [editedPhone, setEditedPhone] = useState("");
  const [editedAddress, setEditedAddress] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Stores the actual user_id value from the DB row we found
  const [dbUserId, setDbUserId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        setErrorMsg("Not logged in.");
        return;
      }

      console.log("Auth user id:", user.id);
      console.log("Auth user email:", user.email);

  
      let { data, error } = await supabase
        .from("users")
        .select("user_id, name, email, phone, user_address")
        .eq("user_id", user.id)
        .maybeSingle<UserRow>();

      console.log("Query by user_id → data:", data, "error:", error);

      if (!data && user.email) {
        const res2 = await supabase
          .from("users")
          .select("user_id, name, email, phone, user_address")
          .eq("email", user.email)
          .maybeSingle<UserRow>();

        console.log("Query by email → data:", res2.data, "error:", res2.error);
        data = res2.data;
        error = res2.error;
      }

      if (error) throw error;

      if (!data) {
        
        const { data: allRows } = await supabase
          .from("users")
          .select("user_id, name, email")
          .limit(20);
        console.log("All users rows (first 20):", JSON.stringify(allRows));
        setErrorMsg("No profile row found — check console logs.");
        return;
      }

      console.log("Found row → db user_id:", data.user_id);
      setDbUserId(data.user_id); 
      const name = data.name ?? "";
      const email = data.email ?? user.email ?? "";
      const phone = data.phone ?? "";
      const address = data.user_address ?? "";

      setUserName(name);
      setUserEmail(email);
      setUserPhone(phone);
      setUserAddress(address);

      if (!isEditing) {
        setEditedName(name);
        setEditedPhone(phone);
        setEditedAddress(address);
      }
    } catch (e: any) {
      console.error("loadProfile error:", e);
      setErrorMsg(e?.message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [isEditing]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const startEditing = () => {
    setEditedName(userName);
    setEditedPhone(userPhone);
    setEditedAddress(userAddress);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedName(userName);
    setEditedPhone(userPhone);
    setEditedAddress(userAddress);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsEditing(false);
  };

  const handleSaveDetails = async () => {
    if (savingDetails) return;

    try {
      setSavingDetails(true);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        Alert.alert("Error", "Not logged in.");
        return;
      }

      const updates = {
        name: editedName,
        phone: editedPhone,
        user_address: editedAddress,
      };

      const targetId = dbUserId ?? user.id;

      console.log("Saving updates:", updates);
      console.log("Target user_id:", targetId);

      const {
        data: updatedRows,
        error: updateError,
        status,
        statusText,
      } = await supabase
        .from("users")
        .update(updates)
        .eq("user_id", targetId)
        .select("user_id, name, email, phone, user_address");

      console.log("Update status:", status, statusText);
      console.log("Updated rows:", JSON.stringify(updatedRows));
      console.log("Update error:", updateError);

      if (updateError) {
        
        console.log("user_id update failed, trying email fallback...");

        if (user.email) {
          const {
            data: fallbackRows,
            error: fallbackError,
            status: fStatus,
          } = await supabase
            .from("users")
            .update(updates)
            .eq("email", user.email)
            .select("user_id, name, email, phone, user_address");

          console.log("Email fallback status:", fStatus);
          console.log("Email fallback rows:", JSON.stringify(fallbackRows));
          console.log("Email fallback error:", fallbackError);

          if (fallbackError) throw fallbackError;

          if (fallbackRows && fallbackRows.length > 0) {
            applyRowToState(fallbackRows[0], user.email);
          } else {
            showRlsWarning();
            return;
          }
        } else {
          throw updateError;
        }
      } else if (updatedRows && updatedRows.length > 0) {
        
        applyRowToState(updatedRows[0], user.email ?? "");
      } else {
       
        showRlsWarning();
        return;
      }

      Alert.alert("Success", "Details updated successfully");
      setIsEditing(false);
    } catch (e: any) {
      console.error("handleSaveDetails error:", e);
      Alert.alert("Error", e?.message ?? "Failed to save details.");
    } finally {
      setSavingDetails(false);
    }
  };

  
  const applyRowToState = (row: UserRow, fallbackEmail: string) => {
    const name = row.name ?? "";
    const email = row.email ?? fallbackEmail;
    const phone = row.phone ?? "";
    const address = row.user_address ?? "";

    setUserName(name);
    setUserEmail(email);
    setUserPhone(phone);
    setUserAddress(address);
    setEditedName(name);
    setEditedPhone(phone);
    setEditedAddress(address);
    setDbUserId(row.user_id);

    console.log("UI updated from DB row:", row);
  };

  const showRlsWarning = () => {
    Alert.alert(
      "Permission Issue",
      "The update ran but no rows were changed.\n\nMost likely cause: your Supabase RLS policy for the 'users' table does not allow operators to UPDATE their own row.\n\nFix: Go to Supabase → Table Editor → users → RLS Policies and add an UPDATE policy for authenticated users where user_id = auth.uid()."
    );
  };

  const handleUpdatePassword = async () => {
    if (savingPassword) return;

    try {
      setSavingPassword(true);

      if (!newPassword.trim() || !confirmPassword.trim()) {
        Alert.alert("Error", "Please fill in both password fields.");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match.");
        return;
      }

      const { error: passErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (passErr) throw passErr;

      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      Alert.alert("Success", "Password updated");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordButtonsEnabled =
    newPassword.trim().length > 0 || confirmPassword.trim().length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      scrollIndicatorInsets={{ bottom: bottomPad }}
    >
      <View style={styles.topSection}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={46} color={Colors.primary} />
        </View>
        <AppText variant="nameTag">{userName || "-"}</AppText>
        <AppText variant="caption" style={{ marginTop: 6 }}>
          Station Operator
        </AppText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <AppText variant="title">Account Information</AppText>
          {!loading && !errorMsg && !isEditing ? (
            <AppButton title="Edit" variant="edit" onPress={startEditing} />
          ) : null}
        </View>

        <View style={styles.divider} />

        {loading ? (
          <ActivityIndicator />
        ) : errorMsg ? (
          <AppText variant="caption" style={{ color: "crimson" }}>
            {errorMsg}
          </AppText>
        ) : !isEditing ? (
          <>
            <InfoRow label="Username" value={userName || "-"} />
            <InfoRow label="Email" value={userEmail || "-"} />
            <InfoRow label="Phone" value={userPhone || "-"} />
            <InfoRow label="Address" value={userAddress || "-"} last />
          </>
        ) : (
          <>
            <View style={styles.formGroup}>
              <AppText variant="formLabel" style={styles.formLabel}>Username</AppText>
              <AppInput label="" value={editedName} onChangeText={setEditedName} icon="person" />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="formLabel" style={styles.formLabel}>Phone Number</AppText>
              <AppInput
                label=""
                value={editedPhone}
                onChangeText={setEditedPhone}
                icon="call"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="formLabel" style={styles.formLabel}>Address</AppText>
              <AppInput label="" value={editedAddress} onChangeText={setEditedAddress} icon="location" />
            </View>

            <View style={styles.actionsRow}>
              <AppButton
                title={savingDetails ? "Saving..." : "Save Details"}
                variant="primary"
                onPress={handleSaveDetails}
                disabled={savingDetails}
                style={{ flex: 1 }}
              />
            </View>

            <AppText variant="title" style={{ marginTop: 14, marginBottom: 8 }}>
              Change Password
            </AppText>

            <View style={styles.formGroup}>
              <AppText variant="formLabel" style={styles.formLabel}>New Password</AppText>
              <AppInput
                label=""
                value={newPassword}
                onChangeText={setNewPassword}
                icon="lock-closed"
                secureTextEntry={!showNewPassword}
              />
            </View>

            <View style={styles.formGroup}>
              <AppText variant="formLabel" style={styles.formLabel}>Confirm Password</AppText>
              <AppInput
                label=""
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon="lock-closed"
                secureTextEntry={!showConfirmPassword}
              />
            </View>

            <View style={styles.actionsRow}>
              <AppButton
                title={savingPassword ? "Updating..." : "Update Password"}
                variant="secondary"
                onPress={handleUpdatePassword}
                disabled={savingPassword || !passwordButtonsEnabled}
                style={{ flex: 1 }}
              />
            </View>

            <View style={[styles.actionsRow, { marginTop: 18 }]}>
              <AppButton title="Cancel" variant="cancel" onPress={cancelEditing} style={{ flex: 1 }} />
              <AppButton title="Done" variant="save" onPress={() => setIsEditing(false)} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <AppText variant="formLabel">{label}</AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 12 },
  topSection: { alignItems: "center", paddingTop: 18, paddingBottom: 14 },
  avatarCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(46,125,50,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, elevation: 6 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 10 },
  infoRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  formGroup: { marginBottom: 20 },
  formLabel: { marginBottom: -6 },
});
