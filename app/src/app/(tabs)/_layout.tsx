import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import {
  HomeFoodSvg,
  OrdersHistorySvg,
  CartShoppingSvg,
  AccountUserSvg,
} from '../../components/NavigationIcons';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const barBg =
    Platform.OS === 'web'
      ? 'rgba(255, 255, 255, 0.94)'
      : 'rgba(255, 255, 255, 0.96)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D70F64',
        tabBarInactiveTintColor: '#6B7280',
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
          borderColor: 'rgba(0, 0, 0, 0.06)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 8,
          // Support backdrop blur for modern web browsers
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              } as any)
            : {}),
        },
        tabBarLabelStyle: {
          fontFamily: 'Tajawal_700Bold',
          fontSize: 11,
          marginTop: -2,
        },
      }}
    >
      {/* ── 1. Restaurants & Food Discovery Tab ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, focused }) => (
            <HomeFoodSvg size={22} color={color} focused={focused} />
          ),
        }}
      />

      {/* ── 2. Customer Orders Tab ── */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color, focused }) => (
            <OrdersHistorySvg size={22} color={color} focused={focused} />
          ),
        }}
      />

      {/* ── 3. Shopping Cart Tab ── */}
      <Tabs.Screen
        name="carts"
        options={{
          title: 'السلة',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.cartIconWrapper}>
              <CartShoppingSvg size={22} color={color} focused={focused} />
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

      {/* ── 4. Profile & Account Tab ── */}
      <Tabs.Screen
        name="account"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, focused }) => (
            <AccountUserSvg size={22} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  cartIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D70F64',
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
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
