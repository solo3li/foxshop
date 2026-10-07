import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { Fonts } from '../../constants/theme';
import {
  CompassRadarSvg,
  TripsClipboardSvg,
  DriverWalletSvg,
  DriverSettingsSvg,
} from '../../components/DriverNavIcons';

export default function TabsLayout() {
  const { colors, mode } = useThemeStore();
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

  const barBg = mode === 'dark' ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.96)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomMargin,
          left: 16,
          right: 16,
          backgroundColor: barBg,
          borderRadius: 26,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: mode === 'dark' ? 0.35 : 0.12,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bold,
          fontSize: 11,
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرادار',
          tabBarIcon: ({ color, focused }) => (
            <CompassRadarSvg size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'مشاويري',
          tabBarIcon: ({ color, focused }) => (
            <TripsClipboardSvg size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'المحفظة',
          tabBarIcon: ({ color, focused }) => (
            <DriverWalletSvg size={22} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ color, focused }) => (
            <DriverSettingsSvg size={22} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
