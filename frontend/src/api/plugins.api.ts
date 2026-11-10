import { apiClient } from './client';

export interface Plugin {
  id: string;
  name: string;
  slug: string | null;
  version: string;
  description: string | null;
  author: string | null;
  category: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  entryPoint: string;
  config: Record<string, any> | null;
  configSchema: Record<string, any> | null;
  pageUrl: string | null;
  pageLabel: string | null;
  pageIcon: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  installedAt: string;
  updatedAt: string;
}

export interface PagePlugin {
  id: string;
  name: string;
  pageUrl: string;
  pageLabel: string | null;
  pageIcon: string | null;
}

export interface RegisterPluginPayload {
  name: string;
  slug?: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  websiteUrl?: string;
  logoUrl?: string;
  entryPoint?: string;
  config?: Record<string, any>;
  configSchema?: Record<string, any>;
  pageUrl?: string;
  pageLabel?: string;
  pageIcon?: string;
}

export interface UpdatePluginConfigPayload {
  config?: Record<string, any>;
  version?: string;
  pageUrl?: string;
  pageLabel?: string;
  pageIcon?: string;
}

export const pluginsApi = {
  getPlugins: async (status?: string): Promise<Plugin[]> => {
    const res = await apiClient.get('/plugins', { params: { status } });
    return res.data;
  },

  getActivePlugins: async () => {
    const res = await apiClient.get('/plugins/active');
    return res.data;
  },

  getActivePagePlugins: async (): Promise<PagePlugin[]> => {
    const res = await apiClient.get('/plugins/active-pages');
    return res.data;
  },

  getPlugin: async (id: string): Promise<Plugin> => {
    const res = await apiClient.get(`/plugins/${id}`);
    return res.data;
  },

  registerPlugin: async (data: RegisterPluginPayload): Promise<Plugin> => {
    const res = await apiClient.post('/plugins', data);
    return res.data;
  },

  activatePlugin: async (id: string): Promise<Plugin> => {
    const res = await apiClient.patch(`/plugins/${id}/activate`);
    return res.data;
  },

  deactivatePlugin: async (id: string): Promise<Plugin> => {
    const res = await apiClient.patch(`/plugins/${id}/deactivate`);
    return res.data;
  },

  updatePluginConfig: async (id: string, data: UpdatePluginConfigPayload): Promise<Plugin> => {
    const res = await apiClient.patch(`/plugins/${id}/config`, data);
    return res.data;
  },

  uninstallPlugin: async (id: string) => {
    const res = await apiClient.delete(`/plugins/${id}`);
    return res.data;
  },
};
