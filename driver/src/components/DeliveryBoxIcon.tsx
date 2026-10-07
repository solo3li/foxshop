import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface DeliveryBoxIconProps {
  size?: number;
  primaryColor?: string;
  active?: boolean;
}

/**
 * Custom Isometric 3D Delivery Box Icon (Crafted with Pure SVG)
 * Features:
 *  - 3D isometric faceted cube with depth gradients
 *  - FoxShop signature brand ribbon/tape
 *  - Dynamic active fill when side panel is opened
 */
export const DeliveryBoxIcon: React.FC<DeliveryBoxIconProps> = ({
  size = 22,
  primaryColor = '#FF2E7E',
  active = false,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        {/* Top Facet Gradient */}
        <LinearGradient id="boxTopGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={active ? primaryColor : '#E2E8F0'} stopOpacity="0.95" />
          <Stop offset="100%" stopColor={active ? '#FF659F' : '#CBD5E1'} stopOpacity="0.95" />
        </LinearGradient>

        {/* Left Facet Gradient */}
        <LinearGradient id="boxLeftGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={active ? '#C0094F' : '#94A3B8'} />
          <Stop offset="100%" stopColor={active ? '#7A0431' : '#64748B'} />
        </LinearGradient>

        {/* Right Facet Gradient */}
        <LinearGradient id="boxRightGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={active ? '#E01662' : '#64748B'} />
          <Stop offset="100%" stopColor={active ? '#9F0744' : '#475569'} />
        </LinearGradient>
      </Defs>

      {/* Top Face */}
      <Path
        d="M12 2.5L20.5 7L12 11.5L3.5 7L12 2.5Z"
        fill="url(#boxTopGrad)"
        stroke={active ? primaryColor : '#94A3B8'}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Left Face */}
      <Path
        d="M3.5 7.5L12 12V21L3.5 16.5V7.5Z"
        fill="url(#boxLeftGrad)"
        stroke={active ? '#7A0431' : '#475569'}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Right Face */}
      <Path
        d="M12 12L20.5 7.5V16.5L12 21V12Z"
        fill="url(#boxRightGrad)"
        stroke={active ? '#9F0744' : '#334155'}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Sealing Tape (Isometric Center Ribbon on top) */}
      <Path
        d="M10 3.7L14 5.8L14 10.3L10 8.2Z"
        fill={active ? '#FFFFFF' : primaryColor}
        fillOpacity="0.9"
      />

      {/* Sealing Tape front flap */}
      <Path
        d="M10.8 12.4L13.2 11.2V19.2L10.8 20.4V12.4Z"
        fill={active ? '#FFFFFF' : primaryColor}
        fillOpacity="0.45"
      />
    </Svg>
  );
};
