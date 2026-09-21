import { create } from 'zustand';
import { api } from '../api/client';
import type { MenuItem, MenuCategory } from '../types';

interface MenuState {
  categories: MenuCategory[];
  items: MenuItem[];
  selectedCategoryId: string | null;
  isLoading: boolean;
  error: string | null;

  setSelectedCategoryId: (id: string | null) => void;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string, order?: number) => Promise<boolean>;
  updateCategory: (id: string, name: string) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;

  fetchMenuItems: () => Promise<void>;
  createMenuItem: (data: Partial<MenuItem>) => Promise<boolean>;
  updateMenuItem: (id: string, data: Partial<MenuItem>) => Promise<boolean>;
  deleteMenuItem: (id: string) => Promise<boolean>;
  toggleAvailability: (itemId: string) => Promise<boolean>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  items: [],
  selectedCategoryId: null,
  isLoading: false,
  error: null,

  setSelectedCategoryId: (id) => {
    set({ selectedCategoryId: id });
  },

  fetchCategories: async () => {
    const res = await api.getCategories();
    if (res.data) {
      set({ categories: res.data });
    }
  },

  createCategory: async (name, order = 0) => {
    const res = await api.createCategory({ name, order });
    if (res.data) {
      set({ categories: [...get().categories, res.data] });
      return true;
    }
    return false;
  },

  updateCategory: async (id, name) => {
    const res = await api.updateCategory(id, { name });
    if (res.data) {
      set({
        categories: get().categories.map(c => c.id === id ? res.data! : c)
      });
      return true;
    }
    return false;
  },

  deleteCategory: async (id) => {
    const res = await api.deleteCategory(id);
    if (!res.error) {
      set({
        categories: get().categories.filter(c => c.id !== id),
        selectedCategoryId: get().selectedCategoryId === id ? null : get().selectedCategoryId
      });
      // Also refresh items as items belonging to this category might be affected
      await get().fetchMenuItems();
      return true;
    }
    return false;
  },

  fetchMenuItems: async () => {
    set({ isLoading: true });
    const res = await api.getMenuItems();
    if (res.data) {
      set({ items: res.data, isLoading: false });
    } else {
      set({ error: res.error, isLoading: false });
    }
  },

  createMenuItem: async (data) => {
    const res = await api.createMenuItem(data);
    if (res.data) {
      set({ items: [res.data, ...get().items] });
      await get().fetchCategories(); // update items_count
      return true;
    }
    return false;
  },

  updateMenuItem: async (id, data) => {
    const res = await api.updateMenuItem(id, data);
    if (res.data) {
      set({
        items: get().items.map(item => item.id === id ? res.data! : item)
      });
      return true;
    }
    return false;
  },

  deleteMenuItem: async (id) => {
    const res = await api.deleteMenuItem(id);
    if (!res.error) {
      set({
        items: get().items.filter(item => item.id !== id)
      });
      await get().fetchCategories(); // update items_count
      return true;
    }
    return false;
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
