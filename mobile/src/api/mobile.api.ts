import { apiClient } from './client';

export interface MobileDashboard {
  salesToday: { amount: number; count: number };
  salesThisMonth: number;
  pendingInvoices: number;
  pendingApprovals: number;
  lowStockCount: number;
  unreadNotifications: number;
  serverTime: string;
}

export interface PosProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  unitPrice: number;
  taxRate: number;
  stockQuantity: number;
  categoryId: string | null;
}

export interface PosCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface PosData {
  products: PosProduct[];
  categories: PosCategory[];
  paymentMethods: string[];
}

export interface RecentInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  status: string;
  total: number;
  paymentMethod: string | null;
  customer: { id: string; name: string } | null;
  etimsStatus: 'PENDING' | 'SUBMITTED' | 'SUCCESS' | 'FAILED' | null;
}

export interface ProductSaleRow {
  productId: string;
  productName: string;
  productCode: string;
  qtySold: number;
  revenue: number;
  invoiceCount: number;
}

export interface SyncStatus {
  productCount: number;
  customerCount: number;
  lastInvoiceAt: string | null;
  serverTime: string;
}

export const mobileApi = {
  getDashboard: async (): Promise<MobileDashboard> => {
    const res = await apiClient.get('/mobile/dashboard');
    return res.data;
  },

  getPosData: async (branchId?: string): Promise<PosData> => {
    const res = await apiClient.get('/mobile/pos-data', {
      params: { branchId },
    });
    return res.data;
  },

  quickSearch: async (q: string): Promise<PosProduct[]> => {
    const res = await apiClient.get('/mobile/search', { params: { q } });
    return res.data;
  },

  getRecentInvoices: async (
    limit = 20,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<RecentInvoice[]> => {
    const res = await apiClient.get('/mobile/recent-invoices', {
      params: { limit, dateFrom, dateTo },
    });
    return res.data;
  },

  getProductSales: async (
    dateFrom?: string,
    dateTo?: string,
  ): Promise<ProductSaleRow[]> => {
    const res = await apiClient.get('/mobile/product-sales', {
      params: { dateFrom, dateTo },
    });
    return res.data;
  },

  getSyncStatus: async (): Promise<SyncStatus> => {
    const res = await apiClient.get('/mobile/sync-status');
    return res.data;
  },
};
