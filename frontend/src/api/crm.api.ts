import { apiClient } from './client';

export const crmApi = {
  getLeads: async (stage?: string, search?: string) => {
    const res = await apiClient.get('/crm/leads', { params: { stage, search } });
    return res.data;
  },

  getPipeline: async () => {
    const res = await apiClient.get('/crm/pipeline');
    return res.data;
  },

  getLead: async (id: string) => {
    const res = await apiClient.get(`/crm/leads/${id}`);
    return res.data;
  },

  createLead: async (data: any) => {
    const res = await apiClient.post('/crm/leads', data);
    return res.data;
  },

  updateLead: async (id: string, data: any) => {
    const res = await apiClient.patch(`/crm/leads/${id}`, data);
    return res.data;
  },

  updateStage: async (id: string, stage: string) => {
    const res = await apiClient.patch(`/crm/leads/${id}/stage`, { stage });
    return res.data;
  },

  addActivity: async (id: string, data: any) => {
    const res = await apiClient.post(`/crm/leads/${id}/activities`, data);
    return res.data;
  },
};
