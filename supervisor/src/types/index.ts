export interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: 'ADMIN' | 'OPS_MANAGER' | 'SUPERVISOR' | 'DRIVER' | 'MERCHANT' | 'CUSTOMER';
  is_staff?: boolean;
}

export type StoreType =
  | 'RESTAURANT'
  | 'SUPERMARKET'
  | 'PHARMACY'
  | 'BUTCHERY_VEG'
  | 'FLOWERS_GIFTS'
  | 'GENERAL_RETAIL';

export interface SectorMeta {
  id: StoreType | 'ALL';
  label: string;
  emoji: string;
  badgeClass: string;
}

export const SECTOR_OPTIONS: readonly SectorMeta[] = [
  { id: 'ALL', label: 'جميع القطاعات', emoji: '🌐', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'RESTAURANT', label: 'مطاعم', emoji: '🍔', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'SUPERMARKET', label: 'سوبرماركت', emoji: '🛒', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'PHARMACY', label: 'صيدليات', emoji: '💊', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'BUTCHERY_VEG', label: 'لحوم وخضار', emoji: '🥩', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'FLOWERS_GIFTS', label: 'زهور وهدايا', emoji: '🎁', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'GENERAL_RETAIL', label: 'تجزئة عامة', emoji: '🛍️', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
] as const;

export interface FleetStats {
  fleet: {
    total_drivers: number;
    online_drivers: number;
    busy_drivers: number;
    offline_drivers: number;
    pending_approval: number;
  };
  orders: {
    live_orders: number;
    unassigned_orders: number;
    delivered_today: number;
  };
  cash: {
    total_cash_in_market: number;
    cod_max_ceiling: number;
    drivers_over_ceiling: number;
  };
}

export interface DriverRadarItem {
  id: string;
  profile_id: number;
  name: string;
  username: string;
  phone_number: string;
  is_active: boolean;
  is_online: boolean;
  is_busy: boolean;
  vehicle_type: 'MOTORCYCLE' | 'CAR' | 'BICYCLE' | string;
  vehicle_type_display: string;
  license_plate: string;
  latitude: number;
  longitude: number;
  cash_in_hand: number;
  cod_max_ceiling: number;
  is_over_limit: boolean;
  limit_percent: number;
  rating: number;
  total_delivered_orders: number;
  active_trip?: {
    trip_id: string;
    order_id: string;
    order_number: string;
    status: string;
    status_display: string;
    restaurant_name: string;
    store_type?: StoreType | string;
    store_type_display?: string;
    restaurant_address?: string;
    restaurant_latitude?: number;
    restaurant_longitude?: number;
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_latitude?: number;
    customer_longitude?: number;
    distance_km?: number;
    driver_earnings?: number;
    delivery_otp?: string;
  } | null;
}

export interface LiveOrderItem {
  id: string;
  order_number: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED' | string;
  status_display: string;
  payment_method: string;
  payment_method_display: string;
  total_amount: number;
  delivery_fee: number;
  created_at: string;
  elapsed_minutes: number;
  prep_time_minutes: number;
  restaurant: {
    id: string;
    name: string;
    store_type?: StoreType | string;
    store_type_display?: string;
    phone: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  delivery_address: {
    text: string;
    latitude: number;
    longitude: number;
  };
  items_count: number;
  has_assigned_driver: boolean;
  needs_driver: boolean;
  assigned_driver?: {
    id: string;
    name: string;
    phone_number: string;
    vehicle_type: string;
    vehicle_type_display: string;
  } | null;
  trip?: {
    id: string;
    status: string;
    status_display: string;
    delivery_otp: string;
    driver_earnings: number;
    distance_km: number;
  } | null;
  pending_offers_count: number;
  offered_drivers: Array<{
    id: string;
    name: string;
    phone_number: string;
    expires_at: string;
    batch: number;
  }>;
}

export interface SettlementRecord {
  id: string;
  driver_name: string;
  driver_phone: string;
  supervisor_name: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes: string;
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | string;
  status_display?: string;
  created_at: string;
}

export interface CashReconciliationData {
  cod_max_ceiling: number;
  supervisor_max_settlement_limit?: number;
  pending_approvals_count?: number;
  total_market_cash: number;
  over_limit_count: number;
  total_drivers_count: number;
  drivers: Array<{
    id: string;
    profile_id: number;
    name: string;
    username: string;
    phone_number: string;
    is_active: boolean;
    is_online: boolean;
    is_busy: boolean;
    vehicle_type: string;
    cash_in_hand: number;
    cod_max_ceiling: number;
    is_over_limit: boolean;
    limit_percent: number;
    total_delivered_orders: number;
    last_settlement?: {
      amount: number;
      date: string;
    } | null;
  }>;
  recent_settlements: SettlementRecord[];
}

export interface DriverRosterItem {
  id: string;
  profile_id: number;
  name: string;
  username: string;
  phone_number: string;
  is_active: boolean;
  is_online: boolean;
  is_busy: boolean;
  vehicle_type: string;
  vehicle_type_display: string;
  license_plate: string;
  cash_in_hand: number;
  is_over_limit: boolean;
  rating: number;
  total_delivered_orders: number;
  created_at: string;
}

export interface SupervisorMember {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: 'SUPERVISOR' | 'OPS_MANAGER' | 'ADMIN';
  role_display: string;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
  date_joined: string;
  assigned_zones: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
  }>;
  metrics: {
    dispatches_today: number;
    settlements_today: number;
  };
}

export interface AuditLogEntry {
  id: string;
  action_type: string;
  action_label: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  target_type: string;
  target_id: string;
  target_name: string;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface PendingApprovalItem {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  supervisor_id: string | null;
  supervisor_name: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes: string;
  created_at: string;
}

export interface DeliveryZoneItem {
  id: string;
  name: string;
  code: string;
  city: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
  drivers_count: number;
  supervisors: Array<{
    id: string;
    name: string;
  }>;
  created_at: string;
}

export interface OpsAnalyticsData {
  team: {
    total_supervisors: number;
    active_supervisors: number;
    actions_today: number;
  };
  dispatches: {
    manual_dispatches_today: number;
  };
  cash: {
    pending_approvals_count: number;
    approved_settlements_today: number;
  };
  leaderboard: Array<{
    id: string;
    name: string;
    role: string;
    dispatches: number;
    settlements: number;
    approved_drivers: number;
    total_actions: number;
  }>;
  zones: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
    radius_km: number;
    drivers_count: number;
    supervisors_count: number;
  }>;
  recent_events: Array<{
    id: string;
    action_label: string;
    actor_name: string;
    target_name: string;
    created_at: string;
  }>;
}
