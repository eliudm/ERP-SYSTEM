import { apiClient } from './client';

export const procurementApi = {
  getSuppliers: async (search?: string) => {
    const res = await apiClient.get('/procurement/suppliers', { params: { search } });
    return res.data;
  },
  createSupplier: async (data: any) => {
    const res = await apiClient.post('/procurement/suppliers', data);
    return res.data;
  },
  getPurchaseOrders: async (page = 1, limit = 20, status?: string) => {
    const res = await apiClient.get('/procurement/purchase-orders', { params: { page, limit, status } });
    return res.data;
  },
  getPurchaseOrder: async (id: string) => {
    const res = await apiClient.get(`/procurement/purchase-orders/${id}`);
    return res.data;
  },
  createPurchaseOrder: async (data: any) => {
    const res = await apiClient.post('/procurement/purchase-orders', data);
    return res.data;
  },
  approvePO: async (id: string) => {
    const res = await apiClient.patch(`/procurement/purchase-orders/${id}/approve`);
    return res.data;
  },
  receiveGoods: async (id: string, data: any) => {
    const res = await apiClient.post(`/procurement/purchase-orders/${id}/receive`, data);
    return res.data;
  },
  createBillFromPO: async (id: string) => {
    const res = await apiClient.post(`/procurement/purchase-orders/${id}/create-bill`);
    return res.data;
  },

  // RFQs
  getRFQs: async (status?: string) => {
    const res = await apiClient.get('/procurement/rfq', { params: { status } });
    return res.data;
  },
  getRFQ: async (id: string) => {
    const res = await apiClient.get(`/procurement/rfq/${id}`);
    return res.data;
  },
  createRFQ: async (data: any) => {
    const res = await apiClient.post('/procurement/rfq', data);
    return res.data;
  },
  updateRFQ: async (id: string, data: any) => {
    const res = await apiClient.patch(`/procurement/rfq/${id}`, data);
    return res.data;
  },
  sendRFQ: async (id: string) => {
    const res = await apiClient.post(`/procurement/rfq/${id}/send`);
    return res.data;
  },
  confirmRFQ: async (id: string) => {
    const res = await apiClient.post(`/procurement/rfq/${id}/confirm`);
    return res.data;
  },
  cancelRFQ: async (id: string) => {
    const res = await apiClient.post(`/procurement/rfq/${id}/cancel`);
    return res.data;
  },
  convertRFQtoPO: async (id: string) => {
    const res = await apiClient.post(`/procurement/rfq/${id}/confirm`);
    return res.data;
  },

  // Vendor Bills
  getVendorBills: async (page = 1, limit = 20, status?: string) => {
    const res = await apiClient.get('/procurement/vendor-bills', { params: { page, limit, status } });
    return res.data;
  },
  createVendorBill: async (data: any) => {
    const res = await apiClient.post('/procurement/vendor-bills', data);
    return res.data;
  },
  approveVendorBill: async (id: string) => {
    const res = await apiClient.patch(`/procurement/vendor-bills/${id}/approve`);
    return res.data;
  },
  payVendorBill: async (id: string, paymentMethod: string) => {
    const res = await apiClient.patch(`/procurement/vendor-bills/${id}/pay`, { paymentMethod });
    return res.data;
  },

  // Purchase Returns
  getPurchaseReturns: async (page = 1, limit = 20) => {
    const res = await apiClient.get('/procurement/purchase-returns', { params: { page, limit } });
    return res.data;
  },
  createPurchaseReturn: async (data: any) => {
    const res = await apiClient.post('/procurement/purchase-returns', data);
    return res.data;
  },
  approvePurchaseReturn: async (id: string) => {
    const res = await apiClient.patch(`/procurement/purchase-returns/${id}/approve`);
    return res.data;
  },
};
