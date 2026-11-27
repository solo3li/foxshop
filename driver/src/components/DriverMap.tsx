/**
 * DriverMap — Compact FoxShop Destination & External Google Maps Card
 *
 * Clean, zero-redundancy layout:
 *  - Active trip: compact destination name, single-line OSRM distance/ETA, and primary #D70F64 Google Maps CTA
 *  - Standby: minimal ready-for-orders card with clean GPS connected status (no raw lat/lng clutter)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import {
  Navigation,
  ExternalLink,
  CornerUpRight,
  CornerUpLeft,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowUp,
  RotateCw,
  Undo2,
  MapPin,
  Store,
  Clock,
  Route,
  RefreshCw,
  Radio,
} from 'lucide-react-native';
import { NavigationStep } from '../store/tripStore';
import { DeliveryBoxIcon } from './DeliveryBoxIcon';

export interface DriverMapProps {
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  destinationName?: string;
  destinationType?: 'RESTAURANT' | 'CUSTOMER';
  routePolyline?: string;
  distanceKm?: number;
  durationMins?: number;
  steps?: NavigationStep[];
  onRouteCalculated?: (stats: { distanceText: string; durationText: string }) => void;
  onRerouteNeeded?: () => void;
  hasActiveTrip?: boolean;
  isTripCardOpen?: boolean;
  onToggleTripCard?: () => void;
}

export function renderManeuverIcon(maneuver?: string, color: string = '#FFFFFF', size: number = 24) {
  const m = (maneuver || '').toLowerCase();
  if (m.includes('uturn')) return <Undo2 size={size} color={color} />;
  if (m.includes('roundabout')) return <RotateCw size={size} color={color} />;
  if (m.includes('sharp-left') || m === 'turn-left') return <CornerUpLeft size={size} color={color} />;
  if (m.includes('slight-left') || m.includes('keep-left') || m.includes('ramp-left'))
    return <ArrowUpLeft size={size} color={color} />;
  if (m.includes('sharp-right') || m === 'turn-right') return <CornerUpRight size={size} color={color} />;
  if (m.includes('slight-right') || m.includes('keep-right') || m.includes('ramp-right'))
    return <ArrowUpRight size={size} color={color} />;
  return <ArrowUp size={size} color={color} />;
}

export const DriverMap: React.FC<DriverMapProps> = ({
  driverLocation,
  destinationLocation,
  destinationName,
  destinationType,
  distanceKm,
  durationMins,
  onRerouteNeeded,
  hasActiveTrip = false,
}) => {
  const { colors } = useThemeStore();

  const openExternalGoogleMaps = () => {
    if (!destinationLocation) return;
    const { latitude, longitude } = destinationLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const isStore = destinationType === 'RESTAURANT';
  const phaseColor = isStore ? colors.secondary : colors.success;
  const phaseBg = isStore ? colors.secondaryLight : colors.successLight;

  if (hasActiveTrip && destinationLocation) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
          },
        ]}
      >
        {/* Compact Destination Header */}
        <View style={styles.destHeaderRow}>
          <View style={styles.destMetaCol}>
            <View style={[styles.destIconPill, { backgroundColor: phaseBg }]}>
              {isStore ? (
                <Store size={15} color={phaseColor} />
              ) : (
                <MapPin size={15} color={phaseColor} />
              )}
              <Text style={[styles.destTypeLabel, { color: phaseColor, fontFamily: Fonts.bold }]}>
                {isStore ? 'نقطة الاستلام' : 'وجهة التسليم'}
              </Text>
            </View>
            <Text
              style={[styles.destTitle, { color: colors.text, fontFamily: Fonts.extraBold }]}
              numberOfLines={1}
            >
              {destinationName || (isStore ? 'المتجر' : 'موقع العميل')}
            </Text>
          </View>

          {onRerouteNeeded && (
            <TouchableOpacity
              onPress={onRerouteNeeded}
              style={[styles.refreshBtn, { backgroundColor: colors.surface }]}
              accessibilityLabel="تحديث المسار"
            >
              <RefreshCw size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Single-line OSRM Distance & ETA */}
        <View style={[styles.metricsStrip, { backgroundColor: colors.surface }]}>
          <View style={styles.metricItem}>
            <Route size={15} color={colors.primary} />
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.bold }]}>
              {distanceKm !== undefined ? `${distanceKm.toFixed(1)} كم` : '—'}
            </Text>
          </View>

          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

          <View style={styles.metricItem}>
            <Clock size={15} color={colors.secondary} />
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.bold }]}>
              {durationMins !== undefined ? `${durationMins} دقيقة` : '—'}
            </Text>
          </View>
        </View>

        {/* Primary FoxShop Brand Action: Open Google Maps */}
        <TouchableOpacity
          onPress={openExternalGoogleMaps}
          activeOpacity={0.88}
          style={[styles.primaryNavBtn, { backgroundColor: colors.primary }]}
        >
          <Navigation size={17} color="#FFFFFF" />
          <Text style={[styles.primaryNavText, { fontFamily: Fonts.extraBold }]}>
            فتح الملاحة في خرائط جوجل
          </Text>
          <ExternalLink size={14} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.standbyCard,
        {
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={[styles.standbyIconCircle, { backgroundColor: colors.primaryLight }]}>
        <DeliveryBoxIcon size={36} />
      </View>
      <Text style={[styles.standbyTitle, { color: colors.text, fontFamily: Fonts.extraBold }]}>
        جاهز لاستقبال الطلبات
      </Text>
      <Text style={[styles.standbySub, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
        عند قبول أي طلب، ستظهر تفاصيل الوجهة مع زر مباشر لفتح الملاحة عبر خرائط جوجل.
      </Text>
      <View style={[styles.gpsBadge, { backgroundColor: colors.surface }]}>
        <Radio size={14} color={driverLocation ? colors.success : colors.secondary} />
        <Text
          style={[
            styles.gpsFootNote,
            { color: driverLocation ? colors.success : colors.textSecondary, fontFamily: Fonts.bold },
          ]}
        >
          {driverLocation ? 'بث الموقع المباشر متصل' : 'جاري تحديد موقعك...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm + 2,
  },
  destHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  destMetaCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  destIconPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  destTypeLabel: {
    fontSize: 11,
  },
  destTitle: {
    fontSize: 18,
    textAlign: 'right',
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingVertical: 9,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metricDivider: {
    width: 1,
    height: 18,
  },
  metricValue: {
    fontSize: 14,
  },
  primaryNavBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.md,
  },
  primaryNavText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  gpsBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  gpsFootNote: {
    fontSize: 12,
    textAlign: 'center',
  },
  standbyCard: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 10,
  },
  standbyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standbyTitle: {
    fontSize: 17,
    textAlign: 'center',
  },
  standbySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
