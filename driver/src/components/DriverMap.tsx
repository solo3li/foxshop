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
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
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

    const checkReady = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false;
      if ((window as any).google?.maps?.Map) {
        resolve();
        return true;
      }
      if ((window as any).google?.maps?.importLibrary) {
        try {
          await (window as any).google.maps.importLibrary('maps');
          if ((window as any).google?.maps?.Map) {
            resolve();
            return true;
          }
        } catch (e) {}
      }
      return false;
    };

    const existingScript = typeof document !== 'undefined'
      ? document.querySelector('script[src*="maps.googleapis.com"]')
      : null;

    if (existingScript) {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if ((await checkReady()) || attempts > 50) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&language=ar`;
    script.async = true;
    script.defer = true;
    script.onload = async () => {
      if (await checkReady()) return;
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if ((await checkReady()) || attempts > 40) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
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

// ─── Creative Animated Fox Delivery Scooter (SVG + SMIL Animation) ─────────

function carIconSvg(primaryColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <defs>
      <!-- Radar Pulse Radial Gradient -->
      <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.35"/>
        <stop offset="70%" stop-color="${primaryColor}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
      </radialGradient>
      <!-- Headlight Beam Gradient -->
      <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
        <stop offset="35%" stop-color="#FEF08A" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#FEF08A" stop-opacity="0"/>
      </linearGradient>
      <!-- Vehicle Body 3D Gradient -->
      <linearGradient id="scooterBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#374151"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <!-- Fox Delivery Box Gradient -->
      <linearGradient id="foxBox" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF2E7E"/>
        <stop offset="50%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="#9F0744"/>
      </linearGradient>
      <!-- Wheel Rim Gradient -->
      <radialGradient id="wheelRim" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E5E7EB"/>
        <stop offset="40%" stop-color="#4B5563"/>
        <stop offset="100%" stop-color="#1F2937"/>
      </radialGradient>
    </defs>

    <!-- 1. Animated Radar Pulse Wave (expanding 60fps) -->
    <circle cx="32" cy="32" r="16" fill="url(#radarPulse)">
      <animate attributeName="r" values="16;31;16" dur="2.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="32" cy="32" r="18" fill="none" stroke="${primaryColor}" stroke-width="1.5">
      <animate attributeName="r" values="18;30" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.75;0" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="stroke-width" values="1.5;0.5" dur="1.8s" repeatCount="indefinite"/>
    </circle>

    <!-- 2. Animated Headlight Cone Beam (forward illuminated beam) -->
    <polygon points="42,32 62,23 62,41" fill="url(#headlightBeam)">
      <animate attributeName="opacity" values="0.55;0.9;0.55" dur="1.5s" repeatCount="indefinite"/>
    </polygon>

    <!-- 3. Driver Base Marker Disc with 3D drop shadow -->
    <circle cx="32" cy="32" r="20" fill="url(#scooterBody)" stroke="#FFFFFF" stroke-width="2.5"/>

    <!-- 4. Scooter Rear Wheel & Front Wheel -->
    <circle cx="21" cy="39" r="4.5" fill="url(#wheelRim)" stroke="#111827" stroke-width="1.5"/>
    <circle cx="43" cy="39" r="4.5" fill="url(#wheelRim)" stroke="#111827" stroke-width="1.5"/>

    <!-- 5. Scooter Chassis & Frame -->
    <path d="M21 39 L27 39 L33 38 L40 32 L43 39" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>

    <!-- 6. Fox Delivery Cargo Box (Rear) -->
    <rect x="18" y="24" width="11" height="11" rx="2.5" fill="url(#foxBox)" stroke="#FFFFFF" stroke-width="1"/>
    <!-- Fox emblem on box -->
    <circle cx="23.5" cy="29.5" r="3" fill="#FFFFFF"/>
    <polygon points="21.5,27.5 25.5,27.5 23.5,30.5" fill="${primaryColor}"/>

    <!-- 7. Rider Silhouette / Handlebars -->
    <path d="M33 34 L36 27 L40 27" fill="none" stroke="#F3F4F6" stroke-width="2" stroke-linecap="round"/>
    <!-- Rider Helmet -->
    <circle cx="32" cy="22" r="4" fill="#F3F4F6"/>
    <!-- Visor -->
    <path d="M33 21 Q35 21 35 23" stroke="#111827" stroke-width="1.5" stroke-linecap="round" fill="none"/>

    <!-- 8. Headlight Lens (front bulb) -->
    <circle cx="42" cy="32" r="2" fill="#FEF08A" stroke="#FFFFFF" stroke-width="0.8"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ─── Smart Destination Pin SVG (Store vs Customer with Radar Ground) ───────

function destinationIconSvg(isStore: boolean): string {
  const primaryGrad = isStore
    ? `<linearGradient id="destGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF7A00"/>
        <stop offset="50%" stop-color="#FF5722"/>
        <stop offset="100%" stop-color="#D84315"/>
       </linearGradient>`
    : `<linearGradient id="destGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#34D399"/>
        <stop offset="50%" stop-color="#10B981"/>
        <stop offset="100%" stop-color="#047857"/>
       </linearGradient>`;

  const badgeColor = isStore ? '#FF5722' : '#10B981';

  // Inside Glyph (Store vs Home)
  const innerGlyph = isStore
    ? `<!-- Restaurant Awning & Store Building -->
       <path d="M16 20 L32 20 L30 25 L18 25 Z" fill="#FFFFFF"/>
       <rect x="18" y="25" width="12" height="9" rx="1.5" fill="#FFFFFF" fill-opacity="0.95"/>
       <path d="M22 28 L22 32 M26 28 L26 32" stroke="${badgeColor}" stroke-width="1.5" stroke-linecap="round"/>`
    : `<!-- Customer House & Delivery Icon -->
       <polygon points="24,17 15,24 18,24 18,32 30,32 30,24 33,24" fill="#FFFFFF"/>
       <rect x="22" y="26" width="4" height="6" rx="0.5" fill="${badgeColor}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60">
    <defs>
      ${primaryGrad}
      <linearGradient id="destShadow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="destSpecular" x1="0%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Ground Target Pulse Ring -->
    <ellipse cx="24" cy="57" rx="10" ry="3" fill="none" stroke="${badgeColor}" stroke-width="1.5">
      <animate attributeName="rx" values="6;14;6" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="ry" values="2;4.5;2" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="24" cy="57" rx="6" ry="2" fill="url(#destShadow)"/>

    <!-- Main 3D Destination Pin Teardrop -->
    <path d="M24 56 C23.2 56 7 36 7 21 C7 11.5 14.5 3 24 3 C33.5 3 41 11.5 41 21 C41 36 24.8 56 24 56 Z"
      fill="url(#destGrad)" stroke="#FFFFFF" stroke-width="2"/>

    <!-- Specular Highlight Curve -->
    <path d="M12 12 C15 6 21 4 25 4 C23 7 18 10 15 18 Z" fill="url(#destSpecular)"/>

    <!-- Inner Core Disc -->
    <circle cx="24" cy="21" r="12" fill="rgba(0,0,0,0.15)"/>
    <circle cx="24" cy="21" r="11" fill="url(#destGrad)" stroke="#FFFFFF" stroke-width="1.5"/>

    <!-- Inner Icon -->
    ${innerGlyph}

    <!-- Sharp Target Tip Dot -->
    <circle cx="24" cy="56" r="1.5" fill="#FFFFFF"/>
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
    if (typeof window === 'undefined' || !(window as any).google?.maps?.Map) return;

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
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        title: 'موقعك الحالي (كابتن فوكس)',
        zIndex: 10,
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      driverMarkerRef.current.setIcon({
        url: carIconSvg(colors.primary),
        scaledSize: new google.maps.Size(56, 56),
        anchor: new google.maps.Point(28, 28),
      });
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
    const isStore = destinationType === 'RESTAURANT';

    if (!destMarkerRef.current) {
      destMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        icon: {
          url: destinationIconSvg(isStore),
          scaledSize: new google.maps.Size(46, 58),
          anchor: new google.maps.Point(23, 56),
        },
        title: destinationName,
        zIndex: 9,
      });

      // Info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `<div dir="rtl" style="font-family: Tajawal, Arial; padding: 4px 8px; font-size: 13px; font-weight: bold;">${destinationName} (${isStore ? 'استلام الطلب' : 'تسليم للعميل'})</div>`,
      });
      destMarkerRef.current.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current!, destMarkerRef.current!);
      });
    } else {
      destMarkerRef.current.setPosition(pos);
      destMarkerRef.current.setIcon({
        url: destinationIconSvg(isStore),
        scaledSize: new google.maps.Size(46, 58),
        anchor: new google.maps.Point(23, 56),
      });
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
