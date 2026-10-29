import { apiClient } from './client';
import type { Account, Expense, JournalEntry, PaginatedResponse } from '../types';

export const accountingApi = {
  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const res = await apiClient.get('/accounting/accounts');
    return res.data;
  },

  getAccountsByType: async (type: string): Promise<Account[]> => {
    const res = await apiClient.get(`/accounting/accounts/by-type/${type}`);
    return res.data;
  },

  createAccount: async (data: Partial<Account>): Promise<Account> => {
    const res = await apiClient.post('/accounting/accounts', data);
    return res.data;
  },

  seedAccounts: async () => {
    const res = await apiClient.post('/accounting/accounts/seed');
    return res.data;
  },

  getAccountBalance: async (id: string) => {
    const res = await apiClient.get(`/accounting/accounts/${id}/balance`);
    return res.data;
  },

  // Journal Entries
  getJournalEntries: async (
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<JournalEntry>> => {
    const res = await apiClient.get('/accounting/journal-entries', {
      params: { page, limit },
    });
    return res.data;
  },

  createJournalEntry: async (data: any): Promise<JournalEntry> => {
    const res = await apiClient.post('/accounting/journal-entries', data);
    return res.data;
  },

  voidJournalEntry: async (id: string, reason: string): Promise<JournalEntry> => {
    const res = await apiClient.post(`/accounting/journal-entries/${id}/void`, { reason });
    return res.data;
  },

  // Reports
  getTrialBalance: async () => {
    const res = await apiClient.get('/accounting/reports/trial-balance');
    return res.data;
  },

  getProfitAndLoss: async (startDate: string, endDate: string) => {
    const res = await apiClient.get('/accounting/reports/profit-and-loss', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getBalanceSheet: async (asOf?: string) => {
    const res = await apiClient.get('/accounting/reports/balance-sheet', {
      params: { asOf },
    });
    return res.data;
  },

  getCashFlow: async (startDate: string, endDate: string) => {
    const res = await apiClient.get('/accounting/reports/cash-flow', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getAgedReceivables: async () => {
    const res = await apiClient.get('/accounting/reports/aged-receivables');
    return res.data;
  },

  getAgedPayables: async () => {
    const res = await apiClient.get('/accounting/reports/aged-payables');
    return res.data;
  },

  getGeneralLedger: async (
    accountId: string,
    startDate: string,
    endDate: string,
  ) => {
    const res = await apiClient.get('/accounting/reports/general-ledger', {
      params: { accountId, startDate, endDate },
    });
    return res.data;
  },

  getPaymentModesReport: async (
    startDate: string,
    endDate: string,
    paymentMethod?: string,
  ) => {
    const res = await apiClient.get('/accounting/reports/payment-modes', {
      params: { startDate, endDate, paymentMethod },
    });
    return res.data;
  },

  // Expenses
  getExpenses: async (
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<PaginatedResponse<Expense>> => {
    const res = await apiClient.get('/accounting/expenses', {
      params: { page, limit, status },
    });
    return res.data;
  },

  createExpense: async (data: {
    date: string;
    accountId: string;
    payee: string;
    amount: number;
    description?: string;
    notes?: string;
  }): Promise<Expense> => {
    const res = await apiClient.post('/accounting/expenses', data);
    return res.data;
  },

  approveExpense: async (
    id: string,
    data: { alreadyPaid?: boolean; cashAccountId?: string; paymentMethod?: string },
  ): Promise<Expense> => {
    const res = await apiClient.post(`/accounting/expenses/${id}/approve`, data);
    return res.data;
  },

  payExpense: async (
    id: string,
    data: { cashAccountId: string; paymentMethod?: string },
  ): Promise<Expense> => {
    const res = await apiClient.post(`/accounting/expenses/${id}/pay`, data);
    return res.data;
  },

  voidExpense: async (id: string): Promise<Expense> => {
    const res = await apiClient.patch(`/accounting/expenses/${id}/void`);
    return res.data;
  },
};
