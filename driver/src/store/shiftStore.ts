import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';

export type ShiftStatus = 'ONLINE' | 'BREAK' | 'OFFLINE';

interface ShiftState {
  isOnline: boolean;
  status: ShiftStatus;
  isUpdating: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastHeading: number;
  lastSpeed: number;
  setShiftStatus: (newStatus: ShiftStatus) => Promise<boolean>;
  toggleOnline: () => Promise<boolean>;
  updateLocation: (latitude: number, longitude: number, heading?: number, speed?: number) => Promise<void>;
  setLocationDirectly: (latitude: number, longitude: number, heading?: number) => void;
  syncStatus: () => Promise<void>;
}

const DEFAULT_LAT = 24.7136;
const DEFAULT_LON = 46.6753;

export const useShiftStore = create<ShiftState>((set, get) => ({
  isOnline: false,
  status: 'OFFLINE',
  isUpdating: false,
  lastLatitude: null,
  lastLongitude: null,
  lastHeading: 0,
  lastSpeed: 0,

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

  setLocationDirectly: (latitude: number, longitude: number, heading = 0) => {
    const lat = Number(latitude.toFixed(6));
    const lon = Number(longitude.toFixed(6));
    const hdg = Number(heading.toFixed(1));
    set({ lastLatitude: lat, lastLongitude: lon, lastHeading: hdg });
    storage.setItem('driver_last_latitude', String(lat));
    storage.setItem('driver_last_longitude', String(lon));
  },

  updateLocation: async (latitude: number, longitude: number, heading = 0, speed = 0) => {
    const lat = Number(latitude.toFixed(6));
    const lon = Number(longitude.toFixed(6));
    const hdg = Number(heading.toFixed(1));
    const spd = Number(speed.toFixed(1));
    set({ lastLatitude: lat, lastLongitude: lon, lastHeading: hdg, lastSpeed: spd });
    storage.setItem('driver_last_latitude', String(lat));
    storage.setItem('driver_last_longitude', String(lon));
    try {
      await api.post('/api/v1/driver/gps/', { latitude: lat, longitude: lon, heading: hdg, speed: spd });
    } catch (e) {
      // Background GPS update error ignored
    }
  },

  syncStatus: async () => {
    try {
      const res = await api.get('/api/v1/driver/analytics/');
      if (res.data) {
        const isOnline = !!res.data.is_online;
        const curLat = res.data.current_latitude != null ? Number(res.data.current_latitude) : null;
        const curLon = res.data.current_longitude != null ? Number(res.data.current_longitude) : null;

        let finalLat = curLat ?? get().lastLatitude;
        let finalLon = curLon ?? get().lastLongitude;

        if (finalLat === null || finalLon === null) {
          const cachedLat = await storage.getItem('driver_last_latitude');
          const cachedLon = await storage.getItem('driver_last_longitude');
          if (cachedLat && cachedLon) {
            finalLat = Number(cachedLat);
            finalLon = Number(cachedLon);
          } else {
            finalLat = DEFAULT_LAT;
            finalLon = DEFAULT_LON;
          }
        }

        set({
          isOnline,
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          lastLatitude: finalLat,
          lastLongitude: finalLon,
        });
      }
    } catch (e) {
      console.warn('Sync status error:', e);
    }
  },
}));
