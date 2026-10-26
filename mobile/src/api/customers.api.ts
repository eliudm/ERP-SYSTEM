import { apiClient } from './client';

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export const customersApi = {
  getCustomers: async (search?: string): Promise<Customer[]> => {
    const res = await apiClient.get('/sales/customers', { params: { search } });
    return res.data;
  },

  createCustomer: async (data: {
    name: string;
    email?: string;
    phone?: string;
  }): Promise<Customer> => {
    const res = await apiClient.post('/sales/customers', data);
    return res.data;
  },
};
