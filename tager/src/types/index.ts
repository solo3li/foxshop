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
  status?: 'ACTIVE' | 'BUSY' | 'CLOSED';
  address?: string;
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

export interface Order {
  id: string;
  order_number?: string;
  pickup_code?: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  customer_name: string;
  customer_phone?: string;
  delivery_address_display?: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  is_paid: boolean;
  notes?: string;
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
  category_id?: string;
  category_name?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  items: MenuItem[];
}
