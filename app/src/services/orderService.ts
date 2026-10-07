import { api, ApiResponse } from './api';

export interface Address {
  id: string;
  title: string;
  street: string;
  building_number?: string;
  floor?: string;
  apartment_number?: string;
  delivery_instructions?: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

export interface OrderItemInput {
  menu_item_id: string;
  quantity: number;
  modifier_ids?: string[];
}

export interface CheckoutPayload {
  restaurant_id: string;
  delivery_address_id: string;
  payment_method?: 'COD' | 'ONLINE' | 'WALLET';
  customer_notes?: string;
  items: OrderItemInput[];
}

export interface OrderResponse {
  id: string;
  order_number: string;
  restaurant_name: string;
  restaurant_logo?: string;
  status: string;
  status_display: string;
  total_amount: string | number;
  subtotal: string | number;
  delivery_fee: string | number;
  created_at: string;
}

export const orderService = {
  // Get all user addresses
  async getAddresses(): Promise<ApiResponse<Address[]>> {
    return api.get<Address[]>('/api/v1/auth/addresses/');
  },

  // Create a new address
  async createAddress(addressData: Partial<Address>): Promise<ApiResponse<Address>> {
    return api.post<Address>('/api/v1/auth/addresses/', addressData);
  },

  // Ensure customer has at least one valid address in delivery range
  async ensureDefaultAddress(): Promise<Address | null> {
    const res = await this.getAddresses();
    if (res.data && res.data.length > 0) {
      const defaultAddr = res.data.find(a => a.is_default) || res.data[0];
      return defaultAddr;
    }

    // Auto-create a default address in central delivery zone
    const created = await this.createAddress({
      title: 'المنزل',
      street: 'طريق الملك فهد، الرياض',
      building_number: '12',
      floor: '3',
      apartment_number: '10',
      delivery_instructions: 'يرجى ترك الطلب عند الباب',
      latitude: 24.7136,
      longitude: 46.6753,
      is_default: true,
    });

    return created.data;
  },

  // Submit checkout order
  async checkout(payload: CheckoutPayload): Promise<ApiResponse<OrderResponse>> {
    return api.post<OrderResponse>('/api/v1/customer/orders/checkout/', payload);
  },

  // Get customer order history
  async getOrderHistory(): Promise<ApiResponse<OrderResponse[]>> {
    const res = await api.get<any>('/api/v1/customer/orders/history/');
    if (res.data) {
      const orders = Array.isArray(res.data) ? res.data : (res.data.results || []);
      return { ...res, data: orders };
    }
    return res;
  },

  // Get order tracking details
  async getOrderDetails(orderId: string): Promise<ApiResponse<OrderResponse>> {
    return api.get<OrderResponse>(`/api/v1/customer/orders/${orderId}/`);
  },

  // Cancel order
  async cancelOrder(orderId: string): Promise<ApiResponse<{ message: string }>> {
    return api.post<{ message: string }>(`/api/v1/customer/orders/${orderId}/cancel/`, {});
  },
};
