import type {
  FleetStats,
  DriverRadarItem,
  LiveOrderItem,
  CashReconciliationData,
  DriverRosterItem,
  User,
  SupervisorMember,
  AuditLogEntry,
  PendingApprovalItem,
  DeliveryZoneItem,
  OpsAnalyticsData,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8180`
    : 'http://localhost:8180');

class SupervisorApiClient {
  private token: string | null = typeof window !== 'undefined' ? localStorage.getItem('supervisor_token') : null;
  private refreshToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('supervisor_refresh_token') : null;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: any) => void;
  }> = [];

  public setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('supervisor_token', token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem('supervisor_refresh_token', refreshToken);
      }
    } else {
      this.refreshToken = null;
      localStorage.removeItem('supervisor_token');
      localStorage.removeItem('supervisor_refresh_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('supervisor_refresh_token') : null);
  }

  public getCurrentUser(): User | null {
    if (!this.getToken()) return null;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('supervisor_user') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
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

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
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
    retries: number = 2,
    isRetry: boolean = false
  ): Promise<{ data: T | null; error: string | null; status: number }> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
            return this.request<T>(endpoint, { ...options, headers: retryHeaders }, 0, true);
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
          return this.request<T>(endpoint, { ...options, headers: retryHeaders }, 0, true);
        } else {
          this.logout();
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

      // If server is temporarily restarting (502/503/504), retry once or twice
      if ((res.status === 502 || res.status === 503 || res.status === 504) && retries > 0) {
        await new Promise((r) => setTimeout(r, 600));
        return this.request<T>(endpoint, options, retries - 1, isRetry);
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
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 600));
        return this.request<T>(endpoint, options, retries - 1, isRetry);
      }
      return {
        data: null,
        error: err.message || 'تعذر الاتصال بالخادم، يرجى التأكد من تشغيل الباك إند',
        status: 0,
      };
    }
  }

  // App & Maps Config
  async getConfig() {
    return this.request<{
      google_maps_client_key?: string;
      default_search_radius_km?: number;
      platform_commission_percent?: string;
    }>('/api/v1/auth/config/');
  }

  // Auth
  async login(credentials: { username: string; password: string }) {
    const res = await this.request<{ access: string; refresh: string; user?: User }>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.data?.access) {
      this.setToken(res.data.access, res.data.refresh);
      if (res.data.user) {
        localStorage.setItem('supervisor_user', JSON.stringify(res.data.user));
      }
    }
    return res;
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('supervisor_user');
  }

  // Dashboard Overview KPIs
  async getStats() {
    return this.request<FleetStats>('/api/v1/supervisor/stats/');
  }

  // Driver Radar / Map
  async getRadar(onlineOnly: boolean = false) {
    const q = onlineOnly ? '?online_only=true' : '';
    return this.request<{ count: number; cod_max_ceiling: number; drivers: DriverRadarItem[] }>(
      `/api/v1/supervisor/radar/${q}`
    );
  }

  // Live Orders Dispatch
  async getLiveOrders(statusFilter?: string, unassignedOnly: boolean = false, storeTypeFilter?: string) {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
    if (unassignedOnly) params.set('unassigned', 'true');
    if (storeTypeFilter && storeTypeFilter !== 'ALL') params.set('store_type', storeTypeFilter);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ count: number; orders: LiveOrderItem[] }>(`/api/v1/supervisor/dispatch/orders/${qs}`);
  }

  // Live Orders Dispatch alias
  async fetchLiveOrders(statusFilter?: string, unassignedOnly: boolean = false, storeTypeFilter?: string) {
    return this.getLiveOrders(statusFilter, unassignedOnly, storeTypeFilter);
  }

  // Manual Dispatch Action
  async assignOrder(data: {
    order_id: string;
    driver_id?: string;
    driver_ids?: string[];
    mode: 'offer' | 'direct';
    timeout_seconds?: number;
  }) {
    return this.request<{
      message: string;
      mode: string;
      order_number: string;
      driver_name?: string;
      trip_id?: string;
      status?: string;
      offers_sent?: number;
    }>('/api/v1/supervisor/dispatch/assign/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Cash Reconciliation
  async getCashReconciliation() {
    return this.request<CashReconciliationData>('/api/v1/supervisor/cash/reconciliation/');
  }

  // Settle Cash
  async recordSettlement(driver_id: string, amount?: number | string, notes?: string) {
    return this.request<{
      message: string;
      settlement_id: string;
      amount: number;
      balance_before: number;
      balance_after: number;
      driver_name: string;
      created_at: string;
    }>('/api/v1/supervisor/cash/settle/', {
      method: 'POST',
      body: JSON.stringify({ driver_id, amount, notes }),
    });
  }

  // Drivers Roster
  async getDriversRoster(statusFilter: string = 'all', search: string = '') {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ count: number; drivers: DriverRosterItem[] }>(`/api/v1/supervisor/drivers/${qs}`);
  }

  // Driver Action (Approve, Deactivate, Toggle Online, Toggle Busy)
  async driverAction(driver_id: string, action: 'approve' | 'deactivate' | 'toggle_approve' | 'toggle_online' | 'toggle_busy') {
    return this.request<{
      message: string;
      driver_id: string;
      is_active?: boolean;
      is_online?: boolean;
      is_busy?: boolean;
    }>(`/api/v1/supervisor/drivers/${driver_id}/action/`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // 👑 Ops Manager Methods (Talabat Suite)

  // Team of Supervisors
  async getSupervisors(roleFilter: string = 'all', search: string = '') {
    const params = new URLSearchParams();
    if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ count: number; members: SupervisorMember[] }>(`/api/v1/supervisor/ops/team/${qs}`);
  }

  async createSupervisor(data: {
    username: string;
    password: string;
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    role: 'SUPERVISOR' | 'OPS_MANAGER';
    zone_ids?: string[];
  }) {
    return this.request<{
      message: string;
      id: string;
      username: string;
      role: string;
      role_display: string;
    }>('/api/v1/supervisor/ops/team/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupervisor(
    userId: string,
    data: {
      is_active?: boolean;
      role?: string;
      password?: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      zone_ids?: string[];
    }
  ) {
    return this.request<{
      message: string;
      id: string;
      is_active: boolean;
      role: string;
    }>(`/api/v1/supervisor/ops/team/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Audit Logs
  async getAuditLogs(params?: { action_type?: string; actor_id?: string; search?: string; limit?: number }) {
    const qp = new URLSearchParams();
    if (params?.action_type && params.action_type !== 'ALL') qp.set('action_type', params.action_type);
    if (params?.actor_id) qp.set('actor_id', params.actor_id);
    if (params?.search) qp.set('search', params.search);
    if (params?.limit) qp.set('limit', String(params.limit));
    const qs = qp.toString() ? `?${qp.toString()}` : '';
    return this.request<{
      count: number;
      action_types: Array<{ value: string; label: string }>;
      logs: AuditLogEntry[];
    }>(`/api/v1/supervisor/ops/audit-log/${qs}`);
  }

  // Pending Approvals (Graduated Cash limits)
  async getPendingApprovals() {
    return this.request<{ count: number; pending_approvals: PendingApprovalItem[] }>(
      '/api/v1/supervisor/ops/approvals/'
    );
  }

  async reviewPendingApproval(settlementId: string, action: 'approve' | 'reject', reason?: string) {
    return this.request<{
      message: string;
      settlement_id: string;
      status: string;
      balance_after?: number;
    }>(`/api/v1/supervisor/ops/approvals/${settlementId}/`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
  }

  // Ops Analytics & KPIs
  async getOpsAnalytics() {
    return this.request<OpsAnalyticsData>('/api/v1/supervisor/ops/analytics/');
  }

  // Operational Zones
  async getDeliveryZones() {
    return this.request<{ count: number; zones: DeliveryZoneItem[] }>('/api/v1/supervisor/ops/zones/');
  }

  async createDeliveryZone(data: {
    name: string;
    code: string;
    city: string;
    center_latitude: number;
    center_longitude: number;
    radius_km?: number;
    supervisor_ids?: string[];
  }) {
    return this.request<{
      message: string;
      id: string;
      name: string;
      code: string;
    }>('/api/v1/supervisor/ops/zones/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public get client() {
    return this;
  }

  public async get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }
}

export const api = new SupervisorApiClient();
