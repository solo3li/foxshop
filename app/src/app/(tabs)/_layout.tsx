import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FF2E7E',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          height: 58,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(insets.bottom, 6) + 4,
          left: 28,
          right: 28,
          height: 58,
          borderRadius: 29,
          backgroundColor:
            Platform.OS === 'web'
              ? 'rgba(255, 255, 255, 0.90)'
              : 'rgba(255, 255, 255, 0.96)',
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.85)',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          paddingHorizontal: 6,
          paddingVertical: 0,
          // Support backdrop blur for modern web browsers
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              } as any)
            : {}),
        },
      }}
    >
      {/* ── 1. Restaurants & Food Tab ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <HomeFoodSvg
                size={focused ? 20 : 22}
                color={focused ? '#FF2E7E' : '#9CA3AF'}
                focused={focused}
              />
              {focused && (
                <Text style={styles.tabItemText}>الرئيسية</Text>
              )}
            </View>
          ),
        }}
      />

      {/* ── 2. Shopping Cart Tab ── */}
      <Tabs.Screen
        name="carts"
        options={{
          title: 'السلة',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <View style={styles.iconWithBadgeBox}>
                <CartShoppingSvg
                  size={focused ? 20 : 22}
                  color={focused ? '#FF2E7E' : '#9CA3AF'}
                  focused={focused}
                />
                {cartItemsCount > 0 && !focused && (
                  <View style={styles.cartDot} />
                )}
              </View>
              {focused && (
                <>
                  <Text style={styles.tabItemText}>السلة</Text>
                  {cartItemsCount > 0 && (
                    <View style={styles.cartPillBadge}>
                      <Text style={styles.cartPillBadgeText}>
                        {cartItemsCount > 9 ? '+9' : cartItemsCount}
                      </Text>
                    </View>
                  )}
                </>
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
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItem, focused && styles.tabItemActive]}>
              <AccountUserSvg
                size={focused ? 20 : 22}
                color={focused ? '#FF2E7E' : '#9CA3AF'}
                focused={focused}
              />
              {focused && (
                <Text style={styles.tabItemText}>حسابي</Text>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 22,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  tabItemText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#FF2E7E',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 16,
  },
  iconWithBadgeBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF2E7E',
  },
  cartPillBadge: {
    backgroundColor: '#FF2E7E',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPillBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
