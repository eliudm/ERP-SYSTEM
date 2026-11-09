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
  // Offline-queue sale id — lets the backend dedupe a retried sync instead
  // of creating a duplicate draft. See InvoicesService.create() (clientRef).
  clientRef?: string;
  items: CreateInvoiceItem[];
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  status: string;
  total: number;
}

export interface MpesaTransactionStatus {
  invoice: {
    id: string;
    invoiceNo: string;
    status: string;
    paymentMethod: string | null;
    paidAt: string | null;
  };
  mpesa: {
    status: string;
    resultCode?: number;
    resultDesc?: string;
    receiptNumber?: string;
  } | null;
}

export interface PendingMpesaTransaction {
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
}

export interface DailySummary {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  byPaymentMethod: { method: string; amount: number; orders: number }[];
}

export interface InvoiceDetailItem {
  id: string;
  productId: string;
  product: { id: string; name: string; code: string };
  description: string | null;
  quantity: number | string;
  unitPrice: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  lineTotal: number | string;
}

export interface InvoiceCreditNoteRef {
  id: string;
  creditNoteNumber: string;
  status: 'DRAFT' | 'APPROVED' | 'APPLIED';
  total: number | string;
}

export interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
  notes: string | null;
  paymentMethod: string | null;
  customer: {
    id: string;
    name: string;
    address?: string | null;
    taxPin?: string | null;
  } | null;
  items: InvoiceDetailItem[];
  etimsInvoice: {
    status: string;
    qrCode: string | null;
    etimsInvoiceNo: string | null;
  } | null;
  creditNotes: InvoiceCreditNoteRef[];
}

export const salesApi = {
  createInvoice: async (data: CreateInvoicePayload): Promise<Invoice> => {
    const res = await apiClient.post('/sales/invoices', data);
    return res.data;
  },

  approveInvoice: async (
    invoiceId: string,
    data: { warehouseId?: string; paymentMethod?: string },
  ): Promise<Invoice> => {
    const res = await apiClient.patch(
      `/sales/invoices/${invoiceId}/approve`,
      data,
    );
    return res.data;
  },

  initiateMpesaStkPush: async (
    invoiceId: string,
    data: {
      phoneNumber: string;
      accountReference?: string;
      description?: string;
      amount?: number;
    },
  ): Promise<void> => {
    await apiClient.post(`/sales/invoices/${invoiceId}/mpesa/stk-push`, data);
  },

  getMpesaStatus: async (
    invoiceId: string,
  ): Promise<MpesaTransactionStatus> => {
    const res = await apiClient.get(
      `/sales/invoices/${invoiceId}/mpesa/status`,
    );
    return res.data;
  },

  getPendingMpesaTransactions: async (
    status?: 'PENDING' | 'FAILED',
  ): Promise<PendingMpesaTransaction[]> => {
    const res = await apiClient.get('/sales/invoices/mpesa/pending', {
      params: { status },
    });
    return res.data;
  },

  retryMpesaTransaction: async (transactionId: string): Promise<void> => {
    await apiClient.post(
      `/sales/invoices/mpesa/transactions/${transactionId}/retry`,
    );
  },

  reconcileMpesaTransaction: async (
    transactionId: string,
    data: {
      receiptNumber: string;
      phoneNumber?: string;
      amount?: number;
      notes?: string;
    },
  ): Promise<void> => {
    await apiClient.patch(
      `/sales/invoices/mpesa/transactions/${transactionId}/reconcile`,
      data,
    );
  },

  getPendingTillPayments: async (): Promise<
    Array<{
      id: string;
      transId: string;
      transTime: string;
      amount: number;
      msisdn: string;
      payerName: string;
      billRefNumber?: string;
    }>
  > => {
    const res = await apiClient.get('/sales/invoices/mpesa/till/pending');
    return res.data;
  },

  matchTillPayment: async (
    tillPaymentId: string,
    invoiceId: string,
  ): Promise<void> => {
    await apiClient.post(`/sales/invoices/mpesa/till/${tillPaymentId}/match`, {
      invoiceId,
    });
  },

  getDailySummary: async (date: string): Promise<DailySummary> => {
    const res = await apiClient.get('/sales/invoices/daily-summary', {
      params: { date },
    });
    return res.data;
  },

  getInvoice: async (invoiceId: string): Promise<InvoiceDetail> => {
    const res = await apiClient.get(`/sales/invoices/${invoiceId}`);
    return res.data;
  },

  getOutstandingCredit: async (): Promise<Array<{
    id: string;
    invoiceNo: string;
    invoiceDate: string;
    customer: { id: string; name: string; phone?: string } | null;
    total: number;
    amountPaid: number;
    balance: number;
  }>> => {
    const res = await apiClient.get('/sales/invoices/credit/outstanding');
    return res.data;
  },

  getCreditPayments: async (invoiceId: string): Promise<Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    createdAt: string;
    recordedBy?: { firstName: string; lastName: string };
  }>> => {
    const res = await apiClient.get(`/sales/invoices/${invoiceId}/credit-payments`);
    return res.data;
  },

  recordCreditPayment: async (
    invoiceId: string,
    dto: { amount: number; paymentMethod: string; notes?: string },
  ): Promise<void> => {
    await apiClient.post(`/sales/invoices/${invoiceId}/credit-payments`, dto);
  },

  openPosSession: async (branchId?: string | null): Promise<{ id: string; sessionRef: string; openedAt: string }> => {
    const res = await apiClient.post('/sales/pos-sessions/open', branchId ? { branchId } : {});
    return res.data;
  },

  closePosSession: async (
    sessionId: string,
    dto: { closingNote?: string; closingCounts?: Record<string, number> },
  ): Promise<void> => {
    await apiClient.post(`/sales/pos-sessions/${sessionId}/close`, dto);
  },

  getPosSessionSummary: async (sessionId: string): Promise<{
    sessionId: string;
    sessionRef: string;
    openedAt: string;
    totalOrders: number;
    totalRevenue: number;
    byPaymentMethod: { method: string; amount: number; orders: number }[];
  }> => {
    const res = await apiClient.get(`/sales/pos-sessions/${sessionId}/summary`);
    return res.data;
  },

  getCustomerStatement: async (customerId: string): Promise<{
    customer: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      taxPin?: string | null;
      invoices: Array<{
        id: string;
        invoiceNo: string;
        invoiceDate: string;
        total: number | string;
        status: string;
        paymentMethod?: string | null;
        creditPayments: Array<{ id: string; amount: number | string; paymentMethod: string; createdAt: string }>;
      }>;
    };
    summary: {
      totalInvoices: number;
      totalBilled: number;
      totalPaid: number;
      outstandingBalance: number;
    };
  }> => {
    const res = await apiClient.get(`/sales/customers/${customerId}/statement`);
    return res.data;
  },
};
