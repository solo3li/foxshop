import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { DEFAULT_COORDINATES } from '../constants/config';
import { useAddressStore } from './addressStore';

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

function getInitialWebAuth(): {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
} {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const token = window.localStorage.getItem('foxshop_access_token');
      const refreshToken = window.localStorage.getItem('foxshop_refresh_token');
      const rawUser = window.localStorage.getItem('foxshop_user');
      if (token && token !== 'undefined' && token !== 'null') {
        const parsedUser =
          rawUser && rawUser !== 'undefined' && rawUser !== 'null'
            ? (JSON.parse(rawUser) as User)
            : null;
        return {
          user: parsedUser,
          token,
          refreshToken:
            refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null'
              ? refreshToken
              : null,
          isAuthenticated: true,
          isHydrated: true,
        };
      }
      return { user: null, token: null, refreshToken: null, isAuthenticated: false, isHydrated: true };
    } catch {
      // Fallback to async hydration
    }
  }
  return { user: null, token: null, refreshToken: null, isAuthenticated: false, isHydrated: false };
}

export const useAuthStore = create<AuthState>((set, get) => {
  api.onUnauthorized(() => {
    void get().logout();
  });

  const initial = getInitialWebAuth();

  return {
    user: initial.user,
    token: initial.token,
    refreshToken: initial.refreshToken,
    isAuthenticated: initial.isAuthenticated,
    isHydrated: initial.isHydrated,
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
    if (!access) {
      set({ isLoading: false, error: 'استجابة غير متوقعة من الخادم' });
      return false;
    }
    await storage.setItem('foxshop_access_token', access);
    if (refresh) {
      await storage.setItem('foxshop_refresh_token', refresh);
    }
    if (user) {
      await storage.setItem('foxshop_user', JSON.stringify(user));
    }

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
    await useAddressStore.getState().fetchAddresses();
  },

  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('foxshop_access_token');
      const refreshToken = await storage.getItem('foxshop_refresh_token');
      const storedUser = await storage.getItem('foxshop_user');
      if (token && token !== 'undefined' && token !== 'null') {
        let parsedUser: User | null = null;
        if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
          try {
            parsedUser = JSON.parse(storedUser);
          } catch {
            parsedUser = null;
          }
        }
        set({
          token,
          refreshToken:
            refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null'
              ? refreshToken
              : null,
          user: parsedUser,
          isAuthenticated: true,
          isHydrated: true,
        });
        if (!parsedUser) {
          const profileRes = await api.get<User>('/api/v1/auth/profile/');
          if (profileRes.data) {
            await storage.setItem('foxshop_user', JSON.stringify(profileRes.data));
            set({ user: profileRes.data });
          }
        }
        return;
      }
    } catch {
      // Ignored
    }
    set({ isHydrated: true });
  },
  };
});
