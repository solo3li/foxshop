import React from 'react';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';

// ─── 1. Google Maps SVG Marker Strings ────────────────────────────────────────

/**
 * Creative Animated Delivery Scooter SVG with dynamic heading angle
 */
export function getScooterMarkerSvg(primaryColor: string = '#FF2E7E', heading: number = 0): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <defs>
      <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.45"/>
        <stop offset="65%" stop-color="${primaryColor}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#FEF08A" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#FEF08A" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="scooterBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#374151"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF2E7E"/>
        <stop offset="100%" stop-color="#9F0744"/>
      </linearGradient>
    </defs>

    <!-- Radar Pulse Ring -->
    <circle cx="30" cy="30" r="15" fill="url(#radarPulse)">
      <animate attributeName="r" values="14;28;14" dur="2.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.2s" repeatCount="indefinite"/>
    </circle>

    <!-- Rotating Scooter Group -->
    <g transform="rotate(${heading}, 30, 30)">
      <!-- Headlight Beam (facing UP / 0 degrees) -->
      <polygon points="30,22 18,2 42,2" fill="url(#headlightBeam)" opacity="0.85"/>

      <!-- Scooter Shadow -->
      <ellipse cx="30" cy="32" rx="11" ry="17" fill="#000000" opacity="0.32"/>

      <!-- Wheels (Rear & Front) -->
      <rect x="27.5" y="42" width="5" height="10" rx="2.5" fill="#1F2937" stroke="#9CA3AF" stroke-width="0.8"/>
      <rect x="27.5" y="8" width="5" height="9" rx="2.5" fill="#1F2937" stroke="#9CA3AF" stroke-width="0.8"/>

      <!-- Scooter Main Chassis -->
      <path d="M26,16 L34,16 L36,36 L24,36 Z" fill="url(#scooterBody)" stroke="#4B5563" stroke-width="1"/>

      <!-- Handlebars -->
      <rect x="21" y="14" width="18" height="3" rx="1.5" fill="#E5E7EB"/>
      <circle cx="21" cy="15.5" r="2" fill="#111827"/>
      <circle cx="39" cy="15.5" r="2" fill="#111827"/>

      <!-- Fox Delivery Box (Rear) -->
      <rect x="23" y="27" width="14" height="13" rx="3.5" fill="url(#boxGrad)" stroke="#FFFFFF" stroke-width="1.2"/>
      <!-- Fox Box Tape Ribbon -->
      <line x1="30" y1="27" x2="30" y2="40" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>

      <!-- Driver Helmet (Center) -->
      <circle cx="30" cy="22" r="6" fill="#FFFFFF" stroke="${primaryColor}" stroke-width="2"/>
      <!-- Visor -->
      <path d="M26.5,19.5 Q30,17 33.5,19.5" fill="none" stroke="#1F2937" stroke-width="2.2" stroke-linecap="round"/>

      <!-- Forward Direction Marker -->
      <polygon points="30,5 26,10 34,10" fill="#FEF08A"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Creative Restaurant Pin SVG
 */
export function getRestaurantMarkerSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
    <defs>
      <radialGradient id="storeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#D97706"/>
      </linearGradient>
    </defs>
    <!-- Ground Pulse -->
    <ellipse cx="24" cy="54" rx="12" ry="4" fill="url(#storeGlow)"/>
    <!-- Pin Body -->
    <path d="M24,2 C12.95,2 4,10.95 4,22 C4,34 24,52 24,52 C24,52 44,34 44,22 C44,10.95 35.05,2 24,2 Z" fill="url(#pinGrad)" stroke="#FFFFFF" stroke-width="2.5"/>
    <!-- Inner White Circle -->
    <circle cx="24" cy="21" r="13" fill="#FFFFFF"/>
    <!-- Restaurant Fork & Knife / Chef Dome -->
    <path d="M20,15 L20,26 M18,15 L18,20 C18,21.5 22,21.5 22,20 L22,15 M27,15 C29,18 29,22 27,23 L27,26 M29,15 L27,26" fill="none" stroke="#D97706" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Creative Customer Home Pin SVG
 */
export function getCustomerMarkerSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
    <defs>
      <radialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#10B981" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="homeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10B981"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    <!-- Ground Pulse -->
    <ellipse cx="24" cy="54" rx="12" ry="4" fill="url(#homeGlow)"/>
    <!-- Pin Body -->
    <path d="M24,2 C12.95,2 4,10.95 4,22 C4,34 24,52 24,52 C24,52 44,34 44,22 C44,10.95 35.05,2 24,2 Z" fill="url(#homeGrad)" stroke="#FFFFFF" stroke-width="2.5"/>
    <!-- Inner White Circle -->
    <circle cx="24" cy="21" r="13" fill="#FFFFFF"/>
    <!-- Home Roof & Door -->
    <path d="M17,21 L24,15 L31,21 V27 C31,27.5 30.5,28 30,28 H18 C17.5,28 17,27.5 17,27 Z" fill="#059669"/>
    <rect x="22" y="23" width="4" height="5" fill="#FFFFFF" rx="0.8"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ─── 2. Bespoke React Native SVG Components ─────────────────────────────────

interface SvgIconProps {
  size?: number;
  color?: string;
}

/**
 * Unique Direct Phone Call SVG
 */
export const PhoneCallSvg: React.FC<SvgIconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 4H9L11 8.5L8.5 10.5C9.6 13 11.5 14.9 14 16L16 13.5L20.5 15.5V19.5C20.5 20.6 19.6 21.5 18.5 21.5C10.5 21.5 3.5 14.5 3.5 6.5C3.5 5.4 4.4 4 5 4Z"
      fill={color}
    />
    {/* Sound waves arcs */}
    <Path
      d="M16 4C17.8 5.2 19 7.2 19 9.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M19 2C21.5 3.8 23 6.7 23 10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Unique WhatsApp Chat Bubble SVG
 */
export const WhatsAppSvg: React.FC<SvgIconProps> = ({ size = 20, color = '#25D366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Chat bubble with tail */}
    <Path
      d="M12 2C6.5 2 2 6.5 2 12C2 13.8 2.5 15.5 3.4 17L2 22L7.2 20.6C8.6 21.5 10.3 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2Z"
      fill={color}
    />
    {/* Phone inside bubble */}
    <Path
      d="M8.5 7.5C8.3 7 8 7 7.7 7C7.5 7 7.2 7 7 7.2C6.7 7.5 6 8.1 6 9.4C6 10.7 7 12 7.1 12.2C7.3 12.4 9 15.2 11.7 16.3C14 17.2 14.5 17 15 16.9C15.6 16.8 16.8 16.1 17 15.4C17.3 14.7 17.3 14.1 17.2 14C17.1 13.9 16.9 13.8 16.5 13.6C16.1 13.4 14.3 12.5 14 12.4C13.7 12.3 13.5 12.2 13.3 12.5C13 12.9 12.4 13.6 12.2 13.8C12 14 11.8 14.1 11.5 13.9C11.1 13.7 10.1 13.4 8.9 12.3C8 11.5 7.4 10.5 7.2 10.2C7 9.9 7.2 9.7 7.4 9.5C7.6 9.3 7.8 9.1 8 8.9C8.2 8.7 8.2 8.5 8.4 8.3C8.5 8.1 8.4 7.9 8.3 7.7C8.2 7.6 8.6 8 8.5 7.5Z"
      fill="#FFFFFF"
    />
  </Svg>
);

/**
 * Unique Security Shield with OTP Keyhole SVG
 */
export const ShieldOtpSvg: React.FC<SvgIconProps> = ({ size = 22, color = '#FF2E7E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      <LinearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor={color} />
        <Stop offset="100%" stopColor="#9F0744" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2L4 5.5V11.5C4 16.5 7.4 21.2 12 22.5C16.6 21.2 20 16.5 20 11.5V5.5L12 2Z"
      fill="url(#shieldGrad)"
    />
    <Circle cx="12" cy="10" r="2.5" fill="#FFFFFF" />
    <Path d="M11 12.5H13L13.5 16H10.5L11 12.5Z" fill="#FFFFFF" />
  </Svg>
);

/**
 * Stepper Phase 1: Order Confirmed SVG
 */
export const StepOrderPlacedSvg: React.FC<SvgIconProps> = ({ size = 24, color = '#FF2E7E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="4" y="3" width="16" height="18" rx="3" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="2" />
    <Path d="M9 3V6H15V3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M8 12L11 15L16 10" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Stepper Phase 2: Kitchen Cooking Pan SVG
 */
export const StepCookingSvg: React.FC<SvgIconProps> = ({ size = 24, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Steam waves */}
    <Path d="M8 4C8 6 9 6 9 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 3C12 5 13 5 13 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M16 4C16 6 17 6 17 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Pan body */}
    <Path d="M4 11H20C20 15 17 18 12 18C7 18 4 15 4 11Z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" />
    {/* Handle */}
    <Path d="M20 13L23 15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M8 21H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/**
 * Stepper Phase 3: Fast Delivery Scooter SVG
 */
export const StepOnTheWaySvg: React.FC<SvgIconProps> = ({ size = 24, color = '#0284C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Speed lines */}
    <Path d="M2 8H6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M1 12H4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Wheels */}
    <Circle cx="8" cy="18" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="18" r="3" stroke={color} strokeWidth="2" />
    {/* Frame */}
    <Path d="M8 18H14L17 10H19" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Box */}
    <Rect x="8" y="10" width="5" height="5" rx="1" fill={color} />
  </Svg>
);

/**
 * Stepper Phase 4: Delivered Celebration Star SVG
 */
export const StepDeliveredSvg: React.FC<SvgIconProps> = ({ size = 24, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" />
    <Path d="M8 12L11 15L16 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Sleek Back Arrow SVG for RTL
 */
export const BackArrowSvg: React.FC<SvgIconProps> = ({ size = 22, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 18L15 12L9 6"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Unique Live Map / Radar Beacon SVG
 */
export const MapRadarSvg: React.FC<SvgIconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.6" strokeDasharray="3 2" />
    <Circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="12" r="2.5" fill={color} />
    <Path d="M12 2.5V5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M12 18.5V21.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M2.5 12H5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18.5 12H21.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M12 12L17.5 6.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/**
 * Unique Target Compass GPS Pin SVG
 */
export const TargetGpsSvg: React.FC<SvgIconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth="2" />
    <Circle cx="12" cy="12" r="2.5" fill={color} />
    <Path d="M12 1V4.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M12 19.5V23" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M1 12H4.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M19.5 12H23" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);
