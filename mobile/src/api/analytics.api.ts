import { apiClient } from './client';

export interface ProfitAndLoss {
  period: { startDate: string; endDate: string };
  revenue: {
    lines: { code: string; name: string; amount: number }[];
    total: number;
  };
  expenses: {
    lines: { code: string; name: string; amount: number }[];
    total: number;
  };
  grossProfit: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface ProfitTrendPoint {
  period: string;
  revenue: number;
  expense: number;
  profit: number;
}

export interface ProfitTrend {
  granularity: 'day' | 'month';
  range: { start: string; end: string };
  data: ProfitTrendPoint[];
  totals: { revenue: number; expense: number; profit: number; margin: number };
}

export interface TopProduct {
  productId: string;
  code: string;
  name: string;
  revenue: number;
  quantitySold: number;
}

export interface TopCustomer {
  customerId: string;
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

export const analyticsApi = {
  getProfitAndLoss: async (
    startDate: string,
    endDate: string,
  ): Promise<ProfitAndLoss> => {
    const res = await apiClient.get('/accounting/reports/profit-and-loss', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getProfitTrend: async (
    startDate: string,
    endDate: string,
    granularity: 'day' | 'month' = 'month',
  ): Promise<ProfitTrend> => {
    const res = await apiClient.get('/analytics/profit-trend', {
      params: { startDate, endDate, granularity },
    });
    return res.data;
  },

  getTopProducts: async (
    startDate: string,
    endDate: string,
    limit = 5,
  ): Promise<{ data: TopProduct[] }> => {
    const res = await apiClient.get('/analytics/top-products', {
      params: { startDate, endDate, limit },
    });
    return res.data;
  },

  getTopCustomers: async (
    startDate: string,
    endDate: string,
    limit = 5,
  ): Promise<{ data: TopCustomer[] }> => {
    const res = await apiClient.get('/analytics/top-customers', {
      params: { startDate, endDate, limit },
    });
    return res.data;
  },
};
