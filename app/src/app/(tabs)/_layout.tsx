import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useCartStore } from '../../store/cartStore';
import {
  HomeFoodSvg,
  CartShoppingSvg,
  AccountUserSvg,
} from '../../components/NavigationIcons';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF2E7E',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(insets.bottom, 12) + 6,
          left: 20,
          right: 20,
          height: 66,
          borderRadius: 33,
          backgroundColor:
            Platform.OS === 'web'
              ? 'rgba(255, 255, 255, 0.88)'
              : 'rgba(255, 255, 255, 0.95)',
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.85)',
          elevation: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 8,
          // Support backdrop blur for modern web browsers
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              } as any)
            : {}),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Tajawal_700Bold',
          marginTop: 2,
        },
      }}
    >
      {/* ── 1. Restaurants & Food Tab ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <HomeFoodSvg size={22} color={color as string} focused={focused} />
            </View>
          ),
        }}
      />

      {/* ── 2. Shopping Cart Tab ── */}
      <Tabs.Screen
        name="carts"
        options={{
          title: 'السلة',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <CartShoppingSvg size={22} color={color as string} focused={focused} />
              {cartItemsCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartItemsCount > 9 ? '+9' : cartItemsCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* ── 3. Profile & Account Tab ── */}
      <Tabs.Screen
        name="account"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <AccountUserSvg size={22} color={color as string} focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapperActive: {
    backgroundColor: '#FFF1F5',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: 2,
    backgroundColor: '#FF2E7E',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Tajawal_700Bold',
    lineHeight: 11,
  },
});
