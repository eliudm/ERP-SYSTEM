import { apiClient } from './client';

export const contactsApi = {
  getContacts: async (search?: string, type?: string) => {
    const res = await apiClient.get('/contacts', { params: { search, type } });
    return res.data;
  },

  getContact: async (id: string) => {
    const res = await apiClient.get(`/contacts/${id}`);
    return res.data;
  },

  getCompanies: async (search?: string) => {
    const res = await apiClient.get('/contacts/companies', { params: { search } });
    return res.data;
  },

  createContact: async (data: any) => {
    const res = await apiClient.post('/contacts', data);
    return res.data;
  },

  updateContact: async (id: string, data: any) => {
    const res = await apiClient.patch(`/contacts/${id}`, data);
    return res.data;
  },

  deleteContact: async (id: string) => {
    const res = await apiClient.delete(`/contacts/${id}`);
    return res.data;
  },
};
