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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Green top */}
      <View style={styles.top}>
        <AppText variant="appTitle" color="#FFFFFF" style={styles.title}>
          ECOMATE DRIVER
        </AppText>
        <AppText variant="caption" color="#A5D6A7">
          UCO Collection System
        </AppText>
      </View>

      {/* White body */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {!sent ? (
            <>
              <AppText variant="header" style={styles.heading}>
                Forgot Password
              </AppText>
              <AppText variant="caption" style={styles.subtext}>
                Enter your registered email and we'll send you a reset link.
              </AppText>

              <AppInput
                label="Email Address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                icon="mail-outline"
                editable={!loading}
              />

              <View style={styles.buttonWrapper}>
                <AppButton
                  title={loading ? 'Sending...' : 'Send Reset Link'}
                  onPress={handleReset}
                  variant="pill"
                  fullWidth
                  disabled={loading}
                />
              </View>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => router.back()}
                disabled={loading}
              >
                <AppText variant="caption" color={Colors.primary} style={styles.backLinkText}>
                  ← Back to Login
                </AppText>
              </TouchableOpacity>
            </>
          ) : (
            // Success state
            <View style={styles.successContainer}>
              <AppText style={styles.successIcon}>📧</AppText>
              <AppText variant="header" style={styles.heading}>
                Check Your Email
              </AppText>
              <AppText variant="caption" style={styles.subtext}>
                A password reset link has been sent to{' '}
                <AppText variant="caption" color={Colors.primary} style={{ fontWeight: '700' }}>
                  {email}
                </AppText>
                . Follow the link in the email to reset your password.
              </AppText>

              <AppText variant="caption" style={[styles.subtext, { marginTop: 8 }]}>
                Didn't receive it? Check your spam folder or try again.
              </AppText>

              <View style={styles.buttonWrapper}>
                <AppButton
                  title="Back to Login"
                  onPress={() => router.replace('/login' as any)}
                  variant="pill"
                  fullWidth
                />
              </View>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => { setSent(false); setEmail(''); }}
              >
                <AppText variant="caption" color={Colors.primary} style={styles.backLinkText}>
                  Try a different email
                </AppText>
              </TouchableOpacity>
            </View>
          )}
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
    height: 160,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
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
    paddingTop: 32,
    paddingBottom: 40,
  },
  heading: {
    marginBottom: 6,
  },
  subtext: {
    color: '#888',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonWrapper: {
    marginTop: 24,
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  successIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
});
