import { create } from 'zustand';
import { FoodItem } from '../types/models';

export interface SelectedModifier {
  id: string;
  name: string;
  price_delta: number;
}

export interface CartItem extends FoodItem {
  quantity: number;
  cartKey: string;
  basePrice?: number;
  selectedModifiers?: SelectedModifier[];
}

export function buildCartKey(itemId: string, modifiers?: SelectedModifier[]): string {
  if (!modifiers || modifiers.length === 0) return itemId;
  const sortedIds = [...modifiers].map((m) => m.id).sort().join(',');
  return `${itemId}::${sortedIds}`;
}

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  setRestaurant: (id: string, name?: string) => void;
  addItem: (
    item: FoodItem,
    restaurantId?: string,
    restaurantName?: string,
    selectedModifiers?: SelectedModifier[],
    quantity?: number
  ) => void;
  removeItem: (idOrCartKey: string) => void;
  deleteItem: (idOrCartKey: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,
  setRestaurant: (id, name) => set({ restaurantId: id, restaurantName: name || null }),
  addItem: (item, resId, resName, selectedModifiers, quantity = 1) => {
    const targetResId = resId || item.restaurantId || get().restaurantId;
    const effectiveModifiers =
      selectedModifiers !== undefined
        ? selectedModifiers
        : (item as CartItem).selectedModifiers;
    const cartKey = buildCartKey(item.id, effectiveModifiers);
    const basePrice =
      (item as CartItem).basePrice !== undefined
        ? Number((item as CartItem).basePrice)
        : Number(item.price) || 0;
    const modifiersDelta = (effectiveModifiers || []).reduce(
      (sum, m) => sum + (Number(m.price_delta) || 0),
      0
    );
    const unitPrice = Number((basePrice + modifiersDelta).toFixed(2));
    const addQty = Math.max(1, quantity);

    set((state) => {
      // If adding from a different restaurant, replace cart with the new restaurant's item
      const isDifferentRestaurant = Boolean(
        state.restaurantId && targetResId && state.restaurantId !== targetResId
      );
      const currentItems = isDifferentRestaurant ? [] : state.items;
      const targetResName =
        resName ||
        item.restaurantName ||
        (isDifferentRestaurant ? null : state.restaurantName);

      const existingItem = currentItems.find((i) => (i.cartKey || i.id) === cartKey);
      if (existingItem) {
        return {
          restaurantId: targetResId || state.restaurantId,
          restaurantName: targetResName,
          items: currentItems.map((i) =>
            (i.cartKey || i.id) === cartKey
              ? {
                  ...i,
                  quantity: i.quantity + addQty,
                  restaurantId: targetResId || i.restaurantId,
                  restaurantName: resName || item.restaurantName || i.restaurantName,
                }
              : i
          ),
        };
      }
      return {
        restaurantId: targetResId || state.restaurantId,
        restaurantName: targetResName,
        items: [
          ...currentItems,
          {
            ...item,
            cartKey,
            basePrice,
            price: unitPrice,
            selectedModifiers: effectiveModifiers && effectiveModifiers.length > 0 ? effectiveModifiers : undefined,
            quantity: addQty,
            restaurantId: targetResId || undefined,
            restaurantName: resName || item.restaurantName,
          },
        ],
      };
    });
  },
  removeItem: (idOrCartKey) => {
    set((state) => {
      const matchByKey = state.items.find((i) => i.cartKey === idOrCartKey);
      const existingItem = matchByKey || state.items.find((i) => i.id === idOrCartKey);
      if (!existingItem) return state;
      const targetKey = existingItem.cartKey || existingItem.id;

      if (existingItem.quantity > 1) {
        return {
          items: state.items.map((i) =>
            (i.cartKey || i.id) === targetKey ? { ...i, quantity: i.quantity - 1 } : i
          ),
        };
      }
      const remainingItems = state.items.filter((i) => (i.cartKey || i.id) !== targetKey);
      return {
        items: remainingItems,
        restaurantId: remainingItems.length === 0 ? null : state.restaurantId,
        restaurantName: remainingItems.length === 0 ? null : state.restaurantName,
      };
    });
  },
  deleteItem: (idOrCartKey) => {
    set((state) => {
      const hasExactKey = state.items.some((i) => i.cartKey === idOrCartKey);
      const remainingItems = state.items.filter((i) =>
        hasExactKey ? (i.cartKey || i.id) !== idOrCartKey : i.id !== idOrCartKey
      );
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
