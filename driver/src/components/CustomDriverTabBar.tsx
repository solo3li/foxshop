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

  // Safe bottom margin accounting for home indicator and Android navigation
  const bottomMargin = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

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
          bottom: bottomMargin,
          backgroundColor:
            mode === 'dark'
              ? 'rgba(15, 23, 42, 0.92)'
              : 'rgba(255, 255, 255, 0.94)',
          borderColor:
            mode === 'dark'
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(255, 255, 255, 0.7)',
          shadowColor: '#000000',
          shadowOpacity: mode === 'dark' ? 0.45 : 0.12,
        },
        Platform.OS === 'web' &&
          ({
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow:
              mode === 'dark'
                ? '0 12px 36px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 12px 36px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05)',
          } as any),
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
                isFocused && [
                  styles.capsuleActive,
                  {
                    backgroundColor:
                      mode === 'dark'
                        ? 'rgba(215, 15, 100, 0.20)'
                        : 'rgba(215, 15, 100, 0.10)',
                    borderColor:
                      mode === 'dark'
                        ? 'rgba(215, 15, 100, 0.45)'
                        : 'rgba(215, 15, 100, 0.28)',
                    shadowColor: colors.primary,
                  },
                  Platform.OS === 'web' &&
                    ({
                      boxShadow:
                        mode === 'dark'
                          ? '0 2px 10px rgba(215, 15, 100, 0.40)'
                          : '0 2px 8px rgba(215, 15, 100, 0.25)',
                    } as any),
                ],
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
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 580,
    alignSelf: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
    height: 66,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  capsuleWrapper: {
    width: '92%',
    maxWidth: 82,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  capsuleActive: {
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
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