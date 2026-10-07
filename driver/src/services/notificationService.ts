import { api } from './api';

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  notification_type: 'order' | 'promo' | 'system';
  order: string | null;
  order_number: string | null;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface DriverNotificationResponse {
  unread_count: number;
  notifications: DriverNotification[];
}

export const driverNotificationService = {
  async getNotifications() {
    return api.get<DriverNotificationResponse>('/api/v1/notifications/');
  },

  async markAsRead(id: string) {
    return api.post<{ status: string; id: string }>(`/api/v1/notifications/${id}/mark-read/`);
  },

  async markAllAsRead() {
    return api.post<{ status: string; updated_count: number }>('/api/v1/notifications/mark-all-read/');
  },

  async clearAll() {
    return api.post<{ status: string; deleted_count: number }>('/api/v1/notifications/clear-all/');
  },
};
