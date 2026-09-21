import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#D70F64', // FoxShop Brand Pink
    primaryLight: '#FCE7F3',
    primaryDark: '#B00C52',
    secondary: '#FF6B00', // Flame Orange
    secondaryLight: '#FFF4ED',
    success: '#10B981', // Emerald Green (Online)
    successLight: '#ECFDF5',
    warning: '#F59E0B', // Amber (Break)
    warningLight: '#FEF3C7',
    danger: '#EF4444', // Red (Offline/Reject)
    dangerLight: '#FEE2E2',
    background: '#F8FAFC',
    card: '#FFFFFF',
    surface: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0, 0, 0, 0.45)',
    shadow: '#0F172A',
  },
  dark: {
    primary: '#D70F64',
    primaryLight: '#831843',
    primaryDark: '#9F0D4B',
    secondary: '#FF6B00',
    secondaryLight: '#431407',
    success: '#10B981',
    successLight: '#064E3B',
    warning: '#F59E0B',
    warningLight: '#78350F',
    danger: '#EF4444',
    dangerLight: '#7F1D1D',
    background: '#0B1120',
    card: '#1E293B',
    surface: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    borderLight: '#1E293B',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: '#000000',
  },
} as const;

export type ThemeMode = 'light' | 'dark';
export type ColorPalette = { [K in keyof typeof Colors.light]: string };

export const Fonts = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  extraBold: 'Tajawal_800ExtraBold',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};
