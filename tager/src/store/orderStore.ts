import { create } from 'zustand';
import { api } from '../api/client';
import type { Order } from '../types';
import { soundNotifier } from '../utils/sound';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  isSoundEnabled: boolean;
  lastOrderCount: number;

  fetchLiveOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED') => Promise<boolean>;
  toggleSound: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  isSoundEnabled: true,
  lastOrderCount: 0,

  fetchLiveOrders: async () => {
    const res = await api.getLiveOrders();
    if (res.data) {
      const newOrders = res.data;
      const prevCount = get().lastOrderCount;

      // Check if there are new confirmed/pending orders
      const newIncomingCount = newOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'PENDING').length;
      if (newIncomingCount > prevCount && get().isSoundEnabled) {
        soundNotifier.playNewOrderAlert();
      }

      set({
        orders: newOrders,
        lastOrderCount: newIncomingCount,
        isLoading: false,
      });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    // Optimistic update
    const prevOrders = get().orders;
    set({
      orders: prevOrders.map(o => o.id === orderId ? { ...o, status } : o),
    });

    const res = await api.updateOrderStatus(orderId, status);
    if (res.data) {
      // Re-sync with server state
      set({
        orders: get().orders.map(o => o.id === orderId ? res.data! : o),
      });
      return true;
    } else {
      // Rollback on failure
      set({ orders: prevOrders });
      return false;
    }
  },

  toggleSound: () => {
    const next = !get().isSoundEnabled;
    soundNotifier.setMuted(!next);
    set({ isSoundEnabled: next });
  }
}));
