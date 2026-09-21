import { create } from 'zustand';
import { storage } from '../services/storage';
import { Colors, ThemeMode, ColorPalette } from '../constants/theme';

interface ThemeState {
  mode: ThemeMode;
  colors: ColorPalette;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  colors: Colors.light,

  toggleTheme: async () => {
    const nextMode = get().mode === 'light' ? 'dark' : 'light';
    await get().setTheme(nextMode);
  },

  setTheme: async (mode: ThemeMode) => {
    await storage.setItem('foxshop_driver_theme', mode);
    set({
      mode,
      colors: Colors[mode],
    });
  },

  loadTheme: async () => {
    try {
      const savedMode = await storage.getItem('foxshop_driver_theme');
      if (savedMode === 'light' || savedMode === 'dark') {
        set({
          mode: savedMode,
          colors: Colors[savedMode],
        });
      }
    } catch {
      // default light
    }
  },
}));
