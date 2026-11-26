/**
 * Below are the colors that are used in FoxShop app.
 * Follows Zero-Border Fluid Architecture and Unified Ruby Pink (#D70F64) Identity.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111827',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceSecondary: '#F3F4F6',
    card: '#FFFFFF',
    backgroundElement: '#F3F4F6',
    backgroundSelected: '#E5E7EB',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    primary: '#D70F64', // Ruby Pink
    primaryLight: '#FCE7F3', // Light ruby pink for backgrounds/pills
    primaryDark: '#BE123C',
    border: 'transparent', // Zero-border architecture
    borderSubtle: '#F3F4F6',
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    error: '#EF4444',
    errorLight: '#FEF2F2',
  },
  dark: {
    text: '#F9FAFB',
    background: '#0B0F19',
    surface: '#151D2F',
    surfaceSecondary: '#1E293B',
    card: '#161F32',
    backgroundElement: '#1F2937',
    backgroundSelected: '#374151',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    primary: '#D70F64', // Ruby Pink
    primaryLight: '#831843', // Deep ruby pink for dark mode
    primaryDark: '#9F1239',
    border: 'transparent', // Zero-border architecture
    borderSubtle: '#243048',
    success: '#10B981',
    successLight: '#064E3B',
    warning: '#F59E0B',
    warningLight: '#78350F',
    error: '#EF4444',
    errorLight: '#7F1D1D',
  },
} as const;

export type ThemeColors = typeof Colors.light;
export type ThemeColor = keyof ThemeColors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Tajawal_500Medium',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
