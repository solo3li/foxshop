import { Platform } from 'react-native';
import { storage } from './storage';

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:' && hostname.endsWith('.nip.io')) {
      const apiHost = hostname.replace(/^(app-foxshop|customer-foxshop)\./, 'api-foxshop.');
      return `https://${apiHost}`;
    }
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8180`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8180';
  }
  return 'http://169.58.32.179:8180';
};

export const API_BASE_URL = getBaseUrl();

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private baseUrl = API_BASE_URL;
  private isRefreshing = false;
  private unauthorizedListeners: (() => void)[] = [];
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: any) => void;
  }> = [];

  public onUnauthorized(callback: () => void): () => void {
    this.unauthorizedListeners.push(callback);
    return () => {
      this.unauthorizedListeners = this.unauthorizedListeners.filter((cb) => cb !== callback);
    };
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

  private async refreshAccessToken(): Promise<{ token: string | null; shouldLogout: boolean }> {
    try {
      const refresh = await storage.getItem('foxshop_refresh_token');
      if (!refresh || refresh === 'undefined' || refresh === 'null') {
        return { token: null, shouldLogout: true };
      }

      const res = await fetch(`${this.baseUrl}/api/v1/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        return { token: null, shouldLogout: res.status === 400 || res.status === 401 };
      }

      const json = await res.json().catch(() => null);
      if (json?.access) {
        await storage.setItem('foxshop_access_token', json.access);
        if (json.refresh) {
          await storage.setItem('foxshop_refresh_token', json.refresh);
        }
        return { token: json.access, shouldLogout: false };
      }
      return { token: null, shouldLogout: false };
    } catch {
      return { token: null, shouldLogout: false };
    }
  }

  private async clearAuthSession() {
    await storage.removeItem('foxshop_access_token');
    await storage.removeItem('foxshop_refresh_token');
    await storage.removeItem('foxshop_user');
    this.unauthorizedListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in unauthorized listener:', err);
      }
    });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }

  private async getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await storage.getItem('foxshop_access_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const headers = await this.getHeaders((options.headers as Record<string, string>) || {});

      const res = await fetch(url, { ...options, headers });

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
        let refreshResult: { token: string | null; shouldLogout: boolean } = {
          token: null,
          shouldLogout: false,
        };
        try {
          refreshResult = await this.refreshAccessToken();
          if (refreshResult.token) {
            this.processQueue(null, refreshResult.token);
          } else {
            this.processQueue(new Error('Token refresh failed'));
          }
        } finally {
          this.isRefreshing = false;
        }

        if (refreshResult.token) {
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${refreshResult.token}`,
          };
          return this.request<T>(endpoint, { ...options, headers: retryHeaders }, true);
        } else {
          if (refreshResult.shouldLogout) {
            await this.clearAuthSession();
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
        let errorMsg = json?.detail || json?.error || json?.message;
        if (!errorMsg && json && typeof json === 'object') {
          const firstKey = Object.keys(json)[0];
          const firstVal = json[firstKey];
          errorMsg = Array.isArray(firstVal) ? firstVal[0] : String(firstVal);
        }
        return {
          data: null,
          error: errorMsg || `فشل الطلب (${res.status})`,
          status: res.status,
        };
      }

      return { data: json as T, error: null, status: res.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'فشل الاتصال بالخادم', status: 0 };
    }
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let finalEndpoint = endpoint;
    if (params) {
      const query = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (query) {
        finalEndpoint += (finalEndpoint.includes('?') ? '&' : '?') + query;
      }
    }
    return this.request<T>(finalEndpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
