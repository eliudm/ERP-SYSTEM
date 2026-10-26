import { apiClient } from './client';

export interface EtimsQrResult {
  invoiceId: string;
  qrCode?: string;
  etimsInvoiceNo?: string;
  provisional: boolean;
  status: string;
  message?: string;
}

export interface EtimsStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: string;
}

export interface EtimsFailedSubmission {
  id: string;
  invoiceId: string;
  status: string;
  retryCount: number;
  etimsInvoiceNo?: string;
  updatedAt: string;
  invoice: {
    invoiceNo: string;
    total: number;
    customer?: { name: string } | null;
  };
  submissionLogs: { errorMessage?: string; createdAt: string }[];
}

export interface EtimsQueueStatus {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export const etimsApi = {
  getQRCode: async (invoiceId: string): Promise<EtimsQrResult> => {
    const res = await apiClient.get(`/etims/invoice/${invoiceId}/qr`);
    return res.data;
  },

  getStatus: async (invoiceId: string) => {
    const res = await apiClient.get(`/etims/invoice/${invoiceId}/status`);
    return res.data;
  },

  getStats: async (): Promise<EtimsStats> => {
    const res = await apiClient.get('/etims/stats');
    return res.data;
  },

  getFailedSubmissions: async (): Promise<EtimsFailedSubmission[]> => {
    const res = await apiClient.get('/etims/failed');
    return res.data;
  },

  getQueueStatus: async (): Promise<EtimsQueueStatus> => {
    const res = await apiClient.get('/etims/queue/status');
    return res.data;
  },

  retryAllFailed: async (): Promise<unknown> => {
    const res = await apiClient.post('/etims/queue/retry-all');
    return res.data;
  },

  retry: async (invoiceId: string): Promise<unknown> => {
    const res = await apiClient.post(`/etims/invoice/${invoiceId}/retry`);
    return res.data;
  },

  submit: async (invoiceId: string): Promise<unknown> => {
    const res = await apiClient.post(`/etims/invoice/${invoiceId}/submit`);
    return res.data;
  },
};
