import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { NotificationItem } from '../types/notification.types';

export const notificationApi = {
  async list(before?: string, limit = 20) {
    const response = await api.get<ApiSuccessResponse<NotificationItem[]>>('/api/notifications', {
      params: { before, limit },
    });
    return response.data.data;
  },
  async markRead(notificationId: string) {
    const response = await api.patch<ApiSuccessResponse<NotificationItem>>(`/api/notifications/${notificationId}/read`);
    return response.data.data;
  },
  async markAllRead() {
    const response = await api.patch<ApiSuccessResponse<{ updated: true }>>('/api/notifications/read-all');
    return response.data.data;
  },
};
