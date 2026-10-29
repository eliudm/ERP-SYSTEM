import { apiClient } from './client';

export type ReceiptTemplate = 'standard' | 'compact' | 'branded';
export type InvoiceTemplate = 'modern' | 'classic' | 'minimal';

export interface SystemSettings {
  companyName?: string;
  companyLogo?: string | null;
  companyPin?: string;
  companyAddress?: string;
  companyPhone?: string;
  paymentInstructions?: string;
  receiptSlogan?: string;
  posReceiptBranding?: boolean;
  receiptTemplate?: ReceiptTemplate;
  invoiceTemplate?: InvoiceTemplate;
  defaultLanguage?: string;
}

export const settingsApi = {
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await apiClient.get('/settings/system');
    return res.data;
  },
};
