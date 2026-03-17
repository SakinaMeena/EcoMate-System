import { useAuth } from '@/src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Green top section */}
      <View pointerEvents="none" style={styles.top}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <AppText variant="appTitle" color="#FFFFFF" style={styles.title}>
          ECOMATE DRIVER
        </AppText>
        <AppText variant="caption" color="#A5D6A7" style={styles.subtitle}>
          UCO Collection System
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
          <AppText variant="header" style={styles.welcomeHeading}>
            Welcome Back
          </AppText>
          <AppText variant="caption" style={styles.welcomeSubtext}>
            Sign in to continue your route
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

          <AppInput
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
            editable={!loading}
          />

          {/* Forgot Password link */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => router.push('/forgot-password' as any)}
            disabled={loading}
          >
            <AppText variant="caption" color={Colors.primary} style={styles.forgotPasswordText}>
              Forgot Password?
            </AppText>
          </TouchableOpacity>

          <View style={styles.buttonWrapper}>
            <AppButton
              title={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
              variant="pill"
              fullWidth
              disabled={loading}
            />
          </View>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/register' as any)}
            disabled={loading}
          >
            <AppText variant="caption" style={styles.registerLinkText}>
              Don't have an account?{' '}
              <AppText variant="caption" color={Colors.primary} style={styles.registerLinkBold}>
                Register
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
    height: 220,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    letterSpacing: 1,
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
    paddingBottom: 40,
  },
  welcomeHeading: {
    marginBottom: 2,
  },
  welcomeSubtext: {
    marginBottom: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontWeight: '600',
  },
  buttonWrapper: {
    marginTop: 20,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 14,
    color: '#666',
  },
  registerLinkBold: {
    fontWeight: '700',
  },
});
