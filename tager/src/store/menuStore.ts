import { create } from 'zustand';
import { api } from '../api/client';
import type { MenuItem } from '../types';

interface MenuState {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;

  fetchMenuItems: () => Promise<void>;
  toggleAvailability: (itemId: string) => Promise<boolean>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchMenuItems: async () => {
    set({ isLoading: true });
    const res = await api.getMenuItems();
    if (res.data) {
      set({ items: res.data, isLoading: false });
    } else {
      set({ error: res.error, isLoading: false });
    }
  },

  toggleAvailability: async (itemId) => {
    const prev = get().items;
    // Optimistic toggle
    set({
      items: prev.map(item => item.id === itemId ? { ...item, is_available: !item.is_available } : item),
    });

    const res = await api.toggleItemAvailability(itemId);
    if (res.data) {
      set({
        items: get().items.map(item => item.id === itemId ? { ...item, is_available: res.data!.is_available } : item),
      });
      return true;
    } else {
      set({ items: prev });
      return false;
    }
  }
}));
