import { apiClient } from './client';

export interface CreateInvoiceItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  description?: string;
}

export interface CreateInvoicePayload {
  customerId: string;
  invoiceDate: string;
  paymentMethod?: string;
  notes?: string;
  items: CreateInvoiceItem[];
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  status: string;
  total: number;
}

export const salesApi = {
  createInvoice: async (data: CreateInvoicePayload): Promise<Invoice> => {
    const res = await apiClient.post('/sales/invoices', data);
    return res.data;
  },
};
