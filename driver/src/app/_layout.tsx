import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { centrifugo } from '../services/centrifugo';
import ErrorBoundary from '../components/ErrorBoundary';

// Configure RTL layout before RootLayout
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Filter non-fatal web deprecation warnings to keep browser console clean
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('"shadow*" style props are deprecated') ||
      msg.includes('props.pointerEvents is deprecated') ||
      msg.includes('google.maps.DirectionsService is deprecated') ||
      msg.includes('google.maps.DirectionsRenderer is deprecated') ||
      msg.includes('google.maps.Marker is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isPendingApproval, isInitialized, loadStoredAuth, user } = useAuthStore();
  const { mode, colors, loadTheme } = useThemeStore();

  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  useEffect(() => {
    loadStoredAuth();
    loadTheme();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      centrifugo.connect(user.id);
    } else {
      centrifugo.disconnect();
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!fontsLoaded || !isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';

    if (isPendingApproval) {
      router.replace('/auth/pending');
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isPendingApproval, isInitialized, fontsLoaded, segments]);

  if (!fontsLoaded || !isInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="auth/pending" />
          <Stack.Screen
            name="trip/[id]"
            options={{
              headerShown: true,
              title: 'تفاصيل الرحلة',
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: 'Tajawal_700Bold' },
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
