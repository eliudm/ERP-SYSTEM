import { apiClient } from './client';

export interface Notification {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SYSTEM';
  title: string;
  message: string;
  productId?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },
  getUnread: async (): Promise<Notification[]> => {
    const res = await apiClient.get('/notifications/unread');
    return res.data;
  },
  getAll: async (page = 1, limit = 20): Promise<{ data: Notification[]; total: number }> => {
    const res = await apiClient.get('/notifications', { params: { page, limit } });
    return res.data;
  },
  markRead: async (id: string): Promise<Notification> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/mark-all-read');
  },
};
