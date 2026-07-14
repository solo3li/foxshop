import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';

// Force RTL layout
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="restaurant/[id]" />
      </Stack>
    </>
  );
}
