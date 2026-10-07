import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

export interface DriverIconProps {
  size?: number;
  color?: any;
  focused?: boolean;
  hasUnread?: boolean;
}

/**
 * Unique Radar / Live Compass Navigation SVG
 */
export const CompassRadarSvg: React.FC<DriverIconProps> = ({ size = 24, color = '#FF2E7E', focused = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={focused ? 2.4 : 1.8} />
    <Circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth={focused ? 2 : 1.5} />
    <Path
      d="M12 2V6M12 18V22M2 12H6M18 12H22"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
    />
    <Path
      d="M12 12L16 8"
      stroke={focused ? '#FF2E7E' : color}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
  </Svg>
);

/**
 * Unique Trips / Delivery Orders Clipboard SVG
 */
export const TripsClipboardSvg: React.FC<DriverIconProps> = ({ size = 24, color = '#FF2E7E', focused = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M16 4H19C19.5304 4 20.0391 4.21071 20.4142 4.58579C20.7893 4.96086 21 5.46957 21 6V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4H8"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Rect
      x="8"
      y="2"
      width="8"
      height="4"
      rx="1"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      fill={focused ? color : 'none'}
    />
    <Path
      d="M8 12H16M8 16H13"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Unique Driver Wallet & Cash SVG
 */
export const DriverWalletSvg: React.FC<DriverIconProps> = ({ size = 24, color = '#FF2E7E', focused = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 7V4C19 3.44772 18.5523 3 18 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C19.5523 21 20 20.5523 20 20V17"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      strokeLinecap="round"
    />
    <Path
      d="M16 8H21C21.5523 8 22 8.44772 22 9V15C22 15.5523 21.5523 16 21 16H16C15.4477 16 15 15.5523 15 15V9C15 8.44772 15.4477 8 16 8Z"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      fill={focused ? color : 'none'}
    />
    <Circle cx="18.5" cy="12" r="1.5" fill={focused ? '#FFFFFF' : color} />
  </Svg>
);

/**
 * Unique Driver Settings & Profile Gear SVG
 */
export const DriverSettingsSvg: React.FC<DriverIconProps> = ({ size = 24, color = '#FF2E7E', focused = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={focused ? 2.2 : 1.8} />
    <Path
      d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L20.55 17.64A2 2 0 0 1 17.64 20.55L16.82 19.73A1.65 1.65 0 0 0 15 19.4A1.65 1.65 0 0 0 13.9 20.85L13.7 22A2 2 0 0 1 10.3 22L10.1 20.85A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.18 19.73L6.36 20.55A2 2 0 0 1 3.45 17.64L4.27 16.82A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.15 13.9L2 13.7A2 2 0 0 1 2 10.3L3.15 10.1A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L3.45 6.36A2 2 0 0 1 6.36 3.45L7.18 4.27A1.65 1.65 0 0 0 9 4.6A1.65 1.65 0 0 0 10.1 3.15L10.3 2A2 2 0 0 1 13.7 2L13.9 3.15A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L17.64 3.45A2 2 0 0 1 20.55 6.36L19.73 7.18A1.65 1.65 0 0 0 19.4 9A1.65 1.65 0 0 0 20.85 10.1L22 10.3A2 2 0 0 1 22 13.7L20.85 13.9A1.65 1.65 0 0 0 19.4 15Z"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Emergency SOS Shield SVG
 */
export const DriverSosSvg: React.FC<DriverIconProps> = ({ size = 24, color = '#EF4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z"
      fill={color}
      stroke="#FFFFFF"
      strokeWidth="1.5"
    />
    <Path d="M12 8V13M12 17H12.01" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

/**
 * Driver Notification Bell SVG with unread dot
 */
export const DriverBellSvg: React.FC<DriverIconProps> = ({ size = 22, color = '#FFFFFF', hasUnread = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M13.73 21C13.55 21.3 13.3 21.56 13 21.73C12.7 21.9 12.35 22 12 22C11.64 22 11.3 21.9 11 21.73C10.7 21.56 10.45 21.3 10.27 21"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {hasUnread && <Circle cx="19" cy="5" r="3.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />}
  </Svg>
);
