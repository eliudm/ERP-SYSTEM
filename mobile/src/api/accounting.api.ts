import { apiClient } from './client';

export interface AccountBalance {
  code: string;
  name: string;
  balance: number;
}

export interface BalanceSheet {
  asOf: string;
  assets: { accounts: AccountBalance[]; total: number };
  liabilities: { accounts: AccountBalance[]; total: number };
  equity: {
    accounts: AccountBalance[];
    retainedEarnings: number;
    total: number;
  };
  isBalanced: boolean;
}

export interface CashFlow {
  period: { startDate: string; endDate: string };
  operating: { total: number; transactions: unknown[] };
  investing: { total: number; transactions: unknown[] };
  financing: { total: number; transactions: unknown[] };
  netChange: number;
}

export interface AgedBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
}

export interface AgedReceivableRow {
  invoiceNo: string;
  customer: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  outstanding: number;
}

export interface AgedReceivables {
  rows: AgedReceivableRow[];
  summary: AgedBucket;
  totalOutstanding: number;
}

export interface AgedPayableRow {
  billNumber: string;
  supplier: string;
  billDate: string;
  dueDate: string;
  daysOverdue: number;
  outstanding: number;
}

export interface AgedPayables {
  rows: AgedPayableRow[];
  summary: AgedBucket;
  totalOutstanding: number;
}

export interface VatReturn {
  period: { startDate: string; endDate: string };
  outputVat: {
    taxableSupplies: number;
    vatAmount: number;
    invoiceCount: number;
  };
  inputVat: { taxablePurchases: number; vatAmount: number; billCount: number };
  vatPayable: number;
}

export const accountingApi = {
  getBalanceSheet: async (asOf?: string): Promise<BalanceSheet> => {
    const res = await apiClient.get('/accounting/reports/balance-sheet', {
      params: { asOf },
    });
    return res.data;
  },

  getCashFlow: async (
    startDate: string,
    endDate: string,
  ): Promise<CashFlow> => {
    const res = await apiClient.get('/accounting/reports/cash-flow', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getAgedReceivables: async (): Promise<AgedReceivables> => {
    const res = await apiClient.get('/accounting/reports/aged-receivables');
    return res.data;
  },

  getAgedPayables: async (): Promise<AgedPayables> => {
    const res = await apiClient.get('/accounting/reports/aged-payables');
    return res.data;
  },

  getVatReturn: async (
    startDate: string,
    endDate: string,
  ): Promise<VatReturn> => {
    const res = await apiClient.get('/accounting/reports/vat-return', {
      params: { startDate, endDate },
    });
    return res.data;
  },
};
