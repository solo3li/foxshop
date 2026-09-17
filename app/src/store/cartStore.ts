import { create } from 'zustand';
import { FoodItem } from '../constants/dummyData';

export interface CartItem extends FoodItem {
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: FoodItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item) => {
    set((state) => {
      const existingItem = state.items.find((i) => i.id === item.id);
      if (existingItem) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
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
      return {
        items: state.items.filter((i) => i.id !== id),
      };
    });
  },
  clearCart: () => set({ items: [] }),
  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
  },
}));
