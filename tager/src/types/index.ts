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
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
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
  total_amount: number;
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
  image: string | null;
  is_available: boolean;
  is_popular: boolean;
  category?: string;
  category_id?: string;
  category_name?: string;
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
