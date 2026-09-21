/**
 * DriverMap — Google Maps JS API (Web-optimized via @react-google-maps/api)
 *
 * Features:
 *  - Fetches google_maps_client_key from backend /api/v1/auth/config/ once
 *  - Shows driver's real GPS position as a moving car icon marker
 *  - Shows destination marker (store or customer) with custom icon
 *  - Draws a Directions route polyline between driver and destination
 *  - "بدء الملاحة" button opens Google Maps externally
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Navigation } from 'lucide-react-native';
import { api, API_BASE_URL } from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DriverMapProps {
  driverLocation?: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  destinationName?: string;
  destinationType?: 'RESTAURANT' | 'CUSTOMER';
  distanceKm?: number;
  durationMins?: number;
  onRouteCalculated?: (stats: { distanceText: string; durationText: string }) => void;
}

// ─── Cached API Key ──────────────────────────────────────────────────────────

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
    console.error('[DriverMap] Failed to fetch Google Maps key from backend:', err);
    return null;
  }
}

// ─── Load Google Maps Script once ───────────────────────────────────────────

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // Already loaded globally?
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Intercept Google Maps Auth Failures (e.g. ApiNotActivated, BillingNotEnabled)
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        console.error('[DriverMap] gm_authFailure called: Google Maps key error or restricted.');
      };
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&language=ar`;
    script.async = true;
    script.defer = true;
    script.setAttribute('loading', 'async');
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      scriptLoadPromise = null; // Allow retry on error
      console.error('[DriverMap] Failed to load Google Maps script tag:', err);
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

// ─── Map Styles (dark / light) ───────────────────────────────────────────────

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ba7c0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
];

// ─── SVG Car Icon (inline, colored) ─────────────────────────────────────────

function carIconSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="${color}" fill-opacity="0.95" stroke="white" stroke-width="2.5"/>
    <path d="M10 22 L13 16 Q14 14 16 14 L24 14 Q26 14 27 16 L30 22 L30 27 Q30 28 29 28 L11 28 Q10 28 10 27 Z"
      fill="white" fill-opacity="0.95"/>
    <rect x="13" y="27" width="4" height="3" rx="1.5" fill="${color}"/>
    <rect x="23" y="27" width="4" height="3" rx="1.5" fill="${color}"/>
    <rect x="15" y="16" width="10" height="5" rx="1" fill="${color}" opacity="0.6"/>
    <line x1="10" y1="22" x2="30" y2="22" stroke="${color}" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function destinationIconSvg(color: string, isStore: boolean): string {
  const shape = isStore
    ? `<path d="M16 12 L24 12 L26 18 L14 18 Z" fill="white" opacity="0.95"/>
       <rect x="15" y="18" width="10" height="8" rx="1" fill="white" opacity="0.95"/>
       <rect x="18" y="21" width="4" height="5" rx="0.5" fill="${color}"/>`
    : `<circle cx="20" cy="17" r="5" fill="white" opacity="0.95"/>
       <path d="M15 26 Q15 21 20 21 Q25 21 25 26" fill="white" opacity="0.95"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
    <path d="M22 2 C11 2 3 10 3 21 C3 32 22 50 22 50 C22 50 41 32 41 21 C41 10 33 2 22 2 Z"
      fill="${color}" stroke="white" stroke-width="2"/>
    ${shape}
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const DriverMap: React.FC<DriverMapProps> = ({
  driverLocation,
  destinationLocation,
  destinationName = 'الوجهة',
  destinationType = 'RESTAURANT',
  distanceKm,
  durationMins,
  onRouteCalculated,
}) => {
  const { colors, mode } = useThemeStore();
  const isDark = mode === 'dark';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const routeBoundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const fallbackPolylineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteKeyRef = useRef<string>('');

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowingDriver, setIsFollowingDriver] = useState(false);
  const [computedStats, setComputedStats] = useState<{ distance?: string; duration?: string } | null>(null);

  // ── Step 1: Fetch key + load script ──
  useEffect(() => {
    if (Platform.OS !== 'web') return; // Only for web

    let cancelled = false;
    setLoading(true);

    (async () => {
      const key = await fetchGoogleMapsKey();
      if (cancelled) return;

      if (!key) {
        setError('لم يتم العثور على مفتاح الخريطة. تأكد من ضبطه في لوحة الإدارة.');
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMapsScript(key);
        if (!cancelled) {
          setMapReady(true);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError('فشل تحميل الخريطة. تحقق من المفتاح أو الاتصال.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Step 2: Initialize Google Map ──
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter = driverLocation
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : { lat: 30.0444, lng: 31.2357 }; // Cairo fallback

    const map = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: isDark ? DARK_STYLE : [],
    });

    mapInstanceRef.current = map;
    directionsServiceRef.current = new google.maps.DirectionsService();
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: colors.primary,
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    directionsRendererRef.current.setMap(map);

    // Trigger resize once mounted to ensure container canvas renders properly
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
        mapInstanceRef.current.setCenter(defaultCenter);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [mapReady, isDark, colors.primary]);

  // ── Step 3: Update driver marker position ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const hasValidDriverLoc =
      driverLocation &&
      typeof driverLocation.latitude === 'number' &&
      !isNaN(driverLocation.latitude) &&
      typeof driverLocation.longitude === 'number' &&
      !isNaN(driverLocation.longitude);

    const pos = hasValidDriverLoc
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : null;

    if (!pos) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setVisible(false);
      }
      return;
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: carIconSvg(colors.primary),
          scaledSize: new google.maps.Size(44, 44),
          anchor: new google.maps.Point(22, 22),
        },
        title: 'موقعك الحالي',
        zIndex: 10,
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      driverMarkerRef.current.setVisible(true);
    }

    // Center map on driver if no active destination
    if (!destinationLocation) {
      mapInstanceRef.current.panTo(pos);
    }
  }, [mapReady, driverLocation, colors.primary, destinationLocation]);

  // ── Step 4: Update destination marker ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const hasValidDest =
      destinationLocation &&
      typeof destinationLocation.latitude === 'number' &&
      !isNaN(destinationLocation.latitude) &&
      typeof destinationLocation.longitude === 'number' &&
      !isNaN(destinationLocation.longitude);

    if (!hasValidDest) {
      if (destMarkerRef.current) {
        destMarkerRef.current.setVisible(false);
      }
      return;
    }

    const pos = { lat: destinationLocation.latitude, lng: destinationLocation.longitude };

    if (!destMarkerRef.current) {
      destMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: destinationIconSvg(
            destinationType === 'RESTAURANT' ? '#FF6B35' : '#10B981',
            destinationType === 'RESTAURANT'
          ),
          scaledSize: new google.maps.Size(44, 52),
          anchor: new google.maps.Point(22, 52),
        },
        title: destinationName,
        zIndex: 9,
      });

      // Info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `<div dir="rtl" style="font-family: Tajawal, Arial; padding: 4px 8px; font-size: 13px; font-weight: bold;">${destinationName}</div>`,
      });
      destMarkerRef.current.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current!, destMarkerRef.current!);
      });
    } else {
      destMarkerRef.current.setPosition(pos);
      destMarkerRef.current.setVisible(true);
    }
  }, [mapReady, destinationLocation, destinationName, destinationType]);

  // ── Step 5: Draw route via Directions API ──
  useEffect(() => {
    if (!mapReady || !directionsServiceRef.current || !directionsRendererRef.current) return;

    const hasValidDriverLoc =
      driverLocation &&
      typeof driverLocation.latitude === 'number' &&
      !isNaN(driverLocation.latitude) &&
      typeof driverLocation.longitude === 'number' &&
      !isNaN(driverLocation.longitude);

    const hasValidDest =
      destinationLocation &&
      typeof destinationLocation.latitude === 'number' &&
      !isNaN(destinationLocation.latitude) &&
      typeof destinationLocation.longitude === 'number' &&
      !isNaN(destinationLocation.longitude);

    if (!hasValidDriverLoc || !hasValidDest) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
      lastRouteKeyRef.current = '';
      return;
    }

    const routeKey = `${driverLocation.latitude.toFixed(4)},${driverLocation.longitude.toFixed(4)}_${destinationLocation.latitude.toFixed(4)},${destinationLocation.longitude.toFixed(4)}`;

    // Avoid re-requesting the same route (expensive API call)
    if (routeKey === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = routeKey;

    directionsServiceRef.current.route(
      {
        origin: { lat: driverLocation.latitude, lng: driverLocation.longitude },
        destination: { lat: destinationLocation.latitude, lng: destinationLocation.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
            fallbackPolylineRef.current = null;
          }

          directionsRendererRef.current!.setDirections(result);

          // Extract real computed distance and duration
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setComputedStats({
              distance: leg.distance?.text,
              duration: leg.duration?.text,
            });
            onRouteCalculated?.({
              distanceText: leg.distance?.text || '',
              durationText: leg.duration?.text || '',
            });
          }

          // Fit map to route bounds
          const bounds = result.routes[0]?.bounds;
          if (bounds) {
            routeBoundsRef.current = bounds;
            if (mapInstanceRef.current) {
              mapInstanceRef.current.fitBounds(bounds, { top: 90, bottom: 120, left: 25, right: 25 });
            }
          }
        } else {
          // Fallback: draw straight geodesic polyline between driver and destination
          console.warn('[DriverMap] Driving directions failed, drawing fallback line:', status);
          if (mapInstanceRef.current) {
            const path = [
              { lat: driverLocation.latitude, lng: driverLocation.longitude },
              { lat: destinationLocation.latitude, lng: destinationLocation.longitude },
            ];
            if (!fallbackPolylineRef.current) {
              fallbackPolylineRef.current = new google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: colors.primary,
                strokeOpacity: 0.85,
                strokeWeight: 4,
                map: mapInstanceRef.current,
              });
            } else {
              fallbackPolylineRef.current.setPath(path);
              fallbackPolylineRef.current.setMap(mapInstanceRef.current);
            }

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(path[0]);
            bounds.extend(path[1]);
            routeBoundsRef.current = bounds;
            mapInstanceRef.current.fitBounds(bounds, { top: 90, bottom: 120, left: 25, right: 25 });
          }
        }
      }
    );
  }, [mapReady, driverLocation, destinationLocation, colors.primary]);

  // ── In-App Focus / Route Navigation handler ──
  const handleFocusRoute = useCallback(() => {
    if (!mapInstanceRef.current) return;

    if (!isFollowingDriver) {
      // Zoom close to driver for focused tracking view
      if (driverLocation) {
        mapInstanceRef.current.panTo({ lat: driverLocation.latitude, lng: driverLocation.longitude });
        mapInstanceRef.current.setZoom(17);
        setIsFollowingDriver(true);
      }
    } else {
      // Zoom out to view full route
      if (routeBoundsRef.current) {
        mapInstanceRef.current.fitBounds(routeBoundsRef.current, { top: 90, bottom: 120, left: 25, right: 25 });
      } else if (driverLocation && destinationLocation) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: driverLocation.latitude, lng: driverLocation.longitude });
        bounds.extend({ lat: destinationLocation.latitude, lng: destinationLocation.longitude });
        mapInstanceRef.current.fitBounds(bounds, { top: 90, bottom: 120, left: 25, right: 25 });
      }
      setIsFollowingDriver(false);
    }
  }, [driverLocation, destinationLocation, isFollowingDriver]);

  // ── Non-web fallback ──
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.surface }]}>
        <Text style={[styles.fallbackText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
          الخريطة متاحة على المتصفح فقط
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Google Maps Container (web only) */}
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
          visibility: loading || error ? 'hidden' : 'visible',
        }}
      />

      {/* Loading State */}
      {loading && (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            جارٍ تحميل الخريطة...
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorIcon]}>🗺️</Text>
          <Text style={[styles.errorTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            تعذّر تحميل الخريطة
          </Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Floating Action Button (FAB) for In-App Route Tracking 🧭 */}
      {destinationLocation && !loading && !error && (
        <TouchableOpacity
          onPress={handleFocusRoute}
          activeOpacity={0.8}
          style={[
            styles.fabTrackingButton,
            {
              backgroundColor: isFollowingDriver ? colors.primary : colors.card,
              borderColor: isFollowingDriver ? colors.primary : colors.border,
            },
          ]}
          accessibilityLabel="تتبع المسار وموقعي"
        >
          <Navigation
            size={20}
            color={isFollowingDriver ? '#FFFFFF' : colors.text}
            strokeWidth={2.4}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  fallbackText: {
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 42,
  },
  errorTitle: {
    fontSize: 16,
    marginTop: 4,
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 4,
    lineHeight: 20,
  },
  fabTrackingButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
});
