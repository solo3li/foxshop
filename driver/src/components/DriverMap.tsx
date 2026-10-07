/**
 * DriverMap — Pure Google Maps JS API (Web-optimized)
 *
 * Exclusively powered by Google Maps Platform:
 *  - Official Google Maps JS API with Google Directions route rendering
 *  - Real-time Driver GPS vehicle marker with dynamic bearing (heading) rotation
 *  - Smart Destination Pin (Store vs Customer) with ground pulse radar
 *  - Turn-by-Turn HUD Banner displaying upcoming maneuvers, distance, and Arabic instructions
 *  - Quick "بدء الملاحة" button to launch Google Maps externally
 *  - Auto Off-Route detection (>150m deviation triggers single Google re-route)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import {
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowUp,
  RotateCw,
  Undo2,
  ExternalLink,
} from 'lucide-react-native';
import { api } from '../services/api';
import { decodeRoutePolyline } from '../utils/navigationUtils';
import { NavigationStep } from '../store/tripStore';
import { DeliveryBoxIcon } from './DeliveryBoxIcon';

// ─── Types ──────────────────────────────────────────────────────────────────

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
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const checkReady = () => {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
        return true;
      }
      return false;
    };

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

// ─── Distance Math Helper ───────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Maneuver Icon Helper ───────────────────────────────────────────────────

export function renderManeuverIcon(maneuver: string = '', color: string, size = 20) {
  const m = maneuver.toLowerCase();
  if (m.includes('right')) {
    if (m.includes('slight')) return <ArrowUpRight size={size} color={color} strokeWidth={2.4} />;
    return <CornerUpRight size={size} color={color} strokeWidth={2.4} />;
  }
  if (m.includes('left')) {
    if (m.includes('slight')) return <ArrowUpLeft size={size} color={color} strokeWidth={2.4} />;
    return <CornerUpLeft size={size} color={color} strokeWidth={2.4} />;
  }
  if (m.includes('roundabout') || m.includes('rotary')) {
    return <RotateCw size={size} color={color} strokeWidth={2.4} />;
  }
  if (m.includes('u-turn')) {
    return <Undo2 size={size} color={color} strokeWidth={2.4} />;
  }
  return <ArrowUp size={size} color={color} strokeWidth={2.4} />;
}

// ─── Creative Animated Fox Delivery Scooter (SVG + Dynamic Bearing) ────────

function carIconSvg(primaryColor: string, heading: number = 0): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.4"/>
        <stop offset="70%" stop-color="${primaryColor}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
        <stop offset="40%" stop-color="#FEF08A" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#FEF08A" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="scooterBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#374151"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <linearGradient id="foxBox" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF2E7E"/>
        <stop offset="50%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="#9F0744"/>
      </linearGradient>
      <radialGradient id="wheelRim" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E5E7EB"/>
        <stop offset="40%" stop-color="#4B5563"/>
        <stop offset="100%" stop-color="#1F2937"/>
      </radialGradient>
    </defs>

    <!-- 1. Radar Ground Target Ring (Fixed) -->
    <circle cx="32" cy="32" r="16" fill="url(#radarPulse)">
      <animate attributeName="r" values="16;31;16" dur="2.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="2.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="32" cy="32" r="18" fill="none" stroke="${primaryColor}" stroke-width="1.5">
      <animate attributeName="r" values="18;30" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.75;0" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="stroke-width" values="1.5;0.5" dur="1.8s" repeatCount="indefinite"/>
    </circle>

    <!-- 2. Rotating Vehicle & Headlight Group -->
    <g transform="rotate(${heading} 32 32)">
      <!-- Animated Headlight Beam Cone -->
      <polygon points="42,32 62,23 62,41" fill="url(#headlightBeam)">
        <animate attributeName="opacity" values="0.55;0.95;0.55" dur="1.5s" repeatCount="indefinite"/>
      </polygon>

      <!-- Driver Disc Base -->
      <circle cx="32" cy="32" r="20" fill="url(#scooterBody)" stroke="#FFFFFF" stroke-width="2.5"/>

      <!-- Scooter Wheels -->
      <circle cx="21" cy="39" r="4.5" fill="url(#wheelRim)" stroke="#111827" stroke-width="1.5"/>
      <circle cx="43" cy="39" r="4.5" fill="url(#wheelRim)" stroke="#111827" stroke-width="1.5"/>

      <!-- Chassis -->
      <path d="M21 39 L27 39 L33 38 L40 32 L43 39" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>

      <!-- Fox Delivery Box -->
      <rect x="18" y="24" width="11" height="11" rx="2.5" fill="url(#foxBox)" stroke="#FFFFFF" stroke-width="1"/>
      <circle cx="23.5" cy="29.5" r="3" fill="#FFFFFF"/>
      <polygon points="21.5,27.5 25.5,27.5 23.5,30.5" fill="${primaryColor}"/>

      <!-- Rider Silhouette & Visor -->
      <path d="M33 34 L36 27 L40 27" fill="none" stroke="#F3F4F6" stroke-width="2" stroke-linecap="round"/>
      <circle cx="32" cy="22" r="4" fill="#F3F4F6"/>
      <path d="M33 21 Q35 21 35 23" stroke="#111827" stroke-width="1.5" stroke-linecap="round" fill="none"/>

      <!-- Front Headlight Bulb -->
      <circle cx="42" cy="32" r="2" fill="#FEF08A" stroke="#FFFFFF" stroke-width="0.8"/>
    </g>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ─── Creative Destination Pin SVG (Store vs Customer) ───────────────────────

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

  const innerGlyph = isStore
    ? `<path d="M16 20 L32 20 L30 25 L18 25 Z" fill="#FFFFFF"/>
       <rect x="18" y="25" width="12" height="9" rx="1.5" fill="#FFFFFF" fill-opacity="0.95"/>
       <path d="M22 28 L22 32 M26 28 L26 32" stroke="${badgeColor}" stroke-width="1.5" stroke-linecap="round"/>`
    : `<polygon points="24,17 15,24 18,24 18,32 30,32 30,24 33,24" fill="#FFFFFF"/>
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

    <!-- Ground Pulse Ring -->
    <ellipse cx="24" cy="57" rx="10" ry="3" fill="none" stroke="${badgeColor}" stroke-width="1.5">
      <animate attributeName="rx" values="6;14;6" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="ry" values="2;4.5;2" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="24" cy="57" rx="6" ry="2" fill="url(#destShadow)"/>

    <!-- Main Pin Teardrop -->
    <path d="M24 56 C23.2 56 7 36 7 21 C7 11.5 14.5 3 24 3 C33.5 3 41 11.5 41 21 C41 36 24.8 56 24 56 Z"
      fill="url(#destGrad)" stroke="#FFFFFF" stroke-width="2"/>

    <!-- Specular Highlight -->
    <path d="M12 12 C15 6 21 4 25 4 C23 7 18 10 15 18 Z" fill="url(#destSpecular)"/>

    <!-- Icon Badge -->
    <circle cx="24" cy="21" r="11" fill="rgba(0,0,0,0.18)"/>
    ${innerGlyph}

    <!-- Pin Tip Glow Point -->
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
  routePolyline,
  distanceKm,
  durationMins,
  steps = [],
  onRouteCalculated,
  onRerouteNeeded,
  hasActiveTrip = false,
  isTripCardOpen = false,
  onToggleTripCard,
}) => {
  const { colors, mode } = useThemeStore();
  const isDark = mode === 'dark';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const backendPolylineRef = useRef<google.maps.Polyline | null>(null);
  const glowPolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeBoundsRef = useRef<google.maps.LatLngBounds | null>(null);

  const onRouteCalculatedRef = useRef(onRouteCalculated);
  onRouteCalculatedRef.current = onRouteCalculated;
  const onRerouteNeededRef = useRef(onRerouteNeeded);
  onRerouteNeededRef.current = onRerouteNeeded;

  const lastNotifiedStatsRef = useRef<string>('');
  const lastRerouteTimeRef = useRef<number>(0);

  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowingDriver, setIsFollowingDriver] = useState(false);

  // ── Step 1: Fetch Google Maps Key & Load Script ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;

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
          setError('فشل تحميل خرائط جوجل. تحقق من الاتصال بالمزود.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 2: Initialize Google Map ──
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current || mapInstanceRef.current) return;
    if (typeof window === 'undefined' || !(window as any).google?.maps?.Map) return;

    const defaultCenter = driverLocation
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : { lat: 24.7136, lng: 46.6753 }; // Riyadh default

    const map = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: isDark ? DARK_STYLE : [],
    });

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
        mapInstanceRef.current.setCenter(defaultCenter);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [mapReady, isDark]);

  // ── Step 3: Update Driver Vehicle Marker with Dynamic Heading Rotation ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const hasValidDriverLoc =
      driverLocation &&
      typeof driverLocation.latitude === 'number' &&
      !isNaN(driverLocation.latitude) &&
      typeof driverLocation.longitude === 'number' &&
      !isNaN(driverLocation.longitude);

    if (!hasValidDriverLoc) {
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
          url: carIconSvg(colors.primary, heading),
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        title: 'موقعك الحالي (كابتن فوكس)',
        zIndex: 15,
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      driverMarkerRef.current.setIcon({
        url: carIconSvg(colors.primary, heading),
        scaledSize: new google.maps.Size(56, 56),
        anchor: new google.maps.Point(28, 28),
      });
      driverMarkerRef.current.setVisible(true);
    }

    if (!destinationLocation) {
      mapInstanceRef.current.panTo(pos);
    } else if (isFollowingDriver) {
      mapInstanceRef.current.panTo(pos);
    }
  }, [
    mapReady,
    driverLocation?.latitude,
    driverLocation?.longitude,
    driverLocation?.heading,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    isFollowingDriver,
    colors.primary,
  ]);

  // ── Step 4: Update Destination Marker ──
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
        zIndex: 10,
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
  }, [
    mapReady,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    destinationName,
    destinationType,
  ]);

  // ── Step 5: Draw Official Google Route Polyline ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    if (!destinationLocation && !routePolyline) {
      if (backendPolylineRef.current) {
        backendPolylineRef.current.setMap(null);
        backendPolylineRef.current = null;
      }
      if (glowPolylineRef.current) {
        glowPolylineRef.current.setMap(null);
        glowPolylineRef.current = null;
      }
      return;
    }

    if (routePolyline && routePolyline.length > 5) {
      const decodedCoords = decodeRoutePolyline(routePolyline);
      if (decodedCoords.length >= 2) {
        const path = decodedCoords.map((pt) => ({ lat: pt.latitude, lng: pt.longitude }));

        // Outer glow polyline (High-end neon effect)
        if (!glowPolylineRef.current) {
          glowPolylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: colors.primary,
            strokeOpacity: 0.35,
            strokeWeight: 9,
            map: mapInstanceRef.current,
            zIndex: 4,
          });
        } else {
          glowPolylineRef.current.setPath(path);
          glowPolylineRef.current.setMap(mapInstanceRef.current);
        }

        // Main navigation road polyline with directional arrows
        if (!backendPolylineRef.current) {
          backendPolylineRef.current = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: colors.primary,
            strokeOpacity: 0.95,
            strokeWeight: 5,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 2.2,
                  strokeColor: '#FFFFFF',
                  strokeOpacity: 1,
                  fillColor: colors.primary,
                  fillOpacity: 1,
                },
                offset: '30px',
                repeat: '85px',
              },
            ],
            map: mapInstanceRef.current,
            zIndex: 5,
          });
        } else {
          backendPolylineRef.current.setPath(path);
          backendPolylineRef.current.setMap(mapInstanceRef.current);
        }

        // Fit map bounds to cover entire path and markers
        const bounds = new google.maps.LatLngBounds();
        path.forEach((pt) => bounds.extend(pt));
        if (driverLocation) {
          bounds.extend({ lat: driverLocation.latitude, lng: driverLocation.longitude });
        }
        if (destinationLocation) {
          bounds.extend({ lat: destinationLocation.latitude, lng: destinationLocation.longitude });
        }
        routeBoundsRef.current = bounds;
        mapInstanceRef.current.fitBounds(bounds, { top: 90, bottom: 130, left: 35, right: 35 });

        const statsKey = `${distanceKm}_${durationMins}`;
        if (distanceKm !== undefined && durationMins !== undefined && lastNotifiedStatsRef.current !== statsKey) {
          lastNotifiedStatsRef.current = statsKey;
          onRouteCalculatedRef.current?.({
            distanceText: `${distanceKm} كم`,
            durationText: `${durationMins} د`,
          });
        }
      }
    }
  }, [
    mapReady,
    driverLocation?.latitude,
    driverLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    routePolyline,
    distanceKm,
    durationMins,
    colors.primary,
  ]);

  // ── Step 6: Smart Detour / Off-Route Detection (>150m from polyline) ──
  useEffect(() => {
    if (!driverLocation || !routePolyline || !onRerouteNeededRef.current) return;

    const now = Date.now();
    // 30 seconds cooldown between automatic re-routing calls to protect quotas
    if (now - lastRerouteTimeRef.current < 30000) return;

    const coords = decodeRoutePolyline(routePolyline);
    if (coords.length < 2) return;

    let minDistance = Infinity;
    // Check every other point for performance
    for (let i = 0; i < coords.length; i += 2) {
      const d = haversineMeters(
        driverLocation.latitude,
        driverLocation.longitude,
        coords[i].latitude,
        coords[i].longitude
      );
      if (d < minDistance) minDistance = d;
      if (minDistance < 35) break; // on route
    }

    if (minDistance > 160 && isFinite(minDistance)) {
      lastRerouteTimeRef.current = now;
      console.log(`[DriverMap] Off-route detected (${Math.round(minDistance)}m away). Requesting single re-route.`);
      onRerouteNeededRef.current();
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, routePolyline]);

  // ── Toggle Focus / Tracking ──
  const handleFocusRoute = useCallback(() => {
    if (!mapInstanceRef.current) return;

    if (!isFollowingDriver) {
      if (driverLocation) {
        mapInstanceRef.current.panTo({ lat: driverLocation.latitude, lng: driverLocation.longitude });
        mapInstanceRef.current.setZoom(17);
        setIsFollowingDriver(true);
      }
    } else {
      if (routeBoundsRef.current) {
        mapInstanceRef.current.fitBounds(routeBoundsRef.current, { top: 90, bottom: 130, left: 35, right: 35 });
      }
      setIsFollowingDriver(false);
    }
  }, [driverLocation, isFollowingDriver]);

  // ── Launch External Google Maps ──
  const handleOpenGoogleMaps = useCallback(() => {
    if (!destinationLocation) return;
    const originStr = driverLocation
      ? `${driverLocation.latitude},${driverLocation.longitude}`
      : '';
    const destStr = `${destinationLocation.latitude},${destinationLocation.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
    Linking.openURL(url).catch((err) => console.warn('Could not open Google Maps app:', err));
  }, [driverLocation, destinationLocation]);

  // Current active step
  const activeStep = steps && steps.length > 0 ? steps[0] : null;

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
      {/* Google Maps Container */}
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
            جارٍ تحميل الخريطة الرسمية...
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorIcon]}>🗺️</Text>
          <Text style={[styles.errorTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            تعذّر تحميل خرائط جوجل
          </Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            {error}
          </Text>
        </View>
      )}

      {/* ── 1. Top-Left Floating Map Controls Cluster ── */}
      {destinationLocation && !loading && !error && (
        <View style={styles.topLeftControlsCluster}>
          {/* A. Location / Route Mode Toggle (Triangle) */}
          <TouchableOpacity
            onPress={handleFocusRoute}
            activeOpacity={0.8}
            style={[
              styles.fabButton,
              {
                backgroundColor: isFollowingDriver ? colors.primary : colors.card,
                borderColor: isFollowingDriver ? colors.primary : colors.border,
              },
            ]}
            accessibilityLabel="تبديل وضع التتبع واللوكيشن"
          >
            <Navigation
              size={20}
              color={isFollowingDriver ? '#FFFFFF' : colors.text}
              strokeWidth={2.4}
            />
          </TouchableOpacity>

          {/* B. Order Details Side Panel Toggle Button */}
          {hasActiveTrip && onToggleTripCard && (
            <TouchableOpacity
              onPress={onToggleTripCard}
              activeOpacity={0.8}
              style={[
                styles.fabButton,
                {
                  backgroundColor: isTripCardOpen ? colors.primaryLight : colors.card,
                  borderColor: isTripCardOpen ? colors.primary : colors.border,
                },
              ]}
              accessibilityLabel="فتح أو إغلاق تفاصيل الطلب"
            >
              <DeliveryBoxIcon
                size={22}
                primaryColor={colors.primary}
                active={isTripCardOpen}
              />
              {/* Pulsing indicator badge */}
              <View style={[styles.orderActiveDot, { backgroundColor: colors.primary }]} />
            </TouchableOpacity>
          )}
        </View>
      )}


      {/* ── 3. Bottom Controls: External Google Maps Button ── */}
      {destinationLocation && !loading && !error && (
        <View style={styles.bottomActionsBar}>
          <TouchableOpacity
            onPress={handleOpenGoogleMaps}
            activeOpacity={0.85}
            style={[styles.externalNavBtn, { backgroundColor: colors.primary }]}
          >
            <ExternalLink size={15} color="#FFFFFF" />
            <Text style={[styles.externalNavText, { fontFamily: Fonts.bold }]}>
              بدء الملاحة (Google Maps)
            </Text>
          </TouchableOpacity>
        </View>
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

  // Top-Left Floating Map Controls Cluster
  topLeftControlsCluster: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 92,
  },
  fabButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orderActiveDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },


  // Bottom Actions
  bottomActionsBar: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  externalNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: Radius.full,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  externalNavText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});
