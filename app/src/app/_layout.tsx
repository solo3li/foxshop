import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, LogBox, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useFavoriteStore } from '../store/favoriteStore';

// Ignore non-fatal development navigation and deprecation warnings
LogBox.ignoreLogs([
  "The action 'GO_BACK' was not handled by any navigator",
  'shadow* style props are deprecated',
  'props.pointerEvents is deprecated',
]);

// Force RTL layout
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Polyfill clipboard for web over HTTP and filter console warnings
if (typeof window !== 'undefined') {
  if (!window.navigator.clipboard || !window.navigator.clipboard.writeText) {
    (window.navigator as any).clipboard = {
      writeText: async (text: string) => {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch {}
      },
      readText: async () => '',
    };
  }

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('"shadow*" style props are deprecated') ||
      msg.includes('props.pointerEvents is deprecated') ||
      msg.includes('[Reanimated] Property [transform] may be overwritten')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const loadFavorites = useFavoriteStore((state) => state.loadFavorites);

  useEffect(() => {
    loadStoredAuth();
    loadFavorites();
  }, [loadStoredAuth, loadFavorites]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="restaurant/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="item/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="vouchers" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="favorites" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="partner-apply" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="help" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="auth/login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth/register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
