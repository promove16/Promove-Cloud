import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';

export interface ActivityFeedItem {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorAvatar?: string;
  actorRole?: string;
  summary: string;
  createdAt: string;
}

export const activityApi = {
  forStartup: (startupId: string, limit = 50) =>
    api.get<ApiSuccessResponse<{ items: ActivityFeedItem[] }>>(
      `/api/activity-feed/startup/${startupId}?limit=${limit}`,
    ),

  myRecent: () =>
    api.get<ApiSuccessResponse<{ items: unknown[] }>>(`/api/activity-feed/me/recent`),
};
