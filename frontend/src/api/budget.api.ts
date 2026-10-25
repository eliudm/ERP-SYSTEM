import { apiClient } from './client';

export type BudgetStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface BudgetLineAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  accountId: string;
  month: number;
  amount: number;
  notes?: string | null;
  account?: BudgetLineAccount;
}

export interface Budget {
  id: string;
  tenantId: string;
  name: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: BudgetStatus;
  notes?: string | null;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines: BudgetLine[];
  _count?: { lines: number };
}

export interface CreateBudgetLinePayload {
  accountId: string;
  month: number;
  amount: number;
  notes?: string;
}

export interface CreateBudgetPayload {
  name: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  notes?: string;
  lines?: CreateBudgetLinePayload[];
}

export type UpdateBudgetPayload = Partial<
  Pick<CreateBudgetPayload, 'name' | 'fiscalYear' | 'startDate' | 'endDate' | 'notes'>
>;

export interface BudgetVsActualRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePct: number;
}

export interface BudgetVsActual {
  budget: { id: string; name: string; fiscalYear: number };
  period: { startDate: string; endDate: string };
  rows: BudgetVsActualRow[];
  summary: {
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    utilizationPct: number;
  };
}

export const budgetApi = {
  getBudgets: async (fiscalYear?: number, status?: BudgetStatus): Promise<Budget[]> => {
    const res = await apiClient.get('/budgets', {
      params: {
        ...(fiscalYear ? { fiscalYear } : {}),
        ...(status ? { status } : {}),
      },
    });
    return res.data;
  },

  getBudget: async (id: string): Promise<Budget> => {
    const res = await apiClient.get(`/budgets/${id}`);
    return res.data;
  },

  createBudget: async (data: CreateBudgetPayload): Promise<Budget> => {
    const res = await apiClient.post('/budgets', data);
    return res.data;
  },

  updateBudget: async (id: string, data: UpdateBudgetPayload): Promise<Budget> => {
    const res = await apiClient.patch(`/budgets/${id}`, data);
    return res.data;
  },

  setStatus: async (id: string, status: BudgetStatus): Promise<Budget> => {
    const res = await apiClient.patch(`/budgets/${id}/status`, { status });
    return res.data;
  },

  addLines: async (id: string, lines: CreateBudgetLinePayload[]): Promise<{ upserted: number }> => {
    const res = await apiClient.post(`/budgets/${id}/lines`, lines);
    return res.data;
  },

  deleteLine: async (id: string, lineId: string): Promise<{ deleted: boolean }> => {
    const res = await apiClient.delete(`/budgets/${id}/lines/${lineId}`);
    return res.data;
  },

  getBudgetVsActual: async (id: string): Promise<BudgetVsActual> => {
    const res = await apiClient.get(`/budgets/${id}/vs-actual`);
    return res.data;
  },
};
