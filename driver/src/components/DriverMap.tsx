import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Navigation, MapPin, Compass, Store, User } from 'lucide-react-native';
import { openExternalNavigation } from '../utils/navigation';

interface DriverMapProps {
  driverLocation?: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  destinationName?: string;
  destinationType?: 'RESTAURANT' | 'CUSTOMER';
  distanceKm?: number;
  durationMins?: number;
}

export const DriverMap: React.FC<DriverMapProps> = ({
  driverLocation,
  destinationLocation,
  destinationName = 'الوجهة',
  destinationType = 'RESTAURANT',
  distanceKm,
  durationMins,
}) => {
  const { colors } = useThemeStore();

  const handleOpenNavigation = () => {
    if (destinationLocation) {
      openExternalNavigation(
        destinationLocation.latitude,
        destinationLocation.longitude,
        destinationName
      );
    } else if (driverLocation) {
      openExternalNavigation(driverLocation.latitude, driverLocation.longitude, 'موقعي الحالي');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Map Graphic Canvas / Simulation */}
      <View style={styles.mapCanvas}>
        {/* Grid lines styling background */}
        <View style={[styles.gridPattern, { borderColor: colors.border }]} />

        {/* Destination Marker */}
        {destinationLocation && (
          <View style={[styles.markerContainer, styles.destMarker]}>
            <View style={[styles.destBadge, { backgroundColor: colors.primary }]}>
              {destinationType === 'RESTAURANT' ? (
                <Store size={20} color="#FFFFFF" />
              ) : (
                <User size={20} color="#FFFFFF" />
              )}
            </View>
            <View style={[styles.destLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.destLabelText, { color: colors.text, fontFamily: Fonts.bold }]}>
                {destinationName}
              </Text>
            </View>
          </View>
        )}

        {/* Driver Current Location Marker */}
        <View style={[styles.markerContainer, styles.driverMarker]}>
          <View style={[styles.pulseRing, { borderColor: colors.primary }]} />
          <View style={[styles.driverBadge, { backgroundColor: colors.primary }]}>
            <Compass size={22} color="#FFFFFF" />
          </View>
          <View style={[styles.driverLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.driverLabelText, { color: colors.text, fontFamily: Fonts.medium }]}>
              موقعك الحالي
            </Text>
          </View>
        </View>

        {/* Route Line Graphic */}
        {destinationLocation && (
          <View style={styles.routeLineWrapper}>
            <View style={[styles.routeDottedLine, { borderColor: colors.primary }]} />
          </View>
        )}
      </View>

      {/* Floating Info & Navigation Action Button */}
      {destinationLocation && (
        <View style={[styles.floatingBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeStats}>
            {durationMins !== undefined && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary, fontFamily: Fonts.extraBold }]}>
                  {durationMins} دقيقة
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                  الوقت التقديري
                </Text>
              </View>
            )}
            {distanceKm !== undefined && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text, fontFamily: Fonts.bold }]}>
                  {distanceKm} كم
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                  المسافة
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={handleOpenNavigation}
            activeOpacity={0.8}
            style={[styles.navButton, { backgroundColor: colors.primary }]}
          >
            <Navigation size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={[styles.navButtonText, { fontFamily: Fonts.bold }]}>
              بدء الملاحة (Google Maps)
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    opacity: 0.15,
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  destMarker: {
    top: '22%',
    right: '25%',
  },
  destBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  destLabel: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    elevation: 2,
  },
  destLabelText: {
    fontSize: 12,
  },
  driverMarker: {
    bottom: '32%',
    left: '25%',
  },
  pulseRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    opacity: 0.4,
    top: -10,
  },
  driverBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  driverLabel: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  driverLabelText: {
    fontSize: 12,
  },
  routeLineWrapper: {
    position: 'absolute',
    width: '55%',
    height: '40%',
    top: '30%',
    left: '25%',
  },
  routeDottedLine: {
    width: '100%',
    height: '100%',
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 20,
    opacity: 0.7,
  },
  floatingBanner: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    gap: Spacing.sm,
  },
  routeStats: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  navButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    gap: 8,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
