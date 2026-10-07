import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useCartStore } from '../../store/cartStore';
import {
  HomeFoodSvg,
  CartShoppingSvg,
  AccountUserSvg,
} from '../../components/NavigationIcons';

export default function TabsLayout() {
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FF2E7E',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarItemStyle: {
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          margin: 0,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: 12,
          left: 36,
          right: 36,
          height: 48,
          borderRadius: 24,
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
          paddingHorizontal: 4,
          paddingVertical: 0,
          justifyContent: 'center',
          alignItems: 'center',
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
                size={focused ? 18 : 20}
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
                  size={focused ? 18 : 20}
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
                size={focused ? 18 : 20}
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
    height: 34,
    borderRadius: 17,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  tabItemText: {
    fontSize: 12.5,
    fontFamily: 'Tajawal_700Bold',
    color: '#FF2E7E',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 15,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2E7E',
  },
  cartPillBadge: {
    backgroundColor: '#FF2E7E',
    paddingHorizontal: 5,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPillBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: 'Tajawal_700Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
});
