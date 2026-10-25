import { apiClient } from './client';

export const auditApi = {
  getLogs: async (page = 1, limit = 50, tableName?: string, action?: string) => {
    const res = await apiClient.get('/audit/logs', {
      params: { page, limit, tableName, action },
    });
    return res.data;
  },
};
