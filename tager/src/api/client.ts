import type { Restaurant, Order, MenuItem, MenuCategory, OperatingHour, SupportTicket, TicketMessage } from '../types';

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
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

  // --- Merchant Restaurant & Status ---
  async getMyRestaurants() {
    return this.request<Restaurant[]>('/api/v1/merchant/restaurants/');
  }

  async toggleStoreBusy(restaurantId: string) {
    return this.request<{ is_busy: boolean; message: string }>(`/api/v1/merchant/restaurants/${restaurantId}/toggle-busy/`, {
      method: 'POST',
    });
  }

  async updateStoreStatus(restaurantId: string, status: 'OPEN' | 'BUSY' | 'CLOSED') {
    return this.request<{ message: string; is_active: boolean; is_busy: boolean; status: 'OPEN' | 'BUSY' | 'CLOSED' }>(
      `/api/v1/merchant/restaurants/${restaurantId}/update-status/`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      }
    );
  }

  // --- Operating Hours ---
  async getOperatingHours(restaurantId: string) {
    return this.request<OperatingHour[]>(`/api/v1/merchant/restaurants/${restaurantId}/operating-hours/`);
  }

  async saveOperatingHours(restaurantId: string, operatingHours: OperatingHour[]) {
    return this.request<{ message: string; operating_hours: OperatingHour[] }>(
      `/api/v1/merchant/restaurants/${restaurantId}/operating-hours/`,
      {
        method: 'POST',
        body: JSON.stringify({ operating_hours: operatingHours }),
      }
    );
  }

  // --- Live Orders ---
  async getLiveOrders() {
    return this.request<Order[]>('/api/v1/merchant/orders/live/');
  }

  async updateOrderStatus(orderId: string, status: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED') {
    return this.request<Order>(`/api/v1/merchant/orders/${orderId}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // --- Categories Management ---
  async getCategories() {
    return this.request<MenuCategory[]>('/api/v1/merchant/menus/categories/');
  }

  async createCategory(data: { name: string; order?: number }) {
    return this.request<MenuCategory>('/api/v1/merchant/menus/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: { name?: string; order?: number }) {
    return this.request<MenuCategory>(`/api/v1/merchant/menus/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/api/v1/merchant/menus/categories/${id}/`, {
      method: 'DELETE',
    });
  }

  // --- Menu Items Management ---
  async getMenuItems() {
    return this.request<MenuItem[]>('/api/v1/merchant/menus/items/');
  }

  async createMenuItem(data: Partial<MenuItem>) {
    return this.request<MenuItem>('/api/v1/merchant/menus/items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>) {
    return this.request<MenuItem>(`/api/v1/merchant/menus/items/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMenuItem(id: string) {
    return this.request<any>(`/api/v1/merchant/menus/items/${id}/`, {
      method: 'DELETE',
    });
  }

  async toggleItemAvailability(itemId: string) {
    return this.request<{ item_id?: string; is_available: boolean; message: string }>(
      `/api/v1/merchant/menus/items/${itemId}/toggle-availability/`,
      {
        method: 'POST',
      }
    );
  }

  // --- Support Tickets ---
  async getSupportTickets(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<SupportTicket[]>(`/api/v1/support/tickets/${query}`);
  }

  async getTicketDetail(ticketId: string) {
    return this.request<SupportTicket>(`/api/v1/support/tickets/${ticketId}/`);
  }

  async createSupportTicket(formData: FormData | object) {
    const isFormData = typeof FormData !== 'undefined' && formData instanceof FormData;
    return this.request<SupportTicket>('/api/v1/support/tickets/', {
      method: 'POST',
      body: isFormData ? formData : JSON.stringify(formData),
    });
  }

  async sendTicketMessage(ticketId: string, formData: FormData | object) {
    const isFormData = typeof FormData !== 'undefined' && formData instanceof FormData;
    return this.request<TicketMessage>(`/api/v1/support/tickets/${ticketId}/messages/`, {
      method: 'POST',
      body: isFormData ? formData : JSON.stringify(formData),
    });
  }

  async closeSupportTicket(ticketId: string) {
    return this.request<SupportTicket>(`/api/v1/support/tickets/${ticketId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CLOSED' }),
    });
  }
}

export const api = new ApiClient();
