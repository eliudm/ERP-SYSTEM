import { apiClient } from './client';
import type { Customer, Invoice, PaginatedResponse, PaymentMethod, Quote } from '../types';

export const salesApi = {
  // Customers
  getCustomers: async (search?: string): Promise<Customer[]> => {
    const res = await apiClient.get('/sales/customers', {
      params: { search },
    });
    return res.data;
  },

  createCustomer: async (data: Partial<Customer>): Promise<Customer> => {
    const res = await apiClient.post('/sales/customers', data);
    return res.data;
  },

  updateCustomer: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    const res = await apiClient.patch(`/sales/customers/${id}`, data);
    return res.data;
  },

  getCustomerStatement: async (id: string) => {
    const res = await apiClient.get(`/sales/customers/${id}/statement`);
    return res.data;
  },

  // Invoices
  getInvoices: async (
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<PaginatedResponse<Invoice>> => {
    const res = await apiClient.get('/sales/invoices', {
      params: { page, limit, status },
    });
    return res.data;
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const res = await apiClient.get(`/sales/invoices/${id}`);
    return res.data;
  },

  createInvoice: async (data: Record<string, unknown>): Promise<Invoice> => {
    const res = await apiClient.post('/sales/invoices', data);
    return res.data;
  },

  approveInvoice: async (id: string, warehouseId?: string, paymentMethod?: PaymentMethod): Promise<Invoice> => {
    const res = await apiClient.patch(`/sales/invoices/${id}/approve`, {
      ...(warehouseId && { warehouseId }),
      ...(paymentMethod && { paymentMethod }),
    });
    return res.data;
  },

  markAsPaid: async (id: string, paymentMethod: PaymentMethod = 'CASH'): Promise<Invoice> => {
    const res = await apiClient.patch(`/sales/invoices/${id}/paid`, { paymentMethod });
    return res.data;
  },

  initiateMpesaPayment: async (
    id: string,
    payload: { phoneNumber: string; accountReference?: string; description?: string },
  ): Promise<{ initiated: boolean; checkoutRequestId?: string; customerMessage?: string; message?: string }> => {
    const res = await apiClient.post(`/sales/invoices/${id}/mpesa/stk-push`, payload);
    return res.data;
  },

  getMpesaPaymentStatus: async (
    id: string,
  ): Promise<{
    invoice: {
      id: string;
      invoiceNo: string;
      status: 'DRAFT' | 'APPROVED' | 'SENT' | 'PAID' | 'VOID';
      paymentMethod?: PaymentMethod;
      paidAt?: string;
    };
    mpesa: {
      status: 'PENDING' | 'SUCCESS' | 'FAILED';
      checkoutRequestId?: string;
      receiptNumber?: string;
      resultCode?: number;
      resultDesc?: string;
      phoneNumber?: string;
      transactionDate?: string;
      updatedAt?: string;
    } | null;
  }> => {
    const res = await apiClient.get(`/sales/invoices/${id}/mpesa/status`);
    return res.data;
  },

  getPendingMpesaTransactions: async (): Promise<Array<{
    id: string;
    status: 'PENDING' | 'FAILED';
    phoneNumber: string;
    amount: number;
    checkoutRequestId?: string;
    receiptNumber?: string;
    resultCode?: number;
    resultDesc?: string;
    createdAt: string;
    updatedAt: string;
    invoice: {
      id: string;
      invoiceNo: string;
      status: string;
      total: number;
      customerName: string;
    };
  }>> => {
    const res = await apiClient.get('/sales/invoices/mpesa/pending');
    return res.data;
  },

  retryMpesaTransaction: async (transactionId: string) => {
    const res = await apiClient.post(
      `/sales/invoices/mpesa/transactions/${transactionId}/retry`,
    );
    return res.data;
  },

  reconcileMpesaTransaction: async (
    transactionId: string,
    payload: {
      receiptNumber: string;
      phoneNumber?: string;
      amount?: number;
      notes?: string;
    },
  ) => {
    const res = await apiClient.patch(
      `/sales/invoices/mpesa/transactions/${transactionId}/reconcile`,
      payload,
    );
    return res.data;
  },

  voidInvoice: async (id: string, reason: string): Promise<Invoice> => {
    const res = await apiClient.patch(`/sales/invoices/${id}/void`, { reason });
    return res.data;
  },

  getSalesSummary: async (startDate: string, endDate: string) => {
    const res = await apiClient.get('/sales/invoices/summary', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getMonthlySales: async (year: number) => {
    const res = await apiClient.get('/sales/invoices/monthly', { params: { year } });
    return res.data as { year: number; months: { month: string; revenue: number; paid: number; invoices: number }[] };
  },

  getDailySummary: async (date: string): Promise<{
    date: string;
    totalOrders: number;
    totalRevenue: number;
    byPaymentMethod: { method: string; amount: number; orders: number }[];
  }> => {
    const res = await apiClient.get('/sales/invoices/daily-summary', { params: { date } });
    return res.data;
  },

  // Quotes / Sales Orders
  getQuotes: async (page = 1, limit = 20, status?: string, customerId?: string): Promise<PaginatedResponse<Quote>> => {
    const res = await apiClient.get('/sales/quotes', { params: { page, limit, status, customerId } });
    return res.data;
  },

  getQuote: async (id: string): Promise<Quote> => {
    const res = await apiClient.get(`/sales/quotes/${id}`);
    return res.data;
  },

  createQuote: async (data: {
    customerId: string;
    validUntil?: string;
    notes?: string;
    items: { productId: string; description?: string; quantity: number; unitPrice: number; discount?: number; taxRate: number }[];
  }): Promise<Quote> => {
    const res = await apiClient.post('/sales/quotes', data);
    return res.data;
  },

  updateQuote: async (id: string, data: {
    customerId?: string;
    validUntil?: string;
    notes?: string;
    items?: { productId: string; description?: string; quantity: number; unitPrice: number; discount?: number; taxRate: number }[];
  }): Promise<Quote> => {
    const res = await apiClient.patch(`/sales/quotes/${id}`, data);
    return res.data;
  },

  sendQuote: async (id: string): Promise<Quote> => {
    const res = await apiClient.post(`/sales/quotes/${id}/send`);
    return res.data;
  },

  confirmQuote: async (id: string): Promise<Invoice> => {
    const res = await apiClient.post(`/sales/quotes/${id}/convert`);
    return res.data;
  },

  declineQuote: async (id: string): Promise<Quote> => {
    const res = await apiClient.patch(`/sales/quotes/${id}/decline`);
    return res.data;
  },

  sendQuoteByEmail: async (
    id: string,
    data: { to: string; subject: string; body: string },
  ): Promise<{ message: string; preview?: string }> => {
    const res = await apiClient.post(`/sales/quotes/${id}/email`, data);
    return res.data;
  },

  // Credit Notes
  getCreditNotes: async (page = 1, limit = 20, status?: string) => {
    const res = await apiClient.get('/sales/credit-notes', { params: { page, limit, status } });
    return res.data;
  },
  createCreditNote: async (data: any) => {
    const res = await apiClient.post('/sales/credit-notes', data);
    return res.data;
  },
  approveCreditNote: async (id: string) => {
    const res = await apiClient.patch(`/sales/credit-notes/${id}/approve`);
    return res.data;
  },
  applyCreditNote: async (id: string, invoiceId: string) => {
    const res = await apiClient.post(`/sales/credit-notes/${id}/apply/${invoiceId}`);
    return res.data;
  },

  // Price Lists
  getPriceLists: async () => {
    const res = await apiClient.get('/sales/price-lists');
    return res.data;
  },
  createPriceList: async (data: any) => {
    const res = await apiClient.post('/sales/price-lists', data);
    return res.data;
  },
  updatePriceList: async (id: string, data: any) => {
    const res = await apiClient.patch(`/sales/price-lists/${id}`, data);
    return res.data;
  },
  addPriceListItem: async (id: string, data: any) => {
    const res = await apiClient.post(`/sales/price-lists/${id}/items`, data);
    return res.data;
  },
  removePriceListItem: async (listId: string, itemId: string) => {
    await apiClient.delete(`/sales/price-lists/${listId}/items/${itemId}`);
  },
};
