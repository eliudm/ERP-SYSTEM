import { apiClient } from './client';

export type ReceiptTemplate = 'standard' | 'compact' | 'branded';

export interface SystemSettings {
  companyName?: string;
  companyLogo?: string | null;
  companyPin?: string;
  companyAddress?: string;
  receiptSlogan?: string;
  posReceiptBranding?: boolean;
  receiptTemplate?: ReceiptTemplate;
}

export const settingsApi = {
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await apiClient.get('/settings/system');
    return res.data;
  },
};
