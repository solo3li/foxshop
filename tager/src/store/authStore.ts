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
  updateStoreStatus: (status: 'OPEN' | 'BUSY' | 'CLOSED') => Promise<boolean>;
  updateRestaurantInfo: (updated: Partial<Restaurant>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
      get().logout();
    });
    window.addEventListener('auth:token-refreshed', (event: Event) => {
      const nextToken = (event as CustomEvent<string>).detail || api.getToken();
      if (nextToken) {
        set({ token: nextToken });
      }
    });
  }

  return {
    token: typeof window !== 'undefined' ? localStorage.getItem('tager_token') : null,
    user: null,
    restaurant: null,
    isAuthenticated: false,
    isLoading: typeof window !== 'undefined' && !!localStorage.getItem('tager_token'),
    error: null,

    login: async (credentials) => {
      set({ isLoading: true, error: null });
      const res = await api.login(credentials);

      if (res.data?.access) {
        const user = res.data.user;
        if (user && user.role !== 'MERCHANT' && user.role !== 'ADMIN') {
          api.setToken(null);
          set({
            error: 'عذراً، هذا الحساب ليس حساب تاجر مصرح له بدخول لوحة المتجر',
            isLoading: false,
            isAuthenticated: false,
            token: null,
            user: null,
          });
          return false;
        }

        api.setToken(res.data.access);
        set({
          token: res.data.access,
          user: user || null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('tager_token') : null;
      if (!token) {
        set({ isAuthenticated: false, isLoading: false, token: null });
        return;
      }

      api.setToken(token);
      set({ isLoading: true, token });

      // Verify token with backend
      const profileRes = await api.getProfile();
      if (!profileRes.data || profileRes.status === 401) {
        get().logout();
        set({ isLoading: false });
        return;
      }

      const user = profileRes.data;
      if (user.role !== 'MERCHANT' && user.role !== 'ADMIN') {
        get().logout();
        set({ error: 'عذراً، هذا الحساب ليس حساب تاجر مصرح له', isLoading: false });
        return;
      }

      set({
        token: api.getToken(),
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      await get().fetchRestaurant();
    },

    fetchRestaurant: async () => {
      const res = await api.getMyRestaurants();
      if (res.status === 401) {
        get().logout();
        return;
      }
      if (res.data && res.data.length > 0) {
        const rest = res.data[0];
        const status: 'OPEN' | 'BUSY' | 'CLOSED' = 
          rest.is_active === false ? 'CLOSED' : (rest.is_busy ? 'BUSY' : 'OPEN');
        set({ restaurant: { ...rest, status } });
      }
    },

  toggleStoreBusy: async () => {
    const current = get().restaurant;
    if (!current) return;

    const newStatus = current.is_busy ? 'OPEN' : 'BUSY';
    await get().updateStoreStatus(newStatus);
  },

  updateStoreStatus: async (newStatus: 'OPEN' | 'BUSY' | 'CLOSED') => {
    const current = get().restaurant;
    if (!current) return false;

    // Optimistic update
    set({
      restaurant: {
        ...current,
        status: newStatus,
        is_busy: newStatus === 'BUSY',
        is_active: newStatus !== 'CLOSED',
      }
    });

    const res = await api.updateStoreStatus(current.id, newStatus);
    if (res.data) {
      set({
        restaurant: {
          ...current,
          status: res.data.status,
          is_busy: res.data.is_busy,
          is_active: res.data.is_active,
        }
      });
      return true;
    } else {
      // Revert if error
      await get().fetchRestaurant();
      return false;
    }
  },

  updateRestaurantInfo: (updated: Partial<Restaurant>) => {
    const current = get().restaurant;
    if (current) {
      set({ restaurant: { ...current, ...updated } });
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
  };
});
