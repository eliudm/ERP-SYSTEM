import { apiClient } from './client';

export interface CreateCreditNoteItem {
  productId: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CreateCreditNotePayload {
  customerId: string;
  invoiceId?: string;
  reason?: string;
  items: CreateCreditNoteItem[];
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED';
  total: number | string;
}

export const creditNotesApi = {
  create: async (data: CreateCreditNotePayload): Promise<CreditNote> => {
    const res = await apiClient.post('/sales/credit-notes', data);
    return res.data;
  },

  approve: async (creditNoteId: string): Promise<CreditNote> => {
    const res = await apiClient.post(
      `/sales/credit-notes/${creditNoteId}/approve`,
    );
    return res.data;
  },
};
