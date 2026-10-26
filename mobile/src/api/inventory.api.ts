import { apiClient } from './client';

export interface Warehouse {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  unitCost?: number | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  product?: { name: string; code: string } | null;
  warehouse?: { name: string } | null;
}

export interface CreateStockMovementPayload {
  productId: string;
  warehouseId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
}

export const inventoryApi = {
  getWarehouses: async (): Promise<Warehouse[]> => {
    const res = await apiClient.get('/inventory/warehouses');
    return res.data;
  },

  createStockMovement: async (
    data: CreateStockMovementPayload,
  ): Promise<StockMovement> => {
    const res = await apiClient.post('/inventory/stock-movements', data);
    return res.data;
  },

  getStockMovements: async (
    page = 1,
    limit = 20,
    productId?: string,
  ): Promise<{
    data: StockMovement[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> => {
    const res = await apiClient.get('/inventory/stock-movements', {
      params: { page, limit, productId },
    });
    return res.data;
  },
};
