import { api } from './api';

export interface BackendNotification {
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

export interface NotificationListResponse {
  unread_count: number;
  notifications: BackendNotification[];
}

export const notificationService = {
  /**
   * Fetch current user's notifications list and unread count
   */
  async getNotifications() {
    return api.get<NotificationListResponse>('/api/v1/notifications/');
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string) {
    return api.post<{ status: string; id: string }>(`/api/v1/notifications/${id}/mark-read/`);
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    return api.post<{ status: string; updated_count: number }>('/api/v1/notifications/mark-all-read/');
  },

  /**
   * Clear / delete all user notifications
   */
  async clearAll() {
    return api.post<{ status: string; deleted_count: number }>('/api/v1/notifications/clear-all/');
  },
};
