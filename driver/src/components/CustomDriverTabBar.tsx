import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../store/themeStore';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { Fonts } from '../constants/theme';
import {
  CompassRadarSvg,
  TripsClipboardSvg,
  DriverWalletSvg,
  DriverSettingsSvg,
} from './DriverNavIcons';

export const CustomDriverTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, mode } = useThemeStore();
  const insets = useSafeAreaInsets();

  // Dynamic real-time badges data
  const activeTrip = useTripStore((s) => s.activeTrip);
  const incomingOffer = useTripStore((s) => s.incomingOffer);
  const analytics = useTripStore((s) => s.analytics);
  const fetchAnalytics = useTripStore((s) => s.fetchAnalytics);
  const driverProfile = useAuthStore((s) => s.driverProfile);

  // Auto-fetch analytics if not loaded yet so COD warning dot is primed on app mount
  useEffect(() => {
    if (!analytics) {
      fetchAnalytics().catch(() => {});
    }
  }, [analytics, fetchAnalytics]);

  // Trips badge: Delivery trip or offer is in progress
  const hasActiveTrip = Boolean(
    (activeTrip &&
      activeTrip.status !== 'COMPLETED' &&
      activeTrip.status !== 'CANCELLED') ||
      incomingOffer
  );
  const activeTripCount =
    (activeTrip &&
    activeTrip.status !== 'COMPLETED' &&
    activeTrip.status !== 'CANCELLED'
      ? 1
      : 0) + (incomingOffer ? 1 : 0);

  // Wallet badge: cash_in_hand reaches or exceeds 80% of COD ceiling
  const rawCash = analytics?.cash_in_hand ?? driverProfile?.cash_in_hand ?? '0';
  const cashInHand = typeof rawCash === 'number' ? rawCash : parseFloat(rawCash) || 0;
  const rawCeiling = analytics?.cod_max_ceiling ?? '500';
  const codCeiling = typeof rawCeiling === 'number' ? rawCeiling : parseFloat(rawCeiling) || 500;
  const isCeilingWarning = codCeiling > 0 && cashInHand / codCeiling >= 0.8;

  // Pulsing animation for wallet ceiling warning indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (!isCeilingWarning) {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.75);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.65,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.15,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.75,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isCeilingWarning, pulseAnim, pulseOpacity]);

  // Check if current screen requests hiding tab bar
  const currentRoute = state.routes[state.index];
  const currentOptions = descriptors[currentRoute.key]?.options;
  if (
    currentOptions?.tabBarStyle &&
    (currentOptions.tabBarStyle as any).display === 'none'
  ) {
    return null;
  }

  // Safe bottom padding accounting for home indicator and Android navigation
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 6);

  // Physical touch feedback for one-handed driving ergonomics
  const triggerTabHaptic = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback if device lacks vibration hardware
    }
  };

  // Fallback icon resolver
  const renderFallbackIcon = (name: string, focused: boolean, color: string) => {
    switch (name) {
      case 'index':
        return <CompassRadarSvg size={22} color={color} focused={focused} />;
      case 'trips':
        return <TripsClipboardSvg size={22} color={color} focused={focused} />;
      case 'wallet':
        return <DriverWalletSvg size={22} color={color} focused={focused} />;
      case 'settings':
        return <DriverSettingsSvg size={22} color={color} focused={focused} />;
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.barContainer,
        {
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          backgroundColor: mode === 'dark' ? '#0F172A' : '#FFFFFF',
          borderTopColor: mode === 'dark' ? '#1E293B' : '#E2E8F0',
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const labelText = typeof label === 'string' ? label : route.name;

        const iconColor = isFocused ? colors.primary : colors.textSecondary;

        const iconElement = options.tabBarIcon
          ? options.tabBarIcon({
              focused: isFocused,
              color: iconColor,
              size: 22,
            })
          : renderFallbackIcon(route.name, isFocused, iconColor);

        const onPress = () => {
          triggerTabHaptic();

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          triggerTabHaptic();
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Tab-specific badge indicator
        const isTripsTab = route.name === 'trips';
        const isWalletTab = route.name === 'wallet';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={labelText}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={styles.tabButton}
          >
            <View
              style={[
                styles.capsuleWrapper,
                isFocused && {
                  backgroundColor:
                    mode === 'dark'
                      ? 'rgba(215, 15, 100, 0.16)'
                      : 'rgba(215, 15, 100, 0.08)',
                },
              ]}
            >
              {/* Icon Container with Badge */}
              <View style={styles.iconContainer}>
                {iconElement}

                {/* Real-time Badge for Active Delivery Trip */}
                {isTripsTab && hasActiveTrip && (
                  <View
                    style={[
                      styles.tripBadge,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: mode === 'dark' ? '#0F172A' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text style={styles.tripBadgeText}>
                      {activeTripCount > 0 ? activeTripCount : 1}
                    </Text>
                  </View>
                )}

                {/* Pulsing Warning Dot for COD Ceiling Limit */}
                {isWalletTab && isCeilingWarning && (
                  <View style={styles.warningContainer}>
                    <Animated.View
                      style={[
                        styles.warningPulseRing,
                        {
                          backgroundColor: colors.warning,
                          transform: [{ scale: pulseAnim }],
                          opacity: pulseOpacity,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.warningDot,
                        {
                          backgroundColor: colors.warning,
                          borderColor: mode === 'dark' ? '#0F172A' : '#FFFFFF',
                        },
                      ]}
                    >
                      <Text style={styles.warningDotText}>!</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Tab Title Label */}
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? colors.primary : colors.textSecondary,
                    fontFamily: isFocused ? Fonts.bold : Fonts.medium,
                  },
                ]}
              >
                {labelText}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    width: '100%',
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  capsuleWrapper: {
    width: '88%',
    maxWidth: 80,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 26,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tripBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  tripBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: Fonts.bold,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  warningContainer: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningPulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  warningDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  warningDotText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: Fonts.bold,
    includeFontPadding: false,
    lineHeight: 11,
    textAlignVertical: 'center',
  },
});