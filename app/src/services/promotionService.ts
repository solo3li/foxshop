import { api, ApiResponse } from './api';

export interface CouponItem {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FLAT';
  type_display: string;
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  first_order_only: boolean;
  valid_to: string;
}

export interface ValidateCouponResponse {
  valid: boolean;
  code: string;
  discount_amount: number;
  final_subtotal: number;
  coupon: CouponItem;
}

export const promotionService = {
  async getCoupons(): Promise<ApiResponse<CouponItem[]>> {
    return api.get<CouponItem[]>('/api/v1/customer/promotions/');
  },

  async validateCoupon(code: string, subtotal: number = 100): Promise<ApiResponse<ValidateCouponResponse>> {
    return api.post<ValidateCouponResponse>('/api/v1/customer/promotions/validate/', {
      code,
      subtotal,
    });
  },
};
