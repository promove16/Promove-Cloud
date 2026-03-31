import api from './axiosInstance';
import type { UserSettings, SettingsUpdate } from '../types/settings.types';
import type { ApiSuccessResponse } from '../types/auth.types';

export const settingsApi = {
  async getSettings(): Promise<UserSettings> {
    const response = await api.get<ApiSuccessResponse<UserSettings>>('/api/settings');
    return response.data.data;
  },

  async updateSettings(updates: SettingsUpdate): Promise<UserSettings> {
    const response = await api.put<ApiSuccessResponse<UserSettings>>('/api/settings', updates);
    return response.data.data;
  },
};
