import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

export interface NavIconProps {
  size?: number;
  color?: any;
  focused?: boolean;
}

/**
 * Unique Bespoke Food/Home SVG Icon for Fox Shop
 */
export const HomeFoodSvg: React.FC<NavIconProps> = ({ size = 24, color = '#9CA3AF', focused = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Dish Dome / Cloche */}
      <Path
        d="M3 17H21C20.5 12 16.5 8 12 8C7.5 8 3.5 12 3 17Z"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.16 : 0}
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Cloche Top Handle */}
      <Path
        d="M12 5V8"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.9}
        strokeLinecap="round"
      />
      <Circle
        cx="12"
        cy="4.5"
        r="1.8"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
      />
      {/* Platter Base Line */}
      <Path
        d="M2 19.5H22"
        stroke={color}
        strokeWidth={focused ? 2.4 : 1.9}
        strokeLinecap="round"
      />
      {/* Subtle Gourmet Accent Dots */}
      {focused && (
        <>
          <Circle cx="8" cy="13.5" r="1.2" fill={color} />
          <Circle cx="12" cy="12" r="1.2" fill={color} />
          <Circle cx="16" cy="13.5" r="1.2" fill={color} />
        </>
      )}
    </Svg>
  );
};

/**
 * Unique Bespoke Shopping Cart / Bag SVG Icon for Fox Shop
 */
export const CartShoppingSvg: React.FC<NavIconProps> = ({ size = 24, color = '#9CA3AF', focused = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cart Basket Base */}
      <Path
        d="M2 3H4.5L7.2 15.5C7.3 16.2 7.9 16.7 8.6 16.7H18.4C19.1 16.7 19.7 16.2 19.8 15.5L21.5 7H5.5"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.16 : 0}
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wheels */}
      <Circle
        cx="9"
        cy="20"
        r="1.8"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
      />
      <Circle
        cx="18"
        cy="20"
        r="1.8"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
      />
      {/* Item badge dot inside when focused */}
      {focused && (
        <Circle cx="14" cy="11" r="2" fill={color} />
      )}
    </Svg>
  );
};

/**
 * Unique Bespoke User Profile / Account SVG Icon for Fox Shop
 */
export const AccountUserSvg: React.FC<NavIconProps> = ({ size = 24, color = '#9CA3AF', focused = false }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle
        cx="12"
        cy="7.5"
        r="4.2"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.9}
      />
      {/* Torso / Shoulders Curved Shield */}
      <Path
        d="M4.5 20.5C4.5 16.6 7.9 14.5 12 14.5C16.1 14.5 19.5 16.6 19.5 20.5"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.16 : 0}
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.9}
        strokeLinecap="round"
      />
      {/* Bottom Base Line */}
      <Path
        d="M8 20.5H16"
        stroke={color}
        strokeWidth={focused ? 2.4 : 1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
};

/**
 * Unique RTL Back Arrow SVG Icon
 */
export const SearchBackSvg: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#111827' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
