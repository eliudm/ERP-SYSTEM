import { apiClient } from './client';

export type AnalyticsGranularity = 'day' | 'month';

export interface SalesTrendPoint {
  period: string;
  revenue: number;
  tax: number;
  count: number;
}

export interface SalesTrendResponse {
  granularity: AnalyticsGranularity;
  range: { start: string; end: string };
  data: SalesTrendPoint[];
  totals: { revenue: number; tax: number; count: number };
}

export interface ExpenseTrendPoint {
  period: string;
  amount: number;
}

export interface ExpenseTrendResponse {
  granularity: AnalyticsGranularity;
  range: { start: string; end: string };
  data: ExpenseTrendPoint[];
  total: number;
}

export interface ProfitTrendPoint {
  period: string;
  revenue: number;
  expense: number;
  profit: number;
}

export interface ProfitTrendResponse {
  granularity: AnalyticsGranularity;
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

export interface TopProductsResponse {
  period: { start: string; end: string };
  limit: number;
  data: TopProduct[];
}

export interface TopCustomer {
  customerId: string;
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

export interface TopCustomersResponse {
  period: { start: string; end: string };
  limit: number;
  data: TopCustomer[];
}

export interface PaymentMethodBreakdown {
  paymentMethod: string;
  count: number;
  amount: number;
}

export interface SalesByPaymentMethodResponse {
  period: { start: string; end: string };
  data: PaymentMethodBreakdown[];
  total: number;
}

export interface InventoryCategorySummary {
  category: string;
  count: number;
  totalValue: number;
  lowStockCount: number;
}

export interface InventorySummaryResponse {
  totalProducts: number;
  totalValue: number;
  totalLowStock: number;
  byCategory: InventoryCategorySummary[];
}

export interface KpiMetric {
  value: number;
  change: number | null; // % change vs prior period, null if no prior data
}

export interface KpiSummary {
  revenue: KpiMetric;
  invoiceCount: KpiMetric;
  avgOrderValue: KpiMetric;
  collectionRate: KpiMetric;
  newCustomers: KpiMetric;
}

export interface SalesRep {
  userId: string;
  name: string;
  email: string;
  revenue: number;
  count: number;
  avgOrder: number;
}

export interface QuoteConversion {
  total: number;
  converted: number;
  expired: number;
  rejected: number;
  pending: number;
  conversionRate: number;
}

export interface TopCategory {
  categoryId: string;
  name: string;
  revenue: number;
  unitsSold: number;
  orders: number;
}

export interface TopCategoriesResponse {
  period: { start: string; end: string };
  data: TopCategory[];
}

export const analyticsApi = {
  getSalesTrend: async (
    startDate: string,
    endDate: string,
    granularity: AnalyticsGranularity = 'month',
  ): Promise<SalesTrendResponse> => {
    const res = await apiClient.get('/analytics/sales-trend', {
      params: { startDate, endDate, granularity },
    });
    return res.data;
  },

  getExpenseTrend: async (
    startDate: string,
    endDate: string,
    granularity: AnalyticsGranularity = 'month',
  ): Promise<ExpenseTrendResponse> => {
    const res = await apiClient.get('/analytics/expense-trend', {
      params: { startDate, endDate, granularity },
    });
    return res.data;
  },

  getProfitTrend: async (
    startDate: string,
    endDate: string,
    granularity: AnalyticsGranularity = 'month',
  ): Promise<ProfitTrendResponse> => {
    const res = await apiClient.get('/analytics/profit-trend', {
      params: { startDate, endDate, granularity },
    });
    return res.data;
  },

  getTopProducts: async (
    startDate: string,
    endDate: string,
    limit = 10,
  ): Promise<TopProductsResponse> => {
    const res = await apiClient.get('/analytics/top-products', {
      params: { startDate, endDate, limit },
    });
    return res.data;
  },

  getTopCustomers: async (
    startDate: string,
    endDate: string,
    limit = 10,
  ): Promise<TopCustomersResponse> => {
    const res = await apiClient.get('/analytics/top-customers', {
      params: { startDate, endDate, limit },
    });
    return res.data;
  },

  getSalesByPaymentMethod: async (
    startDate: string,
    endDate: string,
  ): Promise<SalesByPaymentMethodResponse> => {
    const res = await apiClient.get('/analytics/sales-by-payment-method', {
      params: { startDate, endDate },
    });
    return res.data;
  },

  getInventorySummary: async (): Promise<InventorySummaryResponse> => {
    const res = await apiClient.get('/analytics/inventory-summary');
    return res.data;
  },

  getKpiSummary: async (startDate: string, endDate: string): Promise<KpiSummary> => {
    const res = await apiClient.get('/analytics/kpi-summary', { params: { startDate, endDate } });
    return res.data;
  },

  getSalesRepLeaderboard: async (startDate: string, endDate: string): Promise<{ data: SalesRep[] }> => {
    const res = await apiClient.get('/analytics/sales-reps', { params: { startDate, endDate } });
    return res.data;
  },

  getQuoteConversion: async (startDate: string, endDate: string): Promise<QuoteConversion> => {
    const res = await apiClient.get('/analytics/quote-conversion', { params: { startDate, endDate } });
    return res.data;
  },

  getTopCategories: async (startDate: string, endDate: string, limit = 10): Promise<TopCategoriesResponse> => {
    const res = await apiClient.get('/analytics/top-categories', { params: { startDate, endDate, limit } });
    return res.data;
  },
};
