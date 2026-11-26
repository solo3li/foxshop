import { api } from './api';
import { Restaurant, FoodItem, StoreType } from '../types/models';

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
  store_type?: string;
  delivery_mode?: string;
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
  price?: string | number;
  image: string | null;
  is_available: boolean;
  is_popular: boolean;
  modifier_groups: BackendModifierGroup[];
  pricing_unit?: string;
  barcode?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  is_stock_tracked?: boolean;
}

export interface BackendMenuCategory {
  id: string;
  name: string;
  order: number;
  items: BackendMenuItem[];
}

export interface UniversalSearchProduct extends BackendMenuItem {
  restaurant_id?: string;
  restaurant_name?: string;
  store_type?: string;
  price?: number;
}

export interface UniversalSearchResponse {
  query?: string;
  store_type?: string;
  total_stores?: number;
  total_products?: number;
  cached?: boolean;
  stores?: BackendRestaurant[];
  products?: UniversalSearchProduct[];
  items?: UniversalSearchProduct[];
}

export const restaurantService = {
  /**
   * Fetch all active restaurants, optionally filtered by lat, lng, search query, or store_type.
   */
  async getRestaurants(params?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    q?: string;
    store_type?: string;
  }) {
    const lat = params?.lat !== undefined ? params.lat : params?.latitude;
    const lng = params?.lng !== undefined ? params.lng : params?.longitude;
    return api.get<BackendRestaurant[]>('/api/v1/customer/restaurants/', {
      ...params,
      lat,
      lng,
    });
  },

  /**
   * Universal search across stores, products, and barcodes with optional sector filter and geofencing coordinates.
   */
  async searchUniversal(
    query: string,
    options?: {
      store_type?: string;
      lat?: number;
      lng?: number;
      barcode?: string;
    }
  ) {
    const params: Record<string, any> = { q: query };
    if (options?.store_type && options.store_type !== 'ALL') {
      params.store_type = options.store_type;
    }
    if (options?.lat !== undefined) params.lat = options.lat;
    if (options?.lng !== undefined) params.lng = options.lng;
    if (options?.barcode) params.barcode = options.barcode;

    return api.get<UniversalSearchResponse>('/api/v1/customer/restaurants/search/', params);
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

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('/media/http%3A/') || url.includes('/media/https%3A/')) {
    const parts = url.split('/media/');
    if (parts[1]) {
      const decoded = decodeURIComponent(parts[1]);
      return decoded.replace('https:/images', 'https://images').replace('http:/', 'http://');
    }
  }
  if (url.includes('/media/http:/') || url.includes('/media/https:/')) {
    const parts = url.split('/media/');
    if (parts[1]) {
      return parts[1].replace('https:/', 'https://').replace('http:/', 'http://');
    }
  }
  return url;
}

export function mapBackendRestaurantToModel(r: BackendRestaurant): Restaurant {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    rating: Number(r.rating) || 0,
    ratingCount: r.rating_count,
    deliveryTime: `${r.estimated_prep_time_minutes || 25} دقيقة`,
    deliveryFee: Number(r.delivery_fee) || 0,
    image:
      sanitizeImageUrl(r.cover_image) ||
      sanitizeImageUrl(r.logo) ||
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
    isBusy: r.is_busy,
    distanceKm: r.distance_km,
    store_type: (r.store_type as StoreType) || 'RESTAURANT',
    delivery_mode: r.delivery_mode,
  };
}

export function mapBackendMenuItemToFoodItem(item: BackendMenuItem, restaurantId?: string): FoodItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    price: Number(item.price ?? item.base_price) || 0,
    image:
      sanitizeImageUrl(item.image) ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
    restaurantId: restaurantId,
    pricing_unit: item.pricing_unit,
    stock_quantity: item.stock_quantity !== undefined ? Number(item.stock_quantity) : undefined,
    is_stock_tracked: item.is_stock_tracked,
    is_available: item.is_available,
  };
}
