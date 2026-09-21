import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useTripStore, DeliveryTrip } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { ShiftSlider } from '../../components/ShiftSlider';
import { DriverMap } from '../../components/DriverMap';
import { TripOfferModal } from '../../components/TripOfferModal';
import { ActiveTripCard } from '../../components/ActiveTripCard';
import { centrifugo } from '../../services/centrifugo';
import { Radio, ShieldAlert } from 'lucide-react-native';
import * as Location from 'expo-location';

export default function DriverHomeScreen() {
  const { colors } = useThemeStore();
  const { user } = useAuthStore();
  const { isOnline, status, updateLocation, syncStatus, lastLatitude, lastLongitude } = useShiftStore();
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
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          updateLocation(loc.coords.latitude, loc.coords.longitude);

          watcher = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 15000,
              distanceInterval: 20,
            },
            (newLoc) => {
              updateLocation(newLoc.coords.latitude, newLoc.coords.longitude);
            }
          );
        }
      } catch (e) {
        // Fallback or permission denial handled gracefully
      }
    };

    if (isOnline) {
      startGpsWatch();
    }

    return () => {
      if (watcher) watcher.remove();
    };
  }, [isOnline]);

  // Destination coords logic
  const getDestinationInfo = () => {
    if (!activeTrip) return null;
    const isToStore = activeTrip.status === 'ACCEPTED' || activeTrip.status === 'ARRIVED_AT_STORE';
    if (isToStore) {
      return {
        lat: activeTrip.restaurant.latitude,
        lon: activeTrip.restaurant.longitude,
        name: activeTrip.restaurant.name,
        type: 'RESTAURANT' as const,
      };
    } else {
      return {
        lat: activeTrip.delivery_address.latitude,
        lon: activeTrip.delivery_address.longitude,
        name: `${activeTrip.customer.first_name} ${activeTrip.customer.last_name}`,
        type: 'CUSTOMER' as const,
      };
    }
  };

  const dest = getDestinationInfo();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header with greeting */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.driverInfo}>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            مرحباً بك
          </Text>
          <Text style={[styles.driverName, { color: colors.text, fontFamily: Fonts.bold }]}>
            كابتن {user?.first_name || 'السائق'} 👋
          </Text>
        </View>

        <View
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
            {status === 'ONLINE' ? 'متصل' : status === 'BREAK' ? 'استراحة' : 'غير متصل'}
          </Text>
        </View>
      </View>

      {/* Shift Switcher */}
      <ShiftSlider />

      {/* Map Content Area */}
      <View style={styles.mapArea}>
        <DriverMap
          driverLocation={
            lastLatitude !== null && lastLongitude !== null
              ? { latitude: lastLatitude, longitude: lastLongitude }
              : null
          }
          destinationLocation={dest ? { latitude: dest.lat, longitude: dest.lon } : null}
          destinationName={dest?.name}
          destinationType={dest?.type}
          distanceKm={currentRoute?.distance_km}
          durationMins={currentRoute?.duration_minutes}
        />

        {/* Status Overlay when NO active trip */}
        {!activeTrip && (
          <View style={styles.overlayContainer}>
            {isOnline ? (
              <View style={[styles.radarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.radarIconBox, { backgroundColor: colors.primaryLight }]}>
                  <Radio size={24} color={colors.primary} />
                </View>
                <View style={styles.radarTextContainer}>
                  <Text style={[styles.radarTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                    الرادار يعمل ويبحث عن طلبات 📡
                  </Text>
                  <Text style={[styles.radarSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                    ابقَ متصلاً، سيتم إرسال أقرب الطلبات إلى هاتفك تلقائياً
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.radarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.radarIconBox, { backgroundColor: colors.dangerLight }]}>
                  <ShieldAlert size={24} color={colors.danger} />
                </View>
                <View style={styles.radarTextContainer}>
                  <Text style={[styles.radarTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                    أنت غير متصل بالخدمة
                  </Text>
                  <Text style={[styles.radarSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                    اسحب الزر بالأعلى للاتصال وبدء استقبال طلبات التوصيل
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Active Trip Bottom Floating Card */}
        {activeTrip && (
          <View style={styles.bottomCardContainer}>
            <ActiveTripCard trip={activeTrip} />
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  driverInfo: {
    alignItems: 'flex-end',
  },
  greeting: {
    fontSize: 12,
  },
  driverName: {
    fontSize: 16,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  radarCard: {
    flexDirection: 'row-reverse',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  radarIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  radarTitle: {
    fontSize: 14,
  },
  radarSub: {
    fontSize: 11,
    marginTop: 2,
  },
  bottomCardContainer: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
  },
});
