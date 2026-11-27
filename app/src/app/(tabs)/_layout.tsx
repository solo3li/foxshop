import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../../hooks/use-theme';
import {
  HomeFoodSvg,
  OrdersHistorySvg,
  CartShoppingSvg,
  AccountUserSvg,
} from '../../components/NavigationIcons';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 6);
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const barBg = theme.isDark ? '#0F172A' : '#FFFFFF';
  const barBorderTop = theme.isDark ? '#1E293B' : '#E2E8F0';

  const activeIndicatorBg = theme.isDark
    ? 'rgba(215, 15, 100, 0.16)'
    : 'rgba(215, 15, 100, 0.08)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: barBg,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: barBorderTop,
          elevation: 0,
          shadowOpacity: 0,
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
            <View
              style={[
                styles.tabIconWrapper,
                focused && [styles.activeTabIndicator, { backgroundColor: activeIndicatorBg }],
              ]}
            >
              <HomeFoodSvg size={22} color={color} focused={focused} />
            </View>
          ),
        }}
      />

      {/* ── 2. Customer Orders Tab ── */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.tabIconWrapper,
                focused && [styles.activeTabIndicator, { backgroundColor: activeIndicatorBg }],
              ]}
            >
              <OrdersHistorySvg size={22} color={color} focused={focused} />
            </View>
          ),
        }}
      />

      {/* ── 3. Shopping Cart Tab ── */}
      <Tabs.Screen
        name="carts"
        options={{
          title: 'السلة',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.tabIconWrapper,
                focused && [styles.activeTabIndicator, { backgroundColor: activeIndicatorBg }],
              ]}
            >
              <CartShoppingSvg size={22} color={color} focused={focused} />
              {cartItemsCount > 0 && (
                <Animated.View
                  key={`cart-badge-${cartItemsCount}`}
                  entering={ZoomIn.springify()}
                  style={[styles.cartBadge, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.cartBadgeText}>
                    {cartItemsCount > 9 ? '+9' : cartItemsCount}
                  </Text>
                </Animated.View>
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
            <View
              style={[
                styles.tabIconWrapper,
                focused && [styles.activeTabIndicator, { backgroundColor: activeIndicatorBg }],
              ]}
            >
              <AccountUserSvg size={22} color={color} focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 44,
  },
  activeTabIndicator: {
    borderRadius: 16,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 0,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Tajawal_700Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
