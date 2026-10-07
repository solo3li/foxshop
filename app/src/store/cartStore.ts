import { create } from 'zustand';
import { FoodItem } from '../types/models';

export interface CartItem extends FoodItem {
  quantity: number;
}

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  setRestaurant: (id: string, name?: string) => void;
  addItem: (item: FoodItem, restaurantId?: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,
  setRestaurant: (id, name) => set({ restaurantId: id, restaurantName: name || null }),
  addItem: (item, resId) => {
    const targetResId = resId || item.restaurantId || get().restaurantId;
    set((state) => {
      // If adding from a different restaurant, replace cart with the new restaurant's item
      const isDifferentRestaurant = state.restaurantId && targetResId && state.restaurantId !== targetResId;
      const currentItems = isDifferentRestaurant ? [] : state.items;

      const existingItem = currentItems.find((i) => i.id === item.id);
      if (existingItem) {
        return {
          restaurantId: targetResId || state.restaurantId,
          items: currentItems.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1, restaurantId: targetResId || i.restaurantId } : i
          ),
        };
      }
      return {
        restaurantId: targetResId || state.restaurantId,
        items: [...currentItems, { ...item, quantity: 1, restaurantId: targetResId || undefined }],
      };
    });
  },
  removeItem: (id) => {
    set((state) => {
      const existingItem = state.items.find((i) => i.id === id);
      if (existingItem && existingItem.quantity > 1) {
        return {
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity: i.quantity - 1 } : i
          ),
        };
      }
      const remainingItems = state.items.filter((i) => i.id !== id);
      return {
        items: remainingItems,
        restaurantId: remainingItems.length === 0 ? null : state.restaurantId,
        restaurantName: remainingItems.length === 0 ? null : state.restaurantName,
      };
    });
  },
  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),
  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
  },
}));
