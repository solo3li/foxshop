import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';

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
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
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

    const { tokens, user } = res.data;
    if (tokens?.access) {
      await storage.setItem('foxshop_access_token', tokens.access);
      await storage.setItem('foxshop_refresh_token', tokens.refresh || '');
      await storage.setItem('foxshop_user', JSON.stringify(user));

      set({
        user,
        token: tokens.access,
        refreshToken: tokens.refresh || null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    }

    set({ isLoading: false });
    return true;
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
        });
      }
    } catch {
      // Ignored
    }
  },
}));
