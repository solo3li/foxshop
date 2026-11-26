/**
 * FoxShop Brand UI Theme Hook
 * Enforces the official clean Light Mode (#FFFFFF Canvas with Ruby Pink #D70F64).
 */

import { Colors } from '@/constants/theme';

export function useTheme() {
  // FoxShop official design standard is Light Mode
  const isDark = false;
  const theme = 'light' as const;

  return {
    ...Colors[theme],
    isDark,
    theme,
  };
}

