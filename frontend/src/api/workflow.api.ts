import { apiClient } from './client';

export const workflowApi = {
  getRequests: async (entityType?: string, entityId?: string, status?: string) => {
    const res = await apiClient.get('/workflow/requests', {
      params: { entityType, entityId, status },
    });
    return res.data;
  },

  createRequest: async (data: any) => {
    const res = await apiClient.post('/workflow/requests', data);
    return res.data;
  },

  runOverdueCheck: async () => {
    const res = await apiClient.post('/workflow/requests/run-overdue-check');
    return res.data;
  },

  approveRequest: async (id: string, comments?: string) => {
    const res = await apiClient.post(`/workflow/requests/${id}/approve`, { comments });
    return res.data;
  },

  rejectRequest: async (id: string, reason?: string) => {
    const res = await apiClient.post(`/workflow/requests/${id}/reject`, { reason });
    return res.data;
  },
};
