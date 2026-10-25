import { apiClient } from './client';

export interface RegisterPluginPayload {
  name: string;
  version: string;
  description?: string;
  author?: string;
  entryPoint: string;
  config?: Record<string, any>;
}

export interface UpdatePluginConfigPayload {
  config?: Record<string, any>;
  version?: string;
}

export const pluginsApi = {
  getPlugins: async (status?: string) => {
    const res = await apiClient.get('/plugins', { params: { status } });
    return res.data;
  },

  getActivePlugins: async () => {
    const res = await apiClient.get('/plugins/active');
    return res.data;
  },

  getPlugin: async (id: string) => {
    const res = await apiClient.get(`/plugins/${id}`);
    return res.data;
  },

  registerPlugin: async (data: RegisterPluginPayload) => {
    const res = await apiClient.post('/plugins', data);
    return res.data;
  },

  activatePlugin: async (id: string) => {
    const res = await apiClient.patch(`/plugins/${id}/activate`);
    return res.data;
  },

  deactivatePlugin: async (id: string) => {
    const res = await apiClient.patch(`/plugins/${id}/deactivate`);
    return res.data;
  },

  updatePluginConfig: async (id: string, data: UpdatePluginConfigPayload) => {
    const res = await apiClient.patch(`/plugins/${id}/config`, data);
    return res.data;
  },

  uninstallPlugin: async (id: string) => {
    const res = await apiClient.delete(`/plugins/${id}`);
    return res.data;
  },
};
