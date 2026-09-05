import { apiClient } from './client';
import type { TaxRate, TaxGroup } from '../types';

export const taxApi = {
  // Rates
  getRates: async (type?: string, activeOnly = false): Promise<TaxRate[]> => {
    const res = await apiClient.get('/tax/rates', { params: { type, activeOnly: String(activeOnly) } });
    return res.data;
  },
  createRate: async (data: { name: string; rate: number; type: string; isDefault?: boolean; glAccountId?: string }): Promise<TaxRate> => {
    const res = await apiClient.post('/tax/rates', data);
    return res.data;
  },
  updateRate: async (id: string, data: Partial<{ name: string; rate: number; isDefault: boolean; isActive: boolean; glAccountId: string }>): Promise<TaxRate> => {
    const res = await apiClient.patch(`/tax/rates/${id}`, data);
    return res.data;
  },
  setDefaultRate: async (id: string): Promise<TaxRate> => {
    const res = await apiClient.post(`/tax/rates/${id}/set-default`);
    return res.data;
  },
  deactivateRate: async (id: string): Promise<TaxRate> => {
    const res = await apiClient.post(`/tax/rates/${id}/deactivate`);
    return res.data;
  },

  // Groups
  getGroups: async (): Promise<TaxGroup[]> => {
    const res = await apiClient.get('/tax/groups');
    return res.data;
  },
  createGroup: async (data: { name: string; description?: string; taxRateIds: string[] }): Promise<TaxGroup> => {
    const res = await apiClient.post('/tax/groups', data);
    return res.data;
  },
  updateGroup: async (id: string, data: Partial<{ name: string; description: string; taxRateIds: string[] }>): Promise<TaxGroup> => {
    const res = await apiClient.patch(`/tax/groups/${id}`, data);
    return res.data;
  },
  deleteGroup: async (id: string): Promise<void> => {
    await apiClient.delete(`/tax/groups/${id}`);
  },
};
