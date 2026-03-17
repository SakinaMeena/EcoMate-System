import { useAuth } from '@/src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '@/components/AppButton';
import AppInput from '@/components/AppInput';
import AppText from '@/components/AppText';
import Colors from '@/constants/colors';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [depot, setDepot] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const phoneRegex = /^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid Malaysian phone number (e.g., 0123456789)'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, {
        name,
        phone,
        depot_id: depot || null,
      });

      Alert.alert(
        'Success',
        'Registration successful! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Green top section */}
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <AppText variant="caption" color="#A5D6A7" style={styles.backButton}>
            ← Back
          </AppText>
        </TouchableOpacity>
        <AppText variant="appTitle" color="#FFFFFF" style={styles.title}>
          Create Account
        </AppText>
        <AppText variant="caption" color="#A5D6A7">
          Join the EcoMate Collection Team
        </AppText>
      </View>

      {/* Rounded white content area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <AppInput
            label="Full Name *"
            placeholder="e.g. Ahmad Bin Ali"
            value={name}
            onChangeText={setName}
            icon="person-outline"
            autoCapitalize="words"
            editable={!loading}
          />

          <AppInput
            label="Email Address *"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            icon="mail-outline"
            editable={!loading}
          />

          <AppInput
            label="Phone Number *"
            placeholder="0123456789"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon="call-outline"
            helperText="Malaysian format required"
            editable={!loading}
          />

          <AppInput
            label="Assigned Depot"
            placeholder="e.g. Petaling Jaya Depot"
            value={depot}
            onChangeText={setDepot}
            icon="business-outline"
            helperText="Optional — can be updated later"
            editable={!loading}
          />

          <AppInput
            label="Password *"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
            editable={!loading}
          />

          <AppInput
            label="Confirm Password *"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            icon="lock-closed-outline"
            editable={!loading}
          />

          <View style={styles.buttonWrapper}>
            <AppButton
              title={loading ? 'Creating Account...' : 'Create Account'}
              onPress={handleRegister}
              variant="pill"
              fullWidth
              disabled={loading}
            />
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
            disabled={loading}
          >
            <AppText variant="caption" style={styles.loginLinkText}>
              Already have an account?{' '}
              <AppText variant="caption" color={Colors.primary} style={styles.loginLinkBold}>
                Sign In
              </AppText>
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },

  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },

  buttonWrapper: {
    marginTop: 24,
  },

  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkBold: {
    fontWeight: '700',
  },
});