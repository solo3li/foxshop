export interface User {
  id: string;
  username: string;
  phone_number?: string;
  role: 'CUSTOMER' | 'MERCHANT' | 'DRIVER' | 'ADMIN';
  first_name?: string;
  last_name?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  cover_image: string | null;
  store_type?: 'RESTAURANT' | 'SUPERMARKET' | 'PHARMACY' | 'BUTCHERY_VEG' | 'FLOWERS_GIFTS' | 'GENERAL_RETAIL' | string;
  delivery_mode?: 'PLATFORM_MANAGED' | 'STORE_OWN_FLEET' | string;
  rating: number;
  rating_count: number;
  delivery_fee: number;
  estimated_prep_time_minutes: number;
  currency: string;
  is_busy: boolean;
  is_active?: boolean;
  status?: 'OPEN' | 'BUSY' | 'CLOSED';
  address_text?: string;
  address?: string;
}

export interface OperatingHour {
  day: number;
  day_name?: string;
  opening_time: string;
  closing_time: string;
  is_closed: boolean;
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price_delta: number;
}

export interface OrderItem {
  id: string;
  menu_item?: string;
  item_name?: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  requested_weight?: number;
  actual_weight?: number;
  is_weighted?: boolean;
  pricing_unit?: 'PIECE' | 'KG' | 'GRAM' | 'LITER' | string;
  special_instructions?: string;
  modifiers?: OrderItemModifier[];
}

export interface DeliveryInfo {
  id: string;
  status: string;
  status_display?: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  delivery_otp?: string;
  picked_up_at?: string | null;
  completed_at?: string | null;
}

export interface OrderStatusHistoryItem {
  id: string;
  status: string;
  note: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number?: string;
  pickup_code?: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  status_display?: string;
  customer_name: string;
  customer_phone?: string;
  delivery_address_display?: string;
  delivery_address_snapshot?: any;
  delivery_info?: DeliveryInfo | null;
  status_history?: OrderStatusHistoryItem[];
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  preauth_hold_amount?: number;
  total_amount: number;
  restaurant_delivery_mode?: string;
  restaurant_store_type?: string;
  is_weight_confirmed?: boolean;
  is_settled_with_merchant?: boolean;
  payment_method: string;
  payment_status?: string;
  currency?: string;
  is_paid?: boolean;
  notes?: string;
  customer_notes?: string;
  prep_time_minutes?: number;
  created_at: string;
  items: OrderItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  base_price: number | string;
  pricing_unit?: 'PIECE' | 'KG' | 'GRAM' | 'LITER' | string;
  barcode?: string;
  sku?: string;
  stock_quantity?: number;
  is_stock_tracked?: boolean;
  image: string | null;
  is_available: boolean;
  is_popular: boolean;
  category?: string;
  category_id?: string;
  category_name?: string;
}

export interface ShiftSettlement {
  id: string;
  restaurant: string;
  restaurant_name?: string;
  restaurant_address?: string;
  driver: string;
  driver_name?: string;
  driver_phone?: string;
  orders_count: number;
  total_goods_amount: number;
  platform_commission_amount: number;
  otp_code: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  status_display?: string;
  settled_at?: string | null;
  created_at: string;
  orders_list?: {
    id: string;
    order_number: string;
    subtotal: number;
    total_amount: number;
    created_at: string;
  }[];
}

export interface UnsettledDriver {
  driver_id: string;
  driver_name: string;
  phone_number: string;
  orders_count: number;
  total_goods_amount: number;
  order_ids: string[];
}

export interface MenuCategory {
  id: string;
  restaurant?: string;
  name: string;
  order: number;
  items_count?: number;
  items?: MenuItem[];
}

export interface TicketMessage {
  id: string;
  ticket: string;
  sender: string;
  sender_name: string;
  sender_role: 'CUSTOMER' | 'MERCHANT' | 'DRIVER' | 'ADMIN' | 'STAFF' | string;
  message_text: string;
  attachment?: string | null;
  attachment_type?: 'image' | 'audio' | 'video' | 'file' | null;
  is_internal_note?: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user: string;
  user_name: string;
  user_role: string;
  order?: string | null;
  order_number?: string | null;
  category: 'ORDER_ISSUE' | 'DELIVERY_DELAY' | 'FOOD_QUALITY' | 'PAYMENT_DISPUTE' | 'DRIVER_ISSUE' | 'MERCHANT_INQUIRY' | 'OTHER';
  category_display?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority_display?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  status_display?: string;
  subject: string;
  assigned_agent?: string | null;
  assigned_agent_name?: string | null;
  last_message?: {
    sender_name: string;
    message_text: string;
    created_at: string;
  } | null;
  messages?: TicketMessage[];
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  type_display?: string;
  discount_value: number | string;
  min_order_amount: number | string;
  max_discount_amount?: number | string | null;
  first_order_only: boolean;
  is_active: boolean;
  valid_from: string;
  valid_to: string;
  max_usage_per_user: number;
  usage_count: number;
  funded_by: 'PLATFORM' | 'MERCHANT';
  restaurant?: string;
  restaurant_name?: string;
}
