import { apiClient } from './client';

export interface SystemSettings {
  companyName?: string;
  companyLogo?: string | null;
  companyPin?: string;
  companyAddress?: string;
  receiptSlogan?: string;
  posReceiptBranding?: boolean;
}

export const settingsApi = {
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await apiClient.get('/settings/system');
    return res.data;
  },
};
