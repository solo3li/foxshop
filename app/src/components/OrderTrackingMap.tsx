import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import polyline from '@mapbox/polyline';
import { DEFAULT_COORDINATES } from '../constants/config';
import { loadLeaflet } from '../utils/leafletLoader';
import {
  getScooterMarkerSvg,
  getRestaurantMarkerSvg,
  getCustomerMarkerSvg,
} from './TrackingIcons';
import { Navigation } from 'lucide-react-native';

export interface OrderTrackingMapProps {
  restaurantLocation?: { latitude: number; longitude: number; name?: string } | null;
  customerLocation?: { latitude: number; longitude: number; address?: string } | null;
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null;
  routePolyline?: string;
  orderStatus?: string;
  isDark?: boolean;
}

export const OrderTrackingMap: React.FC<OrderTrackingMapProps> = ({
  restaurantLocation,
  customerLocation,
  driverLocation,
  routePolyline,
  isDark = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const restMarkerRef = useRef<any>(null);
  const custMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const glowPolylineRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);

  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let mounted = true;
    loadLeaflet()
      .then(() => {
        if (mounted) setLeafletReady(true);
      })
      .catch((err) => {
        console.error('[OrderTrackingMap] Leaflet load error:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize OpenStreetMap Leaflet instance
  useEffect(() => {
    if (Platform.OS !== 'web' || !leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L || mapInstanceRef.current) return;

    const initialLat =
      restaurantLocation?.latitude ||
      customerLocation?.latitude ||
      driverLocation?.latitude ||
      DEFAULT_COORDINATES.latitude;
    const initialLng =
      restaurantLocation?.longitude ||
      customerLocation?.longitude ||
      driverLocation?.longitude ||
      DEFAULT_COORDINATES.longitude;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        restMarkerRef.current = null;
        custMarkerRef.current = null;
        driverMarkerRef.current = null;
        glowPolylineRef.current = null;
        routePolylineRef.current = null;
        hasFittedBoundsRef.current = false;
      }
    };
  }, [leafletReady, isDark]);

  // Update markers & OSRM polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = typeof window !== 'undefined' ? (window as any).L : null;
    if (!map || !L) return;

    const points: [number, number][] = [];

    if (restaurantLocation?.latitude && restaurantLocation?.longitude) {
      const pos: [number, number] = [restaurantLocation.latitude, restaurantLocation.longitude];
      points.push(pos);
      const icon = L.divIcon({
        className: 'foxshop-rest-marker',
        html: `<img src="${getRestaurantMarkerSvg()}" style="width:46px;height:56px;" />`,
        iconSize: [46, 56],
        iconAnchor: [23, 54],
      });
      if (!restMarkerRef.current) {
        restMarkerRef.current = L.marker(pos, { icon }).addTo(map);
        if (restaurantLocation.name) restMarkerRef.current.bindPopup(restaurantLocation.name);
      } else {
        restMarkerRef.current.setLatLng(pos);
      }
    }

    if (customerLocation?.latitude && customerLocation?.longitude) {
      const pos: [number, number] = [customerLocation.latitude, customerLocation.longitude];
      points.push(pos);
      const icon = L.divIcon({
        className: 'foxshop-cust-marker',
        html: `<img src="${getCustomerMarkerSvg()}" style="width:46px;height:56px;" />`,
        iconSize: [46, 56],
        iconAnchor: [23, 54],
      });
      if (!custMarkerRef.current) {
        custMarkerRef.current = L.marker(pos, { icon }).addTo(map);
      } else {
        custMarkerRef.current.setLatLng(pos);
      }
    }

    if (driverLocation?.latitude && driverLocation?.longitude) {
      const pos: [number, number] = [driverLocation.latitude, driverLocation.longitude];
      points.push(pos);
      const deg = driverLocation.heading || 0;
      const icon = L.divIcon({
        className: 'foxshop-driver-marker',
        html: `<img src="${getScooterMarkerSvg('#D70F64', deg)}" style="width:52px;height:52px;transition:transform 0.3s ease;" />`,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng(pos);
        driverMarkerRef.current.setIcon(icon);
      }
    }

    // Draw OSRM Polyline
    if (glowPolylineRef.current) {
      glowPolylineRef.current.remove();
      glowPolylineRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routePolyline && routePolyline.trim().length > 0) {
      try {
        const decoded = polyline.decode(routePolyline) as [number, number][];
        if (decoded.length > 0) {
          decoded.forEach((pt) => points.push(pt));
          glowPolylineRef.current = L.polyline(decoded, {
            color: '#EA580C',
            weight: 10,
            opacity: 0.25,
          }).addTo(map);
          routePolylineRef.current = L.polyline(decoded, {
            color: '#D70F64',
            weight: 5,
            opacity: 0.9,
          }).addTo(map);
        }
      } catch (e) {
        console.warn('[OrderTrackingMap] Polyline decode failed:', e);
      }
    }

    if (points.length > 1 && !hasFittedBoundsRef.current) {
      map.fitBounds(L.latLngBounds(points), { padding: [45, 45] });
      hasFittedBoundsRef.current = true;
    } else if (points.length === 1 && !hasFittedBoundsRef.current) {
      map.setView(points[0], 15);
      hasFittedBoundsRef.current = true;
    }
  }, [restaurantLocation, customerLocation, driverLocation, routePolyline, leafletReady]);

  const handleRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    const L = typeof window !== 'undefined' ? (window as any).L : null;
    if (!map || !L) return;

    const pts: [number, number][] = [];
    if (restaurantLocation?.latitude && restaurantLocation?.longitude) {
      pts.push([restaurantLocation.latitude, restaurantLocation.longitude]);
    }
    if (customerLocation?.latitude && customerLocation?.longitude) {
      pts.push([customerLocation.latitude, customerLocation.longitude]);
    }
    if (driverLocation?.latitude && driverLocation?.longitude) {
      pts.push([driverLocation.latitude, driverLocation.longitude]);
    }
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [45, 45] });
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
  }, [restaurantLocation, customerLocation, driverLocation]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.fallbackBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
        <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: '700' }}>
          التتبع الحي عبر OpenStreetMap متاح على الويب
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div
        ref={(el) => {
          mapContainerRef.current = el;
        }}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
      />

      {!leafletReady && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#D70F64" />
          <Text style={styles.loaderText}>جاري تحميل خريطة التتبع الحية (OSM)...</Text>
        </View>
      )}

      {leafletReady && (
        <TouchableOpacity onPress={handleRecenter} style={styles.recenterBtn} activeOpacity={0.85}>
          <Navigation size={18} color="#D70F64" />
          <Text style={styles.recenterText}>توسيط</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 500,
  },
  loaderText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    zIndex: 600,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
});
