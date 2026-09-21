import type { Restaurant, Order, MenuItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private token: string | null = localStorage.getItem('tager_token');

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tager_token', token);
    } else {
      localStorage.removeItem('tager_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: string | null; status: number }> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const res = await fetch(url, { ...options, headers });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        let msg = json?.detail || json?.error || json?.message;
        if (!msg && json && typeof json === 'object') {
          const firstKey = Object.keys(json)[0];
          const val = json[firstKey];
          msg = Array.isArray(val) ? val[0] : String(val);
        }
        return {
          data: null,
          error: msg || `خطأ في الخادم (${res.status})`,
          status: res.status,
        };
      }

      return { data: json as T, error: null, status: res.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'تعذر الاتصال بالخادم، يرجى التأكد من تشغيل الباك إند', status: 0 };
    }
  }

  // --- Auth ---
  async login(credentials: { username: string; password: string }) {
    return this.request<{ access: string; refresh: string; user?: any }>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getProfile() {
    return this.request<any>('/api/v1/auth/me/');
  }

  // --- Merchant Restaurant ---
  async getMyRestaurants() {
    return this.request<Restaurant[]>('/api/v1/merchant/restaurants/');
  }

  async toggleStoreBusy(restaurantId: string) {
    return this.request<{ is_busy: boolean; message: string }>(`/api/v1/merchant/restaurants/${restaurantId}/toggle-busy/`, {
      method: 'POST',
    });
  }

  // --- Live Orders ---
  async getLiveOrders() {
    return this.request<Order[]>('/api/v1/merchant/orders/live/');
  }

  async updateOrderStatus(orderId: string, status: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED') {
    return this.request<Order>(`/api/v1/merchant/orders/${orderId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // --- Menu Management ---
  async getMenuItems() {
    return this.request<MenuItem[]>('/api/v1/merchant/menus/items/');
  }

  async toggleItemAvailability(itemId: string) {
    return this.request<{ id: string; is_available: boolean; message: string }>(`/api/v1/merchant/menus/items/${itemId}/toggle-availability/`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
