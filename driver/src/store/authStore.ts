import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';

export interface DriverUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
  role: string;
  avatar?: string | null;
}

export interface DriverProfileData {
  vehicle_type?: string;
  license_plate?: string;
  rating?: number;
  total_delivered_orders?: number;
  cash_in_hand?: string | number;
  is_online?: boolean;
}

interface RegisterDriverPayload {
  username: string;
  password: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  vehicle_type: 'MOTORCYCLE' | 'CAR' | 'BICYCLE';
  license_plate?: string;
}

interface AuthState {
  user: DriverUser | null;
  driverProfile: DriverProfileData | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isPendingApproval: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (payload: RegisterDriverPayload) => Promise<{ success: boolean; isPending?: boolean }>;
  checkApprovalStatus: () => Promise<boolean>;
  setApproved: () => void;
  updateProfile: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  driverProfile: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isPendingApproval: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setApproved: () => {
    set({ isPendingApproval: false, isAuthenticated: true });
  },

  updateProfile: async (formData: FormData) => {
    set({ isLoading: true, error: null });
    const res = await api.patch('/api/v1/auth/profile/', formData);
    if (res.error || !res.data) {
      const err = res.error || 'فشل تحديث الملف الشخصي';
      set({ isLoading: false, error: err });
      return { success: false, error: err };
    }

    const updatedUser = res.data;
    await storage.setItem('foxshop_driver_user', JSON.stringify(updatedUser));
    set({
      user: updatedUser,
      isLoading: false,
      error: null,
    });
    return { success: true };
  },

  checkApprovalStatus: async () => {
    const user = get().user;
    if (!user?.id) return false;
    const res = await api.get(`/api/v1/auth/driver/check-status/?user_id=${user.id}`);
    if (res.data?.is_active) {
      set({ isPendingApproval: false, isAuthenticated: true });
      return true;
    }
    return false;
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    const res = await api.post('/api/v1/auth/login/', { username, password });

    if (res.error || !res.data) {
      set({ isLoading: false, error: res.error || 'فشل تسجيل الدخول' });
      return false;
    }

    const { access, refresh, user } = res.data;

    if (user.role !== 'DRIVER') {
      set({ isLoading: false, error: 'هذا الحساب غير مصرح له باستخدام تطبيق السائقين' });
      return false;
    }

    await storage.setItem('foxshop_driver_access_token', access);
    await storage.setItem('foxshop_driver_refresh_token', refresh);
    await storage.setItem('foxshop_driver_user', JSON.stringify(user));

    set({
      user,
      token: access,
      refreshToken: refresh,
      isAuthenticated: true,
      isPendingApproval: false,
      isLoading: false,
      error: null,
    });

    // Fetch full driver profile
    get().fetchProfile();
    return true;
  },

  register: async (payload: RegisterDriverPayload) => {
    set({ isLoading: true, error: null });
    const res = await api.post('/api/v1/auth/driver/register/', payload);

    if (res.error || !res.data) {
      set({ isLoading: false, error: res.error || 'فشل إنشاء حساب السائق' });
      return { success: false };
    }

    const user = res.data.user;
    if (user) {
      await storage.setItem('foxshop_driver_user', JSON.stringify(user));
    }

    set({
      user: user || null,
      isLoading: false,
      isPendingApproval: true,
      error: null,
    });

    return { success: true, isPending: true };
  },

  fetchProfile: async () => {
    const res = await api.get('/api/v1/driver/profile/');
    if (res.data) {
      set({ driverProfile: res.data });
    }
  },

  logout: async () => {
    await storage.removeItem('foxshop_driver_access_token');
    await storage.removeItem('foxshop_driver_refresh_token');
    await storage.removeItem('foxshop_driver_user');

    set({
      user: null,
      driverProfile: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isPendingApproval: false,
      error: null,
    });
  },

  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('foxshop_driver_access_token');
      const storedUser = await storage.getItem('foxshop_driver_user');

      if (token && storedUser) {
        const user = JSON.parse(storedUser);
        set({
          token,
          user,
          isAuthenticated: true,
        });
        get().fetchProfile();
      }
    } catch {
      // Ignored
    }
  },
}));
