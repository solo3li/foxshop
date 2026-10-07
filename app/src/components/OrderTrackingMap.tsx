import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import {
  getScooterMarkerSvg,
  getRestaurantMarkerSvg,
  getCustomerMarkerSvg,
} from './TrackingIcons';
import { Navigation } from 'lucide-react-native';

declare const google: any;

export interface OrderTrackingMapProps {
  restaurantLocation?: { latitude: number; longitude: number; name?: string } | null;
  customerLocation?: { latitude: number; longitude: number; address?: string } | null;
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null;
  routePolyline?: string;
  orderStatus?: string;
  isDark?: boolean;
}

// ─── Key Caching ────────────────────────────────────────────────────────────

let cachedApiKey: string | null = null;
let scriptLoadPromise: Promise<void> | null = null;

async function fetchGoogleMapsKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;
  try {
    const res = await api.get('/api/v1/auth/config/');
    const key = res.data?.google_maps_client_key;
    if (key && typeof key === 'string' && key.trim().length > 0) {
      cachedApiKey = key.trim();
      return cachedApiKey;
    }
    return null;
  } catch (err) {
    console.error('[OrderTrackingMap] Failed to fetch Google Maps key:', err);
    return null;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const checkReady = () => typeof window !== 'undefined' && !!(window as any).google?.maps?.Map;

    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      if (checkReady()) {
        resolve();
        return;
      }
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkReady() || attempts > 50) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&language=ar&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (checkReady()) {
        resolve();
        return;
      }
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkReady() || attempts > 40) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    };
    script.onerror = (err) => {
      scriptLoadPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

// ─── Polyline Decoder ───────────────────────────────────────────────────────

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded) return [];
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const OrderTrackingMap: React.FC<OrderTrackingMapProps> = ({
  restaurantLocation,
  customerLocation,
  driverLocation,
  routePolyline,
  orderStatus,
  isDark = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const restMarkerRef = useRef<any>(null);
  const custMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const glowPolylineRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowingDriver, setIsFollowingDriver] = useState(false);

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const apiKey = await fetchGoogleMapsKey();
        if (!apiKey) {
          if (isMounted) setError('مفتاح خرائط جوجل غير متوفر');
          return;
        }
        await loadGoogleMapsScript(apiKey);
        if (!isMounted || !mapContainerRef.current) return;

        const defaultCenter = driverLocation
          ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
          : restaurantLocation
          ? { lat: restaurantLocation.latitude, lng: restaurantLocation.longitude }
          : { lat: 24.7136, lng: 46.6753 };

        const map = new google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });

        mapInstanceRef.current = map;
        if (isMounted) setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'تعذر تحميل الخريطة');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Restaurant Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !restaurantLocation) return;
    const pos = { lat: restaurantLocation.latitude, lng: restaurantLocation.longitude };

    if (!restMarkerRef.current) {
      restMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: getRestaurantMarkerSvg(),
          scaledSize: new google.maps.Size(46, 56),
          anchor: new google.maps.Point(23, 54),
        },
        title: restaurantLocation.name || 'المطعم',
        zIndex: 10,
      });
    } else {
      restMarkerRef.current.setPosition(pos);
    }
  }, [restaurantLocation?.latitude, restaurantLocation?.longitude]);

  // 3. Customer Destination Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !customerLocation) return;
    const pos = { lat: customerLocation.latitude, lng: customerLocation.longitude };

    if (!custMarkerRef.current) {
      custMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: getCustomerMarkerSvg(),
          scaledSize: new google.maps.Size(46, 56),
          anchor: new google.maps.Point(23, 54),
        },
        title: customerLocation.address || 'موقع التوصيل',
        zIndex: 12,
      });
    } else {
      custMarkerRef.current.setPosition(pos);
    }
  }, [customerLocation?.latitude, customerLocation?.longitude]);

  // 4. Real-time Live Driver Scooter Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!driverLocation || !driverLocation.latitude || !driverLocation.longitude) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setVisible(false);
      }
      return;
    }

    const pos = { lat: driverLocation.latitude, lng: driverLocation.longitude };
    const heading = driverLocation.heading || 0;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: getScooterMarkerSvg('#FF2E7E', heading),
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        title: 'كابتن فوكس شوب 🛵',
        zIndex: 25,
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      driverMarkerRef.current.setIcon({
        url: getScooterMarkerSvg('#FF2E7E', heading),
        scaledSize: new google.maps.Size(56, 56),
        anchor: new google.maps.Point(28, 28),
      });
      driverMarkerRef.current.setVisible(true);
    }

    if (isFollowingDriver) {
      mapInstanceRef.current.panTo(pos);
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, driverLocation?.heading, isFollowingDriver]);

  // 5. Route Polyline & Bounds Auto-Fit
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    if (restaurantLocation) {
      bounds.extend({ lat: restaurantLocation.latitude, lng: restaurantLocation.longitude });
      hasCoords = true;
    }
    if (customerLocation) {
      bounds.extend({ lat: customerLocation.latitude, lng: customerLocation.longitude });
      hasCoords = true;
    }
    if (driverLocation && driverLocation.latitude) {
      bounds.extend({ lat: driverLocation.latitude, lng: driverLocation.longitude });
      hasCoords = true;
    }

    if (routePolyline && routePolyline.length > 5) {
      const path = decodePolyline(routePolyline);
      if (path.length >= 2) {
        path.forEach((pt) => bounds.extend(pt));

        if (!glowPolylineRef.current) {
          glowPolylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#FF2E7E',
            strokeOpacity: 0.35,
            strokeWeight: 8,
            map: mapInstanceRef.current,
            zIndex: 4,
          });
        } else {
          glowPolylineRef.current.setPath(path);
          glowPolylineRef.current.setMap(mapInstanceRef.current);
        }

        if (!polylineRef.current) {
          polylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#FF2E7E',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 2.2,
                  strokeColor: '#FFFFFF',
                  strokeOpacity: 1,
                  fillColor: '#FF2E7E',
                  fillOpacity: 1,
                },
                offset: '25px',
                repeat: '75px',
              },
            ],
            map: mapInstanceRef.current,
            zIndex: 5,
          });
        } else {
          polylineRef.current.setPath(path);
          polylineRef.current.setMap(mapInstanceRef.current);
        }
      }
    }

    if (hasCoords && !isFollowingDriver) {
      mapInstanceRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [
    restaurantLocation?.latitude,
    restaurantLocation?.longitude,
    customerLocation?.latitude,
    customerLocation?.longitude,
    routePolyline,
  ]);

  // Toggle Focus
  const handleToggleFocus = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (!isFollowingDriver && driverLocation && driverLocation.latitude) {
      mapInstanceRef.current.panTo({ lat: driverLocation.latitude, lng: driverLocation.longitude });
      mapInstanceRef.current.setZoom(17);
      setIsFollowingDriver(true);
    } else {
      const bounds = new google.maps.LatLngBounds();
      if (restaurantLocation) bounds.extend({ lat: restaurantLocation.latitude, lng: restaurantLocation.longitude });
      if (customerLocation) bounds.extend({ lat: customerLocation.latitude, lng: customerLocation.longitude });
      if (driverLocation && driverLocation.latitude) bounds.extend({ lat: driverLocation.latitude, lng: driverLocation.longitude });
      mapInstanceRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      setIsFollowingDriver(false);
    }
  }, [isFollowingDriver, driverLocation, restaurantLocation, customerLocation]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.fallbackText}>الخريطة التفاعلية متاحة عبر المتصفح</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef as any}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: loading || error ? 0 : 1,
        }}
      />

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF2E7E" />
          <Text style={styles.loadingText}>جارٍ تحميل مسار التوصيل المباشر...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Floating Focus Toggle Button */}
      {driverLocation && !loading && !error && (
        <TouchableOpacity
          onPress={handleToggleFocus}
          style={[
            styles.focusBtn,
            { backgroundColor: isFollowingDriver ? '#FF2E7E' : '#FFFFFF' },
          ]}
          activeOpacity={0.8}
        >
          <Navigation
            size={18}
            color={isFollowingDriver ? '#FFFFFF' : '#111827'}
            strokeWidth={2.4}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  centered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Tajawal_500Medium',
  },
  fallbackText: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  focusBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
});
