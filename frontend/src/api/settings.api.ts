import { apiClient } from './client';
import type { SystemSettings } from '../types';

export const MODULE_KEYS = [
  'pos', 'sales', 'accounting', 'inventory', 'procurement',
  'hr', 'etims', 'contacts', 'crm', 'mrp', 'analytics',
  'aiInsights', 'approvals', 'notifications', 'messaging', 'support', 'help',
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];
export type ModuleConfig = Record<ModuleKey, boolean>;

export const settingsApi = {
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await apiClient.get('/settings/system');
    return res.data;
  },

  updateSystemSettings: async (data: Partial<SystemSettings>): Promise<SystemSettings> => {
    const res = await apiClient.patch('/settings/system', data);
    return res.data;
  },

  getModuleConfig: async (): Promise<ModuleConfig> => {
    const res = await apiClient.get('/settings/modules');
    return res.data;
  },

  updateModuleConfig: async (data: Partial<ModuleConfig>): Promise<ModuleConfig> => {
    const res = await apiClient.patch('/settings/modules', data);
    return res.data;
  },
};
