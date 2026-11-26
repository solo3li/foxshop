import React from 'react';
import { Tabs } from 'expo-router';
import { CustomDriverTabBar } from '../../components/CustomDriverTabBar';
import {
  CompassRadarSvg,
  TripsClipboardSvg,
  DriverWalletSvg,
  DriverSettingsSvg,
} from '../../components/DriverNavIcons';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomDriverTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
