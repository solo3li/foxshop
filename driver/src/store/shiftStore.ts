import { create } from 'zustand';
import { api } from '../services/api';

export type ShiftStatus = 'ONLINE' | 'BREAK' | 'OFFLINE';

interface ShiftState {
  isOnline: boolean;
  status: ShiftStatus;
  isUpdating: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
  setShiftStatus: (newStatus: ShiftStatus) => Promise<boolean>;
  toggleOnline: () => Promise<boolean>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  syncStatus: () => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  isOnline: false,
  status: 'OFFLINE',
  isUpdating: false,
  lastLatitude: null,
  lastLongitude: null,

  setShiftStatus: async (newStatus: ShiftStatus) => {
    set({ isUpdating: true });
    try {
      const res = await api.post('/api/v1/driver/shift/', { status: newStatus });
      if (res.data) {
        set({
          isOnline: res.data.is_online,
          status: res.data.status as ShiftStatus,
          isUpdating: false,
        });
        return true;
      }
    } catch (e) {
      console.warn('Shift status update error:', e);
    }
    set({ isUpdating: false });
    return false;
  },

  toggleOnline: async () => {
    const nextStatus: ShiftStatus = get().isOnline ? 'OFFLINE' : 'ONLINE';
    return get().setShiftStatus(nextStatus);
  },

  updateLocation: async (latitude: number, longitude: number) => {
    set({ lastLatitude: latitude, lastLongitude: longitude });
    try {
      await api.post('/api/v1/driver/gps/', { latitude, longitude });
    } catch (e) {
      // Background GPS update error ignored
    }
  },

  syncStatus: async () => {
    const res = await api.get('/api/v1/driver/analytics/');
    if (res.data) {
      const isOnline = !!res.data.is_online;
      set({
        isOnline,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
      });
    }
  },
}));
