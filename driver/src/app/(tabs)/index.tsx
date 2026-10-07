import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useTripStore, DeliveryTrip } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { DriverMap, renderManeuverIcon } from '../../components/DriverMap';
import { TripOfferModal } from '../../components/TripOfferModal';
import { ActiveTripCard } from '../../components/ActiveTripCard';
import { DriverBellSvg, DriverSosSvg } from '../../components/DriverNavIcons';
import { DriverSosModal } from '../../components/DriverSosModal';
import { DriverNotificationModal } from '../../components/DriverNotificationModal';
import { driverNotificationService } from '../../services/notificationService';
import { centrifugo } from '../../services/centrifugo';
import { Radio, ShieldAlert, Clock } from 'lucide-react-native';
import * as Location from 'expo-location';

export default function DriverHomeScreen() {
  const router = useRouter();
  const { colors, mode } = useThemeStore();
  const { user } = useAuthStore();
  const { isOnline, status, updateLocation, syncStatus, lastLatitude, lastLongitude, lastHeading } = useShiftStore();
  const {
    activeTrip,
    incomingOffer,
    currentRoute,
    fetchCurrentTrip,
    setIncomingOffer,
    acceptTrip,
    rejectTrip,
    isLoading,
  } = useTripStore();

  const [routeStats, setRouteStats] = useState<{ distanceText?: string; durationText?: string } | null>(null);
  const [isTripCardOpen, setIsTripCardOpen] = useState(true);

  // Driver SOS & Notification Modals State
  const [showSosModal, setShowSosModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Radar wave pulsing animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (isOnline && !activeTrip) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.8,
              duration: 1500,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.7,
              duration: 0,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isOnline, !!activeTrip]);

  // Fetch initial unread notification count
  useEffect(() => {
    driverNotificationService.getNotifications().then((res) => {
      if (res.data) {
        setUnreadNotificationCount(res.data.unread_count || 0);
      }
    });
  }, []);

  // Whenever an active trip is started/loaded, ensure side card is open
  useEffect(() => {
    if (activeTrip?.id) {
      setIsTripCardOpen(true);
    }
  }, [activeTrip?.id]);

  // Active navigation maneuver step memoized
  const activeStep = useMemo(() => {
    if (!activeTrip || !currentRoute?.steps || currentRoute.steps.length === 0) return null;
    return currentRoute.steps[0];
  }, [activeTrip, currentRoute?.steps]);

  // Initial load
  useEffect(() => {
    syncStatus();
    fetchCurrentTrip();
  }, []);

  // Subscribe to Centrifugo for realtime order pushes
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `orders:driver_${user.id}`;
    const unsubscribe = centrifugo.subscribe(channelName, (data) => {
      if (data?.event === 'NEW_DELIVERY_OFFER' && data?.trip) {
        setIncomingOffer(data.trip);
      } else if (data?.event === 'TRIP_CANCELLED') {
        fetchCurrentTrip();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  // Periodic check when online (fallback if websocket disconnects)
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      if (!activeTrip && !incomingOffer) {
        fetchCurrentTrip();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOnline, activeTrip, incomingOffer]);

  // Periodic GPS tracker
  useEffect(() => {
    let watcher: any = null;

    const startGpsWatch = async () => {
      try {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && !window.isSecureContext) {
            // Geolocation is restricted to HTTPS/localhost on modern browsers
            return;
          }
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                updateLocation(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  pos.coords.heading ?? 0,
                  pos.coords.speed ?? 0
                );
              },
              () => {},
              { enableHighAccuracy: true, timeout: 10000 }
            );

            const watchId = navigator.geolocation.watchPosition(
              (pos) => {
                updateLocation(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  pos.coords.heading ?? 0,
                  pos.coords.speed ?? 0
                );
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 5000 }
            );
            watcher = { remove: () => navigator.geolocation.clearWatch(watchId) };
            return;
          }
        }

        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          updateLocation(
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.heading ?? 0,
            loc.coords.speed ?? 0
          );

          watcher = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 4000,
              distanceInterval: 10,
            },
            (newLoc) => {
              updateLocation(
                newLoc.coords.latitude,
                newLoc.coords.longitude,
                newLoc.coords.heading ?? 0,
                newLoc.coords.speed ?? 0
              );
            }
          );
        }
      } catch (e) {
        // Fallback or permission denial handled gracefully
      }
    };

    if (isOnline || !!activeTrip) {
      startGpsWatch();
    }

    return () => {
      if (watcher) watcher.remove();
    };
  }, [isOnline, !!activeTrip]);

  // Destination coords memoized
  const dest = useMemo(() => {
    if (!activeTrip) return null;
    const isToStore = activeTrip.status === 'ACCEPTED' || activeTrip.status === 'ARRIVED_AT_STORE';
    if (isToStore) {
      const rest = activeTrip.restaurant;
      const rawLat = rest?.latitude ?? (activeTrip as any).restaurant_latitude;
      const rawLon = rest?.longitude ?? (activeTrip as any).restaurant_longitude;
      const name = rest?.name ?? (activeTrip as any).restaurant_name ?? 'المطعم';

      const lat = rawLat !== undefined && rawLat !== null ? Number(rawLat) : null;
      const lon = rawLon !== undefined && rawLon !== null ? Number(rawLon) : null;

      if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return null;

      return {
        lat,
        lon,
        name,
        type: 'RESTAURANT' as const,
      };
    } else {
      const addr = activeTrip.delivery_address;
      const cust = activeTrip.customer;
      const rawLat = addr?.latitude ?? (activeTrip as any).delivery_address_latitude;
      const rawLon = addr?.longitude ?? (activeTrip as any).delivery_address_longitude;
      const custName = cust
        ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim()
        : ((activeTrip as any).customer_name ?? 'العميل');

      const lat = rawLat !== undefined && rawLat !== null ? Number(rawLat) : null;
      const lon = rawLon !== undefined && rawLon !== null ? Number(rawLon) : null;

      if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return null;

      return {
        lat,
        lon,
        name: custName || 'العميل',
        type: 'CUSTOMER' as const,
      };
    }
  }, [
    activeTrip?.id,
    activeTrip?.status,
    activeTrip?.restaurant?.latitude,
    activeTrip?.restaurant?.longitude,
    activeTrip?.delivery_address?.latitude,
    activeTrip?.delivery_address?.longitude,
  ]);

  // Destination location object memoized for DriverMap
  const destinationLocationProp = useMemo(() => {
    return dest ? { latitude: dest.lat, longitude: dest.lon } : null;
  }, [dest?.lat, dest?.lon]);

  // Whenever active trip id or status changes, ensure up-to-date route is fetched
  useEffect(() => {
    if (activeTrip?.id) {
      useTripStore.getState().fetchRoute(activeTrip.id, lastLatitude ?? undefined, lastLongitude ?? undefined);
    }
  }, [activeTrip?.id, activeTrip?.status]);

  // Robust driver location resolution memoized ensuring marker is always visible and object reference is stable
  const resolvedDriverLoc = useMemo(() => {
    if (lastLatitude !== null && lastLongitude !== null) {
      return { latitude: lastLatitude, longitude: lastLongitude, heading: lastHeading };
    }
    if (currentRoute?.origin?.latitude && currentRoute?.origin?.longitude) {
      return {
        latitude: Number(currentRoute.origin.latitude),
        longitude: Number(currentRoute.origin.longitude),
        heading: lastHeading,
      };
    }
    if (dest) {
      return { latitude: dest.lat - 0.015, longitude: dest.lon - 0.012, heading: lastHeading };
    }
    return { latitude: 24.7136, longitude: 46.6753, heading: 0 };
  }, [
    lastLatitude,
    lastLongitude,
    lastHeading,
    currentRoute?.origin?.latitude,
    currentRoute?.origin?.longitude,
    dest?.lat,
    dest?.lon,
  ]);

  // Callback memoized with equality check to prevent infinite re-render cycles
  const handleRouteCalculated = useCallback((stats: { distanceText: string; durationText: string }) => {
    setRouteStats((prev) => {
      if (prev && prev.distanceText === stats.distanceText && prev.durationText === stats.durationText) {
        return prev;
      }
      return stats;
    });
  }, []);

  // Auto re-routing callback triggered when driver deviates from current route
  const handleRerouteNeeded = useCallback(() => {
    if (activeTrip?.id) {
      useTripStore.getState().fetchRoute(
        activeTrip.id,
        lastLatitude ?? undefined,
        lastLongitude ?? undefined,
        true // force_refresh
      );
    }
  }, [activeTrip?.id, lastLatitude, lastLongitude]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header with integrated navigation / greeting */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {activeTrip && activeStep ? (
          <View style={styles.navGuidanceBlock}>
            <View style={[styles.navManeuverIconBox, { backgroundColor: colors.primaryLight }]}>
              {renderManeuverIcon(activeStep.maneuver, colors.primary, 20)}
            </View>
            <View style={styles.navTextCol}>
              <Text style={[styles.navDistText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                {activeStep.distance_text}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.navInstructionText, { color: colors.text, fontFamily: Fonts.bold }]}
              >
                {activeStep.instruction}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.driverInfo}>
            <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              {activeTrip ? 'رحلة جارية' : 'مرحباً بك'}
            </Text>
            <Text style={[styles.driverName, { color: colors.text, fontFamily: Fonts.bold }]}>
              كابتن {user?.first_name || 'السائق'} 👋
            </Text>
          </View>
        )}

        {/* Minimal Route Stats Pill (active trip) */}
        {activeTrip && (routeStats?.durationText || currentRoute?.duration_minutes !== undefined) && (
          <View style={[styles.statsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Clock size={12} color={colors.primary} />
            <Text style={[styles.statsPillText, { color: colors.text, fontFamily: Fonts.bold }]}>
              {routeStats?.durationText || `${currentRoute?.duration_minutes} د`}
            </Text>
            <Text style={[styles.statsPillDot, { color: colors.textSecondary }]}>•</Text>
            <Text style={[styles.statsPillText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              {routeStats?.distanceText || `${currentRoute?.distance_km} كم`}
            </Text>
          </View>
        )}

        <View style={styles.headerLeftControls}>
          {/* Notifications Bell */}
          <TouchableOpacity
            onPress={() => setShowNotificationModal(true)}
            activeOpacity={0.8}
            style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="إشعارات الكابتن"
          >
            <DriverBellSvg size={20} color={colors.text} hasUnread={unreadNotificationCount > 0} />
            {unreadNotificationCount > 0 && (
              <View style={[styles.bellBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Shift Status Pill */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  status === 'ONLINE'
                    ? colors.successLight
                    : status === 'BREAK'
                    ? colors.warningLight
                    : colors.dangerLight,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status === 'ONLINE'
                      ? colors.success
                      : status === 'BREAK'
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    status === 'ONLINE'
                      ? colors.success
                      : status === 'BREAK'
                      ? colors.warning
                      : colors.danger,
                  fontFamily: Fonts.bold,
                },
              ]}
            >
              {status === 'ONLINE' ? 'متصل' : status === 'BREAK' ? 'استراحة' : 'غير متصل'} ⚙️
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Content Area */}
      <View style={styles.mapArea}>
        <DriverMap
          driverLocation={resolvedDriverLoc}
          destinationLocation={destinationLocationProp}
          destinationName={dest?.name}
          destinationType={dest?.type}
          routePolyline={currentRoute?.polyline}
          distanceKm={currentRoute?.distance_km}
          durationMins={currentRoute?.duration_minutes}
          steps={currentRoute?.steps}
          onRouteCalculated={handleRouteCalculated}
          onRerouteNeeded={handleRerouteNeeded}
          hasActiveTrip={!!activeTrip}
          isTripCardOpen={isTripCardOpen}
          onToggleTripCard={() => setIsTripCardOpen((prev) => !prev)}
        />

        {/* Floating SOS Panic Button */}
        <TouchableOpacity
          onPress={() => setShowSosModal(true)}
          activeOpacity={0.85}
          style={styles.floatingSosBtn}
          accessibilityLabel="نداء استغاثة وطوارئ SOS"
        >
          <DriverSosSvg size={22} color="#DC2626" />
          <Text style={[styles.floatingSosText, { fontFamily: Fonts.extraBold }]}>
            SOS
          </Text>
        </TouchableOpacity>

        {/* Floating Top Slim Interactive Radar Pill */}
        {!activeTrip && (
          <TouchableOpacity
            onPress={() => {
              if (isOnline) {
                fetchCurrentTrip();
              } else {
                router.push('/(tabs)/settings');
              }
            }}
            activeOpacity={0.85}
            style={[
              styles.topRadarPill,
              {
                backgroundColor:
                  mode === 'dark' ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: isOnline ? colors.primary : colors.danger,
              },
            ]}
          >
            <View style={styles.radarPulseWrapper}>
              {isOnline ? (
                <>
                  <Animated.View
                    style={[
                      styles.pulseWaveRing,
                      {
                        backgroundColor: colors.primary,
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseOpacity,
                      },
                    ]}
                  />
                  <View style={[styles.pulseCoreDot, { backgroundColor: colors.primary }]} />
                </>
              ) : (
                <View style={[styles.pulseCoreDot, { backgroundColor: colors.danger }]} />
              )}
            </View>

            <View style={styles.topRadarTextCol}>
              <Text style={[styles.topRadarTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                {isOnline ? 'الرادار نشط • يبحث عن أقرب الطلبات 📡' : 'أنت غير متصل بالخدمة ⚠️'}
              </Text>
              <Text style={[styles.topRadarSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                {isOnline ? 'ابقَ متصلاً، سيصلك إشعار فور تعيين طلب لك' : 'انقر للاتصال وبدء استقبال طلبات التوصيل'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Active Trip Floating Side Card (Right Side) */}
        {activeTrip && isTripCardOpen && (
          <View style={styles.sideCardContainer}>
            <ActiveTripCard
              trip={activeTrip}
              onClose={() => setIsTripCardOpen(false)}
            />
          </View>
        )}
      </View>

      {/* Incoming Offer Modal */}
      <TripOfferModal
        offer={incomingOffer}
        onAccept={async (tripId) => {
          await acceptTrip(tripId);
        }}
        onReject={async (tripId) => {
          await rejectTrip(tripId);
        }}
      />

      {/* Driver SOS Emergency Modal */}
      <DriverSosModal
        visible={showSosModal}
        onClose={() => setShowSosModal(false)}
        driverLat={lastLatitude}
        driverLon={lastLongitude}
      />

      {/* Driver Notification Center Modal */}
      <DriverNotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onNotificationsUpdated={(cnt) => setUnreadNotificationCount(cnt)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    gap: 8,
  },
  driverInfo: {
    alignItems: 'flex-end',
    minWidth: 0,
  },
  greeting: {
    fontSize: 11,
  },
  driverName: {
    fontSize: 15,
    marginTop: 1,
  },
  navGuidanceBlock: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  navManeuverIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  navDistText: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'right',
  },
  navInstructionText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  statusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 5,
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
  },
  statsPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  statsPillText: {
    fontSize: 11,
  },
  statsPillDot: {
    fontSize: 10,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    minHeight: 350,
  },
  topRadarPill: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    maxWidth: 420,
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    zIndex: 85,
    gap: 10,
  },
  radarPulseWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseWaveRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  pulseCoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  topRadarTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 1,
  },
  topRadarTitle: {
    fontSize: 13,
  },
  topRadarSub: {
    fontSize: 10,
  },
  sideCardContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 380,
    maxWidth: '92%',
    maxHeight: '94%',
    zIndex: 95,
  },
  headerLeftControls: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  floatingSosBtn: {
    position: 'absolute',
    bottom: 92,
    left: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingVertical: 9,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#EF4444',
    zIndex: 80,
  },
  floatingSosText: {
    color: '#EF4444',
    fontSize: 14,
    letterSpacing: 1,
  },
});
