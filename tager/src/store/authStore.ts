import { create } from 'zustand';
import { api } from '../api/client';
import type { User, Restaurant } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  restaurant: Restaurant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: { username: string; password: string }) => Promise<boolean>;
  loadStoredAuth: () => Promise<void>;
  fetchRestaurant: () => Promise<void>;
  toggleStoreBusy: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('tager_token'),
  user: null,
  restaurant: null,
  isAuthenticated: !!localStorage.getItem('tager_token'),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    const res = await api.login(credentials);

    if (res.data?.access) {
      api.setToken(res.data.access);
      set({
        token: res.data.access,
        isAuthenticated: true,
        isLoading: false,
      });

      // Load restaurant
      await get().fetchRestaurant();
      return true;
    } else {
      set({
        error: res.error || 'فشل تسجيل الدخول، تأكد من بياناتك',
        isLoading: false,
      });
      return false;
    }
  },

  loadStoredAuth: async () => {
    const token = localStorage.getItem('tager_token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }
    api.setToken(token);
    set({ isAuthenticated: true });
    await get().fetchRestaurant();
  },

  fetchRestaurant: async () => {
    const res = await api.getMyRestaurants();
    if (res.data && res.data.length > 0) {
      set({ restaurant: res.data[0] });
    }
  },

  toggleStoreBusy: async () => {
    const current = get().restaurant;
    if (!current) return;

    const res = await api.toggleStoreBusy(current.id);
    if (res.data) {
      set({
        restaurant: {
          ...current,
          is_busy: res.data.is_busy,
        }
      });
    }
  },

  logout: () => {
    api.setToken(null);
    set({
      token: null,
      user: null,
      restaurant: null,
      isAuthenticated: false,
      error: null,
    });
  }
}));
