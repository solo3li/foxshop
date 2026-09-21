import { Platform } from 'react-native';
import { storage } from './storage';

// Default API Host - dynamically adapts for Android Emulator, iOS Simulator, and Web
const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getBaseUrl();

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiService {
  private baseUrl: string = API_BASE_URL;

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getBaseUrl() {
    return this.baseUrl;
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
    options: RequestInit = {}
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

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
