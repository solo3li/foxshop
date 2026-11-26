import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { DEFAULT_COORDINATES } from '../constants/config';

export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (data: {
    username: string;
    password: string;
    phone_number: string;
    first_name: string;
    last_name: string;
  }) => Promise<boolean>;
  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  api.onUnauthorized(() => {
    void get().logout();
  });

  return {
    user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    const res = await api.post('/api/v1/auth/login/', { username, password });

    if (res.error || !res.data) {
      set({ isLoading: false, error: res.error || 'فشل تسجيل الدخول' });
      return false;
    }

    const { access, refresh, user } = res.data;
    await storage.setItem('foxshop_access_token', access);
    await storage.setItem('foxshop_refresh_token', refresh);
    await storage.setItem('foxshop_user', JSON.stringify(user));

    // Automatically sync guest address to account if created while browsing
    try {
      const savedGuest = await storage.getItem('foxshop_guest_address');
      if (savedGuest) {
        const parsed = JSON.parse(savedGuest);
        await api.post('/api/v1/auth/addresses/', {
          title: parsed.title || 'موقعي الحالي',
          street: parsed.street || '',
          building_number: parsed.building_number || '',
          floor: parsed.floor || '',
          apartment_number: parsed.apartment_number || '',
          delivery_instructions: parsed.delivery_instructions || '',
          latitude: parsed.latitude || DEFAULT_COORDINATES.latitude,
          longitude: parsed.longitude || DEFAULT_COORDINATES.longitude,
          is_default: true,
        });
        await storage.removeItem('foxshop_guest_address');
      }
    } catch {}

    set({
      user,
      token: access,
      refreshToken: refresh,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    return true;
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null });
    const res = await api.post('/api/v1/auth/register/', {
      ...registerData,
      role: 'CUSTOMER',
    });

    if (res.error || !res.data) {
      set({ isLoading: false, error: res.error || 'فشل إنشاء الحساب' });
      return false;
    }

    const access = res.data.access || res.data.tokens?.access;
    const refresh = res.data.refresh || res.data.tokens?.refresh || '';
    const user = res.data.user;

    if (access) {
      await storage.setItem('foxshop_access_token', access);
      await storage.setItem('foxshop_refresh_token', refresh);
      await storage.setItem('foxshop_user', JSON.stringify(user));

      // Automatically sync guest address to newly registered account
      try {
        const savedGuest = await storage.getItem('foxshop_guest_address');
        if (savedGuest) {
          const parsed = JSON.parse(savedGuest);
          await api.post('/api/v1/auth/addresses/', {
            title: parsed.title || 'موقعي الحالي',
            street: parsed.street || '',
            building_number: parsed.building_number || '',
            floor: parsed.floor || '',
            apartment_number: parsed.apartment_number || '',
            delivery_instructions: parsed.delivery_instructions || '',
            latitude: parsed.latitude || DEFAULT_COORDINATES.latitude,
            longitude: parsed.longitude || DEFAULT_COORDINATES.longitude,
            is_default: true,
          });
          await storage.removeItem('foxshop_guest_address');
        }
      } catch {}

      set({
        user,
        token: access,
        refreshToken: refresh || null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({ isLoading: false, error: 'استجابة غير متوقعة من الخادم' });
    return false;
  },

  updateProfile: async (data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
  }) => {
    set({ isLoading: true, error: null });
    const res = await api.patch<User>('/api/v1/auth/profile/', data);
    if (res.data) {
      const updatedUser = res.data;
      await storage.setItem('foxshop_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, isLoading: false, error: null });
      return true;
    }
    set({ isLoading: false, error: res.error || 'فشل تحديث البيانات' });
    return false;
  },

  logout: async () => {
    await storage.removeItem('foxshop_access_token');
    await storage.removeItem('foxshop_refresh_token');
    await storage.removeItem('foxshop_user');

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('foxshop_access_token');
      const storedUser = await storage.getItem('foxshop_user');
      if (token && storedUser) {
        set({
          token,
          user: JSON.parse(storedUser),
          isAuthenticated: true,
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignored
    }
    set({ isHydrated: true });
  },
  };
});
