import { useAuth } from '@/src/contexts/AuthContext';
import { driverService } from '@/src/services/driverService';
import { Driver, Vehicle } from '@/src/types';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppButton from '@/components/AppButton';
import AppInput from '@/components/AppInput';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

export default function ProfileScreen() {
  const { user, signOut, updatePassword } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ms'>('en');

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedAddress, setEditedAddress] = useState('');
  const [editedDepot, setEditedDepot] = useState('');

  // Password section state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadProfileData();
    loadCurrentLanguage();
  }, [user]);

  const loadCurrentLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem('appLanguage');
      if (stored === 'en' || stored === 'ms') {
        setCurrentLanguage(stored);
      }
    } catch {}
  };

  const loadProfileData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [driverData, vehiclesData] = await Promise.all([
        driverService.getProfile(user.user_id),
        driverService.getVehicles(user.user_id),
      ]);

      if (driverData) {
        setDriver(driverData);
        setEditedName(driverData.name || '');
        setEditedPhone(driverData.phone || '');
        setEditedAddress(driverData.user_address || '');
        setEditedDepot(driverData.depot_id || '');
      }

      setVehicles(vehiclesData || []);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !driver) return;

    const phoneRegex = /^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/;
    if (!phoneRegex.test(editedPhone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid Malaysian phone number');
      return;
    }

    try {
      setSaving(true);
      const success = await driverService.updateProfile(user.user_id, {
        name: editedName,
        phone: editedPhone,
        user_address: editedAddress,
        depot_id: editedDepot || undefined,
      });

      if (success) {
        await loadProfileData();
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setSavingPassword(true);
      await updatePassword(newPassword);
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleVehicleStatusChange = async (
    vehicleId: string,
    currentStatus: string,
    newStatus: 'available' | 'in_use' | 'out_of_service'
  ) => {
    if (newStatus === 'out_of_service') {
      Alert.alert(
        'Confirm Maintenance',
        'Are you sure you want to set this vehicle to maintenance mode?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: async () => {
              try {
                const success = await driverService.updateVehicleStatus(vehicleId, newStatus);
                if (success) {
                  await loadProfileData();
                  Alert.alert('Success', 'Vehicle status updated');
                } else {
                  Alert.alert('Error', 'Failed to update vehicle status');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to update vehicle status');
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const success = await driverService.updateVehicleStatus(vehicleId, newStatus);
      if (success) {
        await loadProfileData();
        Alert.alert('Success', 'Vehicle status updated');
      } else {
        Alert.alert('Error', 'Failed to update vehicle status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update vehicle status');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const getVehicleStatusColor = (status: string) => {
    switch (status) {
      case 'available': return Colors.primary;
      case 'in_use': return '#F57F17';
      case 'out_of_service': return '#C62828';
      default: return '#888';
    }
  };

  const getVehicleStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'in_use': return 'In Use';
      case 'out_of_service': return 'Maintenance';
      default: return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText variant="caption" style={{ marginTop: 12 }}>Loading profile...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top} />
        <View style={[styles.body, styles.centered]}>
          <AppText variant="body" color="#C62828" style={{ marginBottom: 16 }}>
            Failed to load profile
          </AppText>
          <AppButton title="Retry" onPress={loadProfileData} variant="pill" />
        </View>
      </SafeAreaView>
    );
  }

  const initials = driver.name
    ? driver.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Green top */}
      <View style={styles.top}>
        <View style={styles.headerTop}>
          <AppText variant="header" color="#FFFFFF" style={styles.headerTitle}>
            DRIVER PROFILE
          </AppText>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <AppText variant="caption" color="#FFFFFF" style={styles.logoutText}>
              Logout
            </AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.avatarInfo}>
            <AppText variant="sectionTitle" color="#FFFFFF" style={styles.avatarName}>
              {driver.name}
            </AppText>
            <AppText variant="caption" color="#A5D6A7"> EcoMate Driver</AppText>
            {driver.depot_id && (
              <AppText variant="caption" color="#C8E6C9"> {driver.depot_id}</AppText>
            )}
          </View>
        </View>
      </View>

      {/* White body */}
      <View style={styles.body}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Personal Info Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="sectionTitle" style={styles.cardTitle}>
                Personal Information
              </AppText>
              {!isEditing ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setIsEditing(true)}
                >
                  <AppText variant="caption" color={Colors.primary} style={{ fontWeight: '700' }}>
                    Edit
                  </AppText>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setIsEditing(false)}>
                    <AppText variant="caption" color="#888" style={{ fontWeight: '600' }}>
                      Cancel
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveProfile}
                    disabled={saving}
                  >
                    <AppText variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>
                      {saving ? 'Saving...' : 'Save'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!isEditing ? (
              <>
                <InfoRow label="Full Name" value={driver.name} />
                <InfoRow label="Email" value={driver.email} />
                <InfoRow label="Phone" value={driver.phone || 'Not set'} />
                <InfoRow label="Address" value={driver.user_address || 'Not set'} />
                <InfoRow label="Assigned Depot" value={driver.depot_id || 'Not assigned'} last />
              </>
            ) : (
              <>
                <AppInput
                  label="Full Name *"
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Enter your name"
                  icon="person-outline"
                  autoCapitalize="words"
                />
                <AppInput
                  label="Phone Number *"
                  value={editedPhone}
                  onChangeText={setEditedPhone}
                  placeholder="e.g., 0123456789"
                  keyboardType="phone-pad"
                  icon="call-outline"
                  helperText="Malaysian format required"
                />
                <AppInput
                  label="Address"
                  value={editedAddress}
                  onChangeText={setEditedAddress}
                  placeholder="Enter your address"
                  icon="location-outline"
                  multiline
                  numberOfLines={3}
                />
                <AppInput
                  label="Assigned Depot"
                  value={editedDepot}
                  onChangeText={setEditedDepot}
                  placeholder="e.g., Petaling Jaya Depot"
                  icon="business-outline"
                  helperText="Enter your collection depot name or location"
                />
              </>
            )}

            {/* ── Password Row ── */}
            <View style={styles.passwordDivider} />

            {!isChangingPassword ? (
              // Display row: label + masked password + Change button
              <View style={styles.passwordRow}>
                <View style={styles.passwordLeft}>
                  <AppText variant="caption" style={styles.passwordLabel}>Password</AppText>
                  <AppText variant="body" style={styles.passwordMask}>{'••••••••'}</AppText>
                </View>
                <TouchableOpacity
                  style={styles.changePasswordBtn}
                  onPress={() => setIsChangingPassword(true)}
                >
                  <AppText variant="caption" color={Colors.primary} style={{ fontWeight: '700' }}>
                    Change
                  </AppText>
                </TouchableOpacity>
              </View>
            ) : (
              // Change password form
              <View style={styles.changePasswordForm}>
                <AppText variant="sectionTitle" style={styles.changePasswordTitle}>
                  Change Password
                </AppText>

                <AppInput
                  label="New Password *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 8 characters"
                  secureTextEntry
                  icon="lock-closed-outline"
                  editable={!savingPassword}
                />

                <AppInput
                  label="Confirm New Password *"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  secureTextEntry
                  icon="lock-closed-outline"
                  editable={!savingPassword}
                />

                <View style={styles.changePasswordActions}>
                  <TouchableOpacity
                    onPress={handleCancelPasswordChange}
                    disabled={savingPassword}
                    style={styles.cancelPasswordBtn}
                  >
                    <AppText variant="caption" color="#888" style={{ fontWeight: '600' }}>
                      Cancel
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingPassword && { opacity: 0.6 }]}
                    onPress={handleChangePassword}
                    disabled={savingPassword}
                  >
                    <AppText variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>
                      {savingPassword ? 'Saving...' : 'Update Password'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Vehicles Card */}
          <View style={styles.card}>
            <AppText variant="sectionTitle" style={styles.cardTitle}>
              My Vehicles
            </AppText>

            {vehicles.length === 0 ? (
              <View style={styles.emptyVehicles}>
                <AppText style={styles.emptyVehicleIcon}>🚚</AppText>
                <AppText variant="sectionTitle" style={styles.emptyVehicleText}>
                  No vehicles assigned
                </AppText>
                <AppText variant="caption" style={styles.emptyVehicleSubtext}>
                  Contact dispatch to get a vehicle assigned
                </AppText>
              </View>
            ) : (
              vehicles.map(vehicle => (
                <View key={vehicle.vehicle_id} style={styles.vehicleCard}>
                  <View style={styles.vehicleTopRow}>
                    <View>
                      <AppText variant="sectionTitle" style={styles.vehiclePlate}>
                        {vehicle.license_plate}
                      </AppText>
                      <AppText variant="caption">Capacity: {vehicle.capacity_litres}L</AppText>
                    </View>
                    <View style={[
                      styles.vehicleStatusBadge,
                      { borderColor: getVehicleStatusColor(vehicle.status) }
                    ]}>
                      <AppText
                        variant="caption"
                        style={[styles.vehicleStatusBadgeText, { color: getVehicleStatusColor(vehicle.status) }]}
                      >
                        {getVehicleStatusLabel(vehicle.status)}
                      </AppText>
                    </View>
                  </View>

                  <AppText variant="caption" style={styles.statusChangeLabel}>
                    Change Status:
                  </AppText>

                  <View style={styles.statusButtons}>
                    <TouchableOpacity
                      style={[styles.statusBtn, vehicle.status === 'available' && styles.statusBtnActiveGreen]}
                      onPress={() => handleVehicleStatusChange(vehicle.vehicle_id, vehicle.status, 'available')}
                      disabled={vehicle.status === 'available'}
                    >
                      <AppText variant="caption" style={[
                        styles.statusBtnText,
                        vehicle.status === 'available' && styles.statusBtnTextActive,
                      ]}>
                        Available
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.statusBtn, vehicle.status === 'in_use' && styles.statusBtnActiveOrange]}
                      disabled={true}
                    >
                      <AppText variant="caption" style={[
                        styles.statusBtnText,
                        vehicle.status === 'in_use' && styles.statusBtnTextActive,
                      ]}>
                        In Use
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.statusBtn, vehicle.status === 'out_of_service' && styles.statusBtnActiveRed]}
                      onPress={() => handleVehicleStatusChange(vehicle.vehicle_id, vehicle.status, 'out_of_service')}
                      disabled={vehicle.status === 'out_of_service'}
                    >
                      <AppText variant="caption" style={[
                        styles.statusBtnText,
                        vehicle.status === 'out_of_service' && styles.statusBtnTextActive,
                      ]}>
                        Maintenance
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[infoRowStyles.row, last && { borderBottomWidth: 0 }]}>
      <AppText variant="caption" style={infoRowStyles.label}>{label}</AppText>
      <AppText variant="body" style={infoRowStyles.value}>{value}</AppText>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F8E9',
  },
  label: {
    color: '#888',
    flex: 1,
  },
  value: {
    fontWeight: '600',
    color: '#1B2A1C',
    flex: 2,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    letterSpacing: 2,
    marginBottom: 0,
  },
  logoutButton: {
    backgroundColor: '#C62828',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {
    fontWeight: '700',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#A5D6A7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  avatarInfo: {
    flex: 1,
    gap: 2,
  },
  avatarName: {
    marginBottom: 2,
  },
  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 0,
  },
  editBtn: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // Password styles
  passwordDivider: {
    height: 1,
    backgroundColor: '#F1F8E9',
    marginVertical: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  passwordLeft: {
    flex: 1,
  },
  passwordLabel: {
    color: '#888',
    marginBottom: 4,
  },
  passwordMask: {
    fontWeight: '600',
    color: '#1B2A1C',
    letterSpacing: 2,
  },
  changePasswordBtn: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
  },
  changePasswordForm: {
    marginTop: 12,
  },
  changePasswordTitle: {
    marginBottom: 12,
    color: Colors.primary,
  },
  changePasswordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelPasswordBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Vehicles
  vehicleCard: {
    backgroundColor: '#F9FBF9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  vehicleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  vehiclePlate: {
    marginBottom: 2,
  },
  vehicleStatusBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  vehicleStatusBadgeText: {
    fontWeight: '700',
  },
  statusChangeLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  statusBtnActiveGreen: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBtnActiveOrange: {
    backgroundColor: '#F57F17',
    borderColor: '#F57F17',
  },
  statusBtnActiveRed: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  statusBtnText: {
    fontWeight: '600',
    color: '#666',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyVehicles: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyVehicleIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyVehicleText: {
    marginBottom: 4,
  },
  emptyVehicleSubtext: {
    textAlign: 'center',
  },
});
