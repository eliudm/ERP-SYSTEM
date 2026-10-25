import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BOMStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type WorkOrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface BOMLineInput {
  productId: string;
  quantity: number;
  notes?: string;
}

export interface BOMLine {
  id: string;
  bomId: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  product?: {
    id: string;
    code: string;
    name: string;
    stockQuantity?: number;
  };
}

export interface BillOfMaterial {
  id: string;
  tenantId: string;
  name: string;
  productId: string;
  quantity: number;
  status: BOMStatus;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    code: string;
    name: string;
    stockQuantity?: number;
  };
  lines?: BOMLine[];
  workOrders?: WorkOrder[];
  _count?: { lines: number; workOrders: number };
}

export interface CreateBOMInput {
  name: string;
  productId: string;
  quantity?: number;
  notes?: string;
  lines: BOMLineInput[];
}

export interface UpdateBOMInput {
  name?: string;
  quantity?: number;
  notes?: string;
}

export interface AvailabilityComponent {
  productId: string;
  code: string;
  name: string;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  isSufficient: boolean;
}

export interface AvailabilityResult {
  bomId: string;
  bomName: string;
  productionQty: number;
  components: AvailabilityComponent[];
  allAvailable: boolean;
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  reference: string;
  bomId: string;
  quantity: number;
  status: WorkOrderStatus;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  bom?: BillOfMaterial;
}

export interface CreateWorkOrderInput {
  bomId: string;
  quantity: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const mrpApi = {
  boms: {
    create: async (data: CreateBOMInput): Promise<BillOfMaterial> => {
      const res = await apiClient.post('/mrp/bom', data);
      return res.data;
    },
    getAll: async (status?: string): Promise<BillOfMaterial[]> => {
      const res = await apiClient.get('/mrp/bom', { params: status ? { status } : {} });
      return res.data;
    },
    getOne: async (id: string): Promise<BillOfMaterial> => {
      const res = await apiClient.get(`/mrp/bom/${id}`);
      return res.data;
    },
    update: async (id: string, data: UpdateBOMInput): Promise<BillOfMaterial> => {
      const res = await apiClient.patch(`/mrp/bom/${id}`, data);
      return res.data;
    },
    setStatus: async (id: string, status: BOMStatus): Promise<BillOfMaterial> => {
      const res = await apiClient.patch(`/mrp/bom/${id}/status`, { status });
      return res.data;
    },
    upsertLines: async (id: string, lines: BOMLineInput[]): Promise<BillOfMaterial> => {
      const res = await apiClient.post(`/mrp/bom/${id}/lines`, { lines });
      return res.data;
    },
    checkAvailability: async (id: string, quantity: number): Promise<AvailabilityResult> => {
      const res = await apiClient.get(`/mrp/bom/${id}/availability`, { params: { quantity } });
      return res.data;
    },
  },
  workOrders: {
    create: async (data: CreateWorkOrderInput): Promise<WorkOrder> => {
      const res = await apiClient.post('/mrp/work-orders', data);
      return res.data;
    },
    getAll: async (status?: string): Promise<WorkOrder[]> => {
      const res = await apiClient.get('/mrp/work-orders', { params: status ? { status } : {} });
      return res.data;
    },
    getOne: async (id: string): Promise<WorkOrder> => {
      const res = await apiClient.get(`/mrp/work-orders/${id}`);
      return res.data;
    },
    confirm: async (id: string): Promise<WorkOrder> => {
      const res = await apiClient.patch(`/mrp/work-orders/${id}/confirm`);
      return res.data;
    },
    start: async (id: string): Promise<WorkOrder> => {
      const res = await apiClient.patch(`/mrp/work-orders/${id}/start`);
      return res.data;
    },
    complete: async (id: string): Promise<WorkOrder> => {
      const res = await apiClient.patch(`/mrp/work-orders/${id}/complete`);
      return res.data;
    },
    cancel: async (id: string): Promise<WorkOrder> => {
      const res = await apiClient.patch(`/mrp/work-orders/${id}/cancel`);
      return res.data;
    },
  },
};
