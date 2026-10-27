import { apiClient } from './client';

export interface BranchComparisonEntry {
  branchId: string;
  name: string;
  code: string;
  totals: {
    invoices: number;
    paidInvoices: number;
    revenue: number;
  };
}

export interface BranchComparison {
  period: { from: string; to: string };
  branches: BranchComparisonEntry[];
}

export const branchesApi = {
  getComparison: async (
    from?: string,
    to?: string,
  ): Promise<BranchComparison> => {
    const res = await apiClient.get('/branches/comparison', {
      params: { from, to },
    });
    return res.data;
  },
};
