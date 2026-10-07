import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

export interface SvgIconProps {
  size?: number;
  color?: string;
  hasUnread?: boolean;
}

/**
 * Unique Star Rating Filter SVG
 */
export const RatingFilterSvg: React.FC<SvgIconProps> = ({ size = 16, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      fill={color}
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Unique Lightning / Fast Delivery SVG
 */
export const FastDeliverySvg: React.FC<SvgIconProps> = ({ size = 16, color = '#0284C7' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      fill={color}
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Unique Free Delivery Scooter / Gift SVG
 */
export const FreeDeliverySvg: React.FC<SvgIconProps> = ({ size = 16, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="6" cy="18" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="18" r="3" stroke={color} strokeWidth="2" />
    <Path d="M6 18H11L14 10H18L20 14V18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M3 6H10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M5 9H9" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/**
 * Unique Open Now / Green Pulse Clock SVG
 */
export const OpenNowSvg: React.FC<SvgIconProps> = ({ size = 16, color = '#16A34A' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path d="M12 7V12L15 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Circle cx="18" cy="6" r="3" fill="#22C55E" />
  </Svg>
);

/**
 * Unique Notification Bell with dynamic unread badge dot
 */
export const NotificationBellSvg: React.FC<SvgIconProps> = ({ size = 22, color = '#FFFFFF', hasUnread = false }) => (
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
    {hasUnread && (
      <Circle cx="19" cy="5" r="3.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
    )}
  </Svg>
);

/**
 * Unique Edit Profile / Pencil Silhouette SVG
 */
export const EditProfileSvg: React.FC<SvgIconProps> = ({ size = 18, color = '#FF2E7E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89783 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Unique Restaurant Info Circle SVG
 */
export const InfoCircleSvg: React.FC<SvgIconProps> = ({ size = 20, color = '#1F2937' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Path d="M12 16V12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Circle cx="12" cy="8" r="1.2" fill={color} />
  </Svg>
);

/**
 * Unique Key / Lock Password SVG
 */
export const PasswordKeySvg: React.FC<SvgIconProps> = ({ size = 20, color = '#FF2E7E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="8" cy="15" r="5" stroke={color} strokeWidth="2" />
    <Path d="M11.5 11.5L20 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M16 7L18.5 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18 5L20.5 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);
