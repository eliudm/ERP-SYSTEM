import { apiClient } from './client';

export const branchesApi = {
  getBranches: async () => {
    const res = await apiClient.get('/branches');
    return res.data;
  },

  getBranch: async (id: string) => {
    const res = await apiClient.get(`/branches/${id}`);
    return res.data;
  },

  getBranchReport: async (id: string, from?: string, to?: string) => {
    const res = await apiClient.get(`/branches/${id}/report`, {
      params: { from, to },
    });
    return res.data;
  },

  createBranch: async (data: { name: string; code: string; location?: string }) => {
    const res = await apiClient.post('/branches', data);
    return res.data;
  },

  updateBranch: async (
    id: string,
    data: Partial<{ name: string; code: string; location: string; isActive: boolean }>,
  ) => {
    const res = await apiClient.patch(`/branches/${id}`, data);
    return res.data;
  },

  deactivateBranch: async (id: string) => {
    const res = await apiClient.delete(`/branches/${id}`);
    return res.data;
  },
};
