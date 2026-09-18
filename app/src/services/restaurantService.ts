import { api } from './api';

export interface BackendRestaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  cover_image: string | null;
  rating: number;
  rating_count: number;
  delivery_fee: number;
  estimated_prep_time_minutes: number;
  currency: string;
  is_busy: boolean;
  distance_km: number | null;
}

export interface BackendModifier {
  id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
}

export interface BackendModifierGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  modifiers: BackendModifier[];
}

export interface BackendMenuItem {
  id: string;
  category: string;
  name: string;
  description: string;
  base_price: string | number;
  image: string | null;
  is_available: boolean;
  is_popular: boolean;
  modifier_groups: BackendModifierGroup[];
}

export interface BackendMenuCategory {
  id: string;
  name: string;
  order: number;
  items: BackendMenuItem[];
}

export const restaurantService = {
  /**
   * Fetch all active restaurants, optionally filtered by lat, lng, or search query.
   */
  async getRestaurants(params?: { lat?: number; lng?: number; q?: string }) {
    return api.get<BackendRestaurant[]>('/api/v1/customer/restaurants/', params);
  },

  /**
   * Fetch single restaurant details.
   */
  async getRestaurantDetail(id: string) {
    return api.get<BackendRestaurant>(`/api/v1/customer/restaurants/${id}/`);
  },

  /**
   * Fetch menu categories with nested items for a restaurant.
   */
  async getRestaurantMenu(restaurantId: string) {
    return api.get<BackendMenuCategory[]>(`/api/v1/customer/menus/restaurant/${restaurantId}/`);
  },
};
