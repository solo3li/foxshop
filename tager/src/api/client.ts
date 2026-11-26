import type { Restaurant, Order, MenuItem, MenuCategory, OperatingHour, SupportTicket, TicketMessage, Coupon } from '../types';

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:' && hostname.endsWith('.nip.io')) {
      const apiHost = hostname.replace(/^(tager-foxshop|tager|merchant-foxshop)\./, 'api-foxshop.');
      return `https://${apiHost}`;
    }
    return `${protocol}//${hostname}:8180`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8180';
};

class ApiClient {
  private token: string | null = typeof window !== 'undefined' ? localStorage.getItem('tager_token') : null;
  private refreshToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('tager_refresh_token') : null;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: any) => void;
  }> = [];

  public setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (token) {
      if (typeof window !== 'undefined') localStorage.setItem('tager_token', token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        if (typeof window !== 'undefined') localStorage.setItem('tager_refresh_token', refreshToken);
      }
    } else {
      this.refreshToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tager_token');
        localStorage.removeItem('tager_refresh_token');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('tager_refresh_token') : null);
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else if (token) {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  private isAuthEndpoint(endpoint: string): boolean {
    return (
      endpoint.includes('/api/v1/auth/login/') ||
      endpoint.includes('/api/v1/auth/token/refresh/') ||
      endpoint.includes('/api/v1/auth/register/')
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const refresh = this.getRefreshToken();
      if (!refresh) {
        return null;
      }

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json().catch(() => null);
      if (json?.access) {
        this.setToken(json.access, json.refresh || refresh);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: json.access }));
        }
        return json.access;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<{ data: T | null; error: string | null; status: number }> {
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
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const res = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers
      });

      // 401 Unauthorized Interceptor with Mutex & Queue
      if (res.status === 401 && !this.isAuthEndpoint(endpoint) && !isRetry) {
        if (this.isRefreshing) {
          try {
            const newToken = await new Promise<string>((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            });
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };
            return this.request<T>(endpoint, { ...options, headers: retryHeaders }, true);
          } catch {
            return {
              data: null,
              error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول',
              status: 401,
            };
          }
        }

        this.isRefreshing = true;
        let newAccessToken: string | null = null;
        try {
          newAccessToken = await this.refreshAccessToken();
          if (newAccessToken) {
            this.processQueue(null, newAccessToken);
          } else {
            this.processQueue(new Error('Token refresh failed'));
          }
        } finally {
          this.isRefreshing = false;
        }

        if (newAccessToken) {
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          return this.request<T>(endpoint, { ...options, headers: retryHeaders }, true);
        } else {
          this.setToken(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
          return {
            data: null,
            error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول',
            status: 401,
          };
        }
      }

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
    const res = await this.request<{ access: string; refresh: string; user?: any }>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.data?.access) {
      this.setToken(res.data.access, res.data.refresh);
    }
    return res;
  }

  logout() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }

  async getProfile() {
    return this.request<any>('/api/v1/auth/profile/');
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

  // --- Live & All Orders ---
  async getLiveOrders() {
    return this.request<Order[]>('/api/v1/merchant/orders/live/');
  }

  async getAllOrders(params?: {
    search?: string;
    status?: string;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.payment_method && params.payment_method !== 'ALL') query.append('payment_method', params.payment_method);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);

    const qs = query.toString();
    return this.request<Order[]>(`/api/v1/merchant/orders/${qs ? `?${qs}` : ''}`);
  }

  async getOrderDetail(orderId: string) {
    return this.request<Order>(`/api/v1/merchant/orders/${orderId}/`);
  }

  async updateOrderStatus(orderId: string, status: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED') {
    return this.request<Order>(`/api/v1/merchant/orders/${orderId}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async confirmOrderWeights(orderId: string, items: { item_id: string; actual_weight: number }[]) {
    return this.request<{ message: string; order: Order }>(`/api/v1/merchant/orders/${orderId}/confirm-weights/`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // --- Driver Shift Settlements ---
  async getSettlements() {
    return this.request<{
      settlements: import('../types').ShiftSettlement[];
      unsettled_drivers: import('../types').UnsettledDriver[];
    }>('/api/v1/merchant/settlements/');
  }

  async getPendingSettlements() {
    return this.request<import('../types').ShiftSettlement[]>('/api/v1/merchant/settlements/pending/');
  }

  async createSettlementOTP(driverId: string) {
    return this.request<{
      message: string;
      settlement: import('../types').ShiftSettlement;
      otp_code: string;
    }>('/api/v1/merchant/settlements/create/', {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    });
  }

  async updateRestaurantSettings(restaurantId: string, data: { store_type?: string; delivery_mode?: string }) {
    return this.request<import('../types').Restaurant>(`/api/v1/merchant/restaurants/${restaurantId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
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

  async uploadMenuItemImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.request<{ url: string; path: string; filename: string; message: string }>(
      '/api/v1/merchant/menus/items/upload-image/',
      {
        method: 'POST',
        body: formData,
      }
    );
  }

  async createMenuItem(data: Partial<MenuItem> | FormData) {
    return this.request<MenuItem>('/api/v1/merchant/menus/items/', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  async updateMenuItem(id: string, data: Partial<MenuItem> | FormData) {
    return this.request<MenuItem>(`/api/v1/merchant/menus/items/${id}/`, {
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
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

  // --- Promotions & Coupons ---
  async getCoupons() {
    return this.request<Coupon[]>('/api/v1/merchant/promotions/coupons/');
  }

  async createCoupon(data: {
    code: string;
    discount_type: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
    discount_value: number;
    min_order_amount: number;
    max_discount_amount?: number | null;
    first_order_only?: boolean;
    valid_from?: string;
    valid_to: string;
    max_usage_per_user?: number;
  }) {
    return this.request<Coupon>('/api/v1/merchant/promotions/coupons/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleCoupon(id: string) {
    return this.request<{ id: string; code: string; is_active: boolean; message: string }>(
      `/api/v1/merchant/promotions/coupons/${id}/toggle/`,
      { method: 'POST' }
    );
  }

  public get client() {
    return this;
  }

  public async get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }
}

export const api = new ApiClient();
