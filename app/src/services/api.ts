import { Platform } from 'react-native';
import { storage } from './storage';

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getBaseUrl();

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private baseUrl = API_BASE_URL;

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

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      if (params) {
        const query = Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        if (query) {
          url += (url.includes('?') ? '&' : '?') + query;
        }
      }

      const headers = await this.getHeaders();
      const res = await fetch(url, { method: 'GET', headers });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          data: null,
          error: json?.detail || json?.error || `Request failed with status ${res.status}`,
          status: res.status,
        };
      }
      return { data: json as T, error: null, status: res.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'فشل الاتصال بالخادم', status: 0 };
    }
  }

  async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const headers = await this.getHeaders();
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // Extract field error or general error
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

  async patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const headers = await this.getHeaders();
      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          data: null,
          error: json?.detail || json?.error || `فشل التحديث (${res.status})`,
          status: res.status,
        };
      }
      return { data: json as T, error: null, status: res.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'فشل الاتصال بالخادم', status: 0 };
    }
  }
}

export const api = new ApiClient();
