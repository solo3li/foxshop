import { create } from 'zustand';
import { Restaurant, FoodItem } from '../types/models';
import { storage } from '../services/storage';

interface FavoriteState {
  restaurants: Restaurant[];
  items: FoodItem[];
  isLoaded: boolean;
  loadFavorites: () => Promise<void>;
  toggleRestaurant: (restaurant: Restaurant) => Promise<boolean>;
  isRestaurantFavorite: (id: string) => boolean;
  toggleItem: (item: FoodItem) => Promise<boolean>;
  isItemFavorite: (id: string) => boolean;
  removeRestaurant: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const STORAGE_KEY_RESTAURANTS = 'foxshop_favorite_restaurants';
const STORAGE_KEY_ITEMS = 'foxshop_favorite_items';

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  restaurants: [],
  items: [],
  isLoaded: false,

  loadFavorites: async () => {
    try {
      const storedRes = await storage.getItem(STORAGE_KEY_RESTAURANTS);
      const storedItems = await storage.getItem(STORAGE_KEY_ITEMS);
      
      const restaurants = storedRes ? JSON.parse(storedRes) : [];
      const items = storedItems ? JSON.parse(storedItems) : [];

      set({
        restaurants: Array.isArray(restaurants) ? restaurants : [],
        items: Array.isArray(items) ? items : [],
        isLoaded: true,
      });
    } catch (e) {
      console.warn('Failed to load favorites:', e);
      set({ isLoaded: true });
    }
  },

  toggleRestaurant: async (restaurant: Restaurant) => {
    const current = get().restaurants;
    const exists = current.some((r) => r.id === restaurant.id);
    const updated = exists
      ? current.filter((r) => r.id !== restaurant.id)
      : [...current, restaurant];

    set({ restaurants: updated });
    await storage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(updated));
    return !exists;
  },

  isRestaurantFavorite: (id: string) => {
    return get().restaurants.some((r) => r.id === id);
  },

  removeRestaurant: async (id: string) => {
    const updated = get().restaurants.filter((r) => r.id !== id);
    set({ restaurants: updated });
    await storage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(updated));
  },

  toggleItem: async (item: FoodItem) => {
    const current = get().items;
    const exists = current.some((i) => i.id === item.id);
    const updated = exists
      ? current.filter((i) => i.id !== item.id)
      : [...current, item];

    set({ items: updated });
    await storage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updated));
    return !exists;
  },

  isItemFavorite: (id: string) => {
    return get().items.some((i) => i.id === id);
  },

  removeItem: async (id: string) => {
    const updated = get().items.filter((i) => i.id !== id);
    set({ items: updated });
    await storage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updated));
  },
}));
