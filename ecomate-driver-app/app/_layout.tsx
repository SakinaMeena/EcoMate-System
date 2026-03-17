import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';

    if (!user && inAuthGroup) {
     router.replace('/login');
    } else if (user && inAuthScreen) {
      router.replace('/(tabs)' as any);
    }
  }, [user, loading, segments]);
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" />
      <Stack.Screen name="route-details" />
      <Stack.Screen name="navigate" />
      <Stack.Screen name="pickup-details" />
      <Stack.Screen name="depot-transfer" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}