import { apiClient } from './client';
import type { Product, ProductCategory } from '../types';

export const inventoryApi = {
  // Products
  getProducts: async (search?: string, categoryId?: string): Promise<Product[]> => {
    const res = await apiClient.get('/inventory/products', { params: { search, categoryId } });
    return res.data;
  },

  createProduct: async (data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.post('/inventory/products', data);
    return res.data;
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.patch(`/inventory/products/${id}`, data);
    return res.data;
  },

  getLowStock: async () => {
    const res = await apiClient.get('/inventory/products/low-stock');
    return res.data;
  },

  // Categories
  getCategories: async (): Promise<ProductCategory[]> => {
    const res = await apiClient.get('/inventory/categories');
    return res.data;
  },

  createCategory: async (data: { name: string; color?: string; icon?: string }): Promise<ProductCategory> => {
    const res = await apiClient.post('/inventory/categories', data);
    return res.data;
  },

  updateCategory: async (id: string, data: { name?: string; color?: string; icon?: string }): Promise<ProductCategory> => {
    const res = await apiClient.patch(`/inventory/categories/${id}`, data);
    return res.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/categories/${id}`);
  },

  // Warehouses
  getWarehouses: async () => {
    const res = await apiClient.get('/inventory/warehouses');
    return res.data;
  },

  createWarehouse: async (data: { name: string; location?: string }) => {
    const res = await apiClient.post('/inventory/warehouses', data);
    return res.data;
  },

  getWarehouseStock: async (id: string) => {
    const res = await apiClient.get(`/inventory/warehouses/${id}/stock`);
    return res.data;
  },

  // Stock Movements
  getStockMovements: async (page = 1, limit = 20) => {
    const res = await apiClient.get('/inventory/stock-movements', { params: { page, limit } });
    return res.data;
  },

  recordMovement: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/inventory/stock-movements', data);
    return res.data;
  },

  getMovementSummary: async () => {
    const res = await apiClient.get('/inventory/stock-movements/summary');
    return res.data;
  },

  // Stock Transfers
  getStockTransfers: async (page = 1, limit = 20, status?: string) => {
    const res = await apiClient.get('/inventory/stock-transfers', { params: { page, limit, status } });
    return res.data;
  },
  createStockTransfer: async (data: any) => {
    const res = await apiClient.post('/inventory/stock-transfers', data);
    return res.data;
  },
  completeTransfer: async (id: string) => {
    const res = await apiClient.patch(`/inventory/stock-transfers/${id}/complete`);
    return res.data;
  },

  // Stock Counts
  getStockCounts: async (page = 1, limit = 20, status?: string) => {
    const res = await apiClient.get('/inventory/stock-counts', { params: { page, limit, status } });
    return res.data;
  },
  createStockCount: async (data: any) => {
    const res = await apiClient.post('/inventory/stock-counts', data);
    return res.data;
  },
  updateCountLine: async (countId: string, lineId: string, countedQty: number) => {
    const res = await apiClient.patch(`/inventory/stock-counts/${countId}/lines/${lineId}`, { countedQty });
    return res.data;
  },
  finalizeCount: async (id: string) => {
    const res = await apiClient.post(`/inventory/stock-counts/${id}/validate`);
    return res.data;
  },

  // Lots
  getLots: async (productId?: string) => {
    const res = await apiClient.get('/inventory/lots', { params: { productId } });
    return res.data;
  },
  createLot: async (data: any) => {
    const res = await apiClient.post('/inventory/lots', data);
    return res.data;
  },

  // Serial Numbers
  getSerials: async (productId?: string, status?: string) => {
    const res = await apiClient.get('/inventory/serial-numbers', { params: { productId, status } });
    return res.data;
  },
  createSerial: async (data: any) => {
    const res = await apiClient.post('/inventory/serial-numbers', data);
    return res.data;
  },
};
