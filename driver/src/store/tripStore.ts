import { create } from 'zustand';
import { api } from '../services/api';
import { useShiftStore } from './shiftStore';

export interface TripItem {
  id?: string;
  name: string;
  quantity: number;
  unit_price: string | number;
  total_price: string | number;
  notes?: string;
  modifiers?: Array<{ name: string; price: string | number }>;
}

export interface DeliveryTrip {
  id: string;
  order_id: string;
  order_number: string;
  status: 'OFFERED' | 'ACCEPTED' | 'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER' | 'COMPLETED' | 'CANCELLED';
  status_display: string;
  phase: 'TO_RESTAURANT' | 'AT_RESTAURANT' | 'TO_CUSTOMER' | 'AT_CUSTOMER' | 'COMPLETED';
  restaurant: {
    id: string;
    name: string;
    logo?: string;
    phone_number?: string;
    latitude: number;
    longitude: number;
    address_text?: string;
  };
  customer: {
    first_name: string;
    last_name: string;
    phone_number: string;
  };
  delivery_address: {
    title?: string;
    street?: string;
    building_number?: string;
    floor?: string;
    apartment_number?: string;
    delivery_instructions?: string;
    latitude: number;
    longitude: number;
  };
  items: TripItem[];
  payment_method: 'COD' | 'WALLET' | 'CARD';
  total_amount: string;
  cash_to_collect: string;
  driver_earnings: string;
  distance_km: number;
  customer_notes?: string;
  offered_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  completed_at?: string;
}

export interface NavigationStep {
  instruction: string;
  distance_text: string;
  distance_meters: number;
  duration_text: string;
  maneuver: string;
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
}

export interface RouteInfo {
  phase: 'RESTAURANT' | 'CUSTOMER';
  destination_name: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  polyline: string;
  distance_km: number;
  duration_minutes: number;
  steps?: NavigationStep[];
}

export interface DriverAnalytics {
  total_delivered: number;
  rating: number;
  cash_in_hand: string;
  cod_max_ceiling: string;
  earnings_today: string;
  earnings_week: string;
  earnings_month: string;
  trips_today_count: number;
  trips_week_count: number;
  total_distance_km: number;
  vehicle_type: string;
  license_plate: string;
  is_online: boolean;
}

interface TripState {
  activeTrip: DeliveryTrip | null;
  incomingOffer: DeliveryTrip | null;
  currentRoute: RouteInfo | null;
  tripsHistory: DeliveryTrip[];
  analytics: DriverAnalytics | null;
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;

  setIncomingOffer: (offer: DeliveryTrip | null) => void;
  fetchCurrentTrip: () => Promise<DeliveryTrip | null>;
  fetchRoute: (tripId: string, lat?: number, lon?: number, forceRefresh?: boolean) => Promise<RouteInfo | null>;
  fetchTripsHistory: (statusFilter?: string) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  acceptTrip: (tripId: string) => Promise<boolean>;
  rejectTrip: (tripId: string) => Promise<boolean>;
  pickupTrip: (tripId: string) => Promise<boolean>;
  verifyOtpAndComplete: (tripId: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  completeContactless: (tripId: string, note?: string) => Promise<{ success: boolean; error?: string }>;
}

export const useTripStore = create<TripState>((set, get) => ({
  activeTrip: null,
  incomingOffer: null,
  currentRoute: null,
  tripsHistory: [],
  analytics: null,
  isLoading: false,
  isActionLoading: false,
  error: null,

  setIncomingOffer: (offer) => set({ incomingOffer: offer }),

  fetchCurrentTrip: async () => {
    set({ isLoading: true });
    const res = await api.get('/api/v1/driver/current-trip/');
    // DRF RetrieveAPIView returns the object directly (not nested under 'trip')
    const trip: DeliveryTrip | null = res.data?.trip ?? (res.data?.id ? res.data : null);
    if (trip) {
      if (trip.status === 'OFFERED') {
        set({ incomingOffer: trip, activeTrip: null, isLoading: false });
      } else {
        set({ activeTrip: trip, incomingOffer: null, isLoading: false });
        // Auto fetch route for active trip
        get().fetchRoute(trip.id);
      }
      return trip;
    } else {
      set({ activeTrip: null, incomingOffer: null, currentRoute: null, isLoading: false });
      return null;
    }
  },

  fetchRoute: async (tripId: string, lat?: number, lon?: number, forceRefresh = false) => {
    const shift = useShiftStore.getState();
    const originLat = lat ?? shift.lastLatitude;
    const originLon = lon ?? shift.lastLongitude;

    const payload: any = { force_refresh: forceRefresh };
    if (originLat !== null && originLat !== undefined && originLon !== null && originLon !== undefined) {
      payload.origin_lat = originLat;
      payload.origin_lon = originLon;
    }
    try {
      const res = await api.post(`/api/v1/driver/trips/${tripId}/route/`, payload);
      if (res.data) {
        set({ currentRoute: res.data });
        // If shiftStore doesn't have coordinates or needs alignment, update it from route origin
        if (res.data.origin?.latitude && res.data.origin?.longitude) {
          if (shift.lastLatitude === null || shift.lastLongitude === null) {
            shift.setLocationDirectly(Number(res.data.origin.latitude), Number(res.data.origin.longitude));
          }
        }
        return res.data;
      }
    } catch (e) {
      console.warn('Fetch route failed:', e);
    }
    return null;
  },

  fetchTripsHistory: async (statusFilter = 'ALL') => {
    set({ isLoading: true });
    const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    const res = await api.get(`/api/v1/driver/trips/${query}`);
    if (res.data) {
      set({ tripsHistory: Array.isArray(res.data) ? res.data : (res.data.results || []), isLoading: false });
    } else {
      set({ tripsHistory: [], isLoading: false });
    }
  },

  fetchAnalytics: async () => {
    const res = await api.get('/api/v1/driver/analytics/');
    if (res.data) {
      set({ analytics: res.data });
    }
  },

  acceptTrip: async (tripId: string) => {
    set({ isActionLoading: true });
    const res = await api.post(`/api/v1/driver/trips/${tripId}/accept/`);
    if (res.data?.trip) {
      set({
        activeTrip: res.data.trip,
        incomingOffer: null,
        isActionLoading: false,
      });
      get().fetchRoute(tripId);
      return true;
    }
    set({ isActionLoading: false });
    return false;
  },

  rejectTrip: async (tripId: string) => {
    set({ isActionLoading: true });
    const res = await api.post(`/api/v1/driver/trips/${tripId}/reject/`);
    set({ incomingOffer: null, isActionLoading: false });
    return !res.error;
  },

  pickupTrip: async (tripId: string) => {
    set({ isActionLoading: true });
    const res = await api.post(`/api/v1/driver/trips/${tripId}/pickup/`);
    if (res.data?.trip) {
      set({
        activeTrip: res.data.trip,
        isActionLoading: false,
      });
      get().fetchRoute(tripId);
      return true;
    }
    set({ isActionLoading: false });
    return false;
  },

  verifyOtpAndComplete: async (tripId: string, otp: string) => {
    set({ isActionLoading: true });
    const res = await api.post(`/api/v1/driver/trips/${tripId}/verify-otp/`, { otp });
    if (res.data?.trip) {
      set({
        activeTrip: null,
        currentRoute: null,
        isActionLoading: false,
      });
      // Refresh wallet & analytics
      get().fetchAnalytics();
      return { success: true };
    }
    set({ isActionLoading: false });
    return { success: false, error: res.error || 'رمز التحقق غير صحيح' };
  },

  completeContactless: async (tripId: string, note?: string) => {
    set({ isActionLoading: true });
    const res = await api.post(`/api/v1/driver/trips/${tripId}/verify-otp/`, {
      is_contactless: true,
      note: note || 'تسليم بدون تواصل مع إثبات بالصورة عند الباب',
    });
    if (res.data?.trip) {
      set({
        activeTrip: null,
        currentRoute: null,
        isActionLoading: false,
      });
      // Refresh wallet & analytics
      get().fetchAnalytics();
      return { success: true };
    }
    set({ isActionLoading: false });
    return { success: false, error: res.error || 'تعذر إتمام التسليم بدون تواصل' };
  },
}));
