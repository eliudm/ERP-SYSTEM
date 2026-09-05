import { apiClient } from './client';
import type { SystemSettings } from '../types';

export const settingsApi = {
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await apiClient.get('/settings/system');
    return res.data;
  },

  updateSystemSettings: async (data: Partial<SystemSettings>): Promise<SystemSettings> => {
    const res = await apiClient.patch('/settings/system', data);
    return res.data;
  },
};
