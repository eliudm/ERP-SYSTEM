import { apiClient } from './client';
import type { Account, JournalEntry, PaginatedResponse } from '../types';

export const accountingApi = {
  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const res = await apiClient.get('/accounting/accounts');
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
};
