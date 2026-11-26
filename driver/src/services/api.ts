import { Platform } from 'react-native';
import { storage } from './storage';

// Default API Host - dynamically adapts for Android Emulator, iOS Simulator, and Web
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:' && hostname.endsWith('.nip.io')) {
      const apiHost = hostname.replace(/^(driver-foxshop|driver)\./, 'api-foxshop.');
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

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiService {
  private baseUrl: string = API_BASE_URL;
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

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getBaseUrl() {
    return this.baseUrl;
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
      endpoint.includes('/api/v1/auth/driver/register/') ||
      endpoint.includes('/api/v1/auth/register/')
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const refresh = await storage.getItem('foxshop_driver_refresh_token');
      if (!refresh) {
        return null;
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
        return null;
      }

      const json = await res.json().catch(() => null);
      if (json?.access) {
        await storage.setItem('foxshop_driver_access_token', json.access);
        if (json.refresh) {
          await storage.setItem('foxshop_driver_refresh_token', json.refresh);
        }
        return json.access;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async clearAuthSession() {
    await storage.removeItem('foxshop_driver_access_token');
    await storage.removeItem('foxshop_driver_refresh_token');
    await storage.removeItem('foxshop_driver_user');
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

  private async getHeaders(contentType = 'application/json'): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    const token = await storage.getItem('foxshop_driver_access_token');
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
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getHeaders(
      options.body instanceof FormData ? '' : 'application/json'
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
      });

      // 401 Unauthorized Interceptor with Mutex & Queue
      if (response.status === 401 && !this.isAuthEndpoint(endpoint) && !isRetry) {
        if (this.isRefreshing) {
          try {
            const newToken = await new Promise<string>((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            });
            const retryHeaders = {
              ...headers,
              ...(options.headers as Record<string, string>),
              Authorization: `Bearer ${newToken}`,
            };
            return this.request<T>(endpoint, { ...options, headers: retryHeaders }, true);
          } catch {
            return {
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
            ...(options.headers as Record<string, string>),
            Authorization: `Bearer ${newAccessToken}`,
          };
          return this.request<T>(endpoint, { ...options, headers: retryHeaders }, true);
        } else {
          await this.clearAuthSession();
          return {
            error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول',
            status: 401,
          };
        }
      }

      let responseData: any = null;
      const text = await response.text();
      try {
        responseData = text ? JSON.parse(text) : null;
      } catch {
        responseData = text;
      }

      if (!response.ok) {
        let errorMsg = 'حدث خطأ غير متوقع';
        if (typeof responseData === 'object' && responseData !== null) {
          if (responseData.error) errorMsg = responseData.error;
          else if (responseData.detail) errorMsg = responseData.detail;
          else if (responseData.message) errorMsg = responseData.message;
          else {
            const firstKey = Object.keys(responseData)[0];
            const val = responseData[firstKey];
            errorMsg = Array.isArray(val) ? val[0] : String(val);
          }
        }
        return {
          error: errorMsg,
          status: response.status,
        };
      }

      return {
        data: responseData,
        status: response.status,
      };
    } catch (err: any) {
      return {
        error: err.message || 'تعذر الاتصال بالخادم. تحقق من شبكة الإنترنت.',
        status: 0,
      };
    }
  }

  get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
