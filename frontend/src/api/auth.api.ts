import { apiClient } from './client';
import type { AuthResponse, User } from '../types';

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  posOnly?: boolean;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  role?: string;
  posOnly?: boolean;
  isActive?: boolean;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get('/auth/profile');
    return res.data;
  },

  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get('/auth/users');
    return res.data;
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const res = await apiClient.post('/auth/users', payload);
    return res.data;
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const res = await apiClient.patch(`/auth/users/${id}`, payload);
    return res.data;
  },

  resetPassword: async (id: string, newPassword: string): Promise<{ message: string }> => {
    const res = await apiClient.post(`/auth/users/${id}/reset-password`, { newPassword });
    return res.data;
  },

  deactivateUser: async (id: string): Promise<{ id: string; email: string; isActive: boolean }> => {
    const res = await apiClient.patch(`/auth/users/${id}/deactivate`);
    return res.data;
  },

  updateUserAccess: async (
    id: string,
    posOnly: boolean,
  ): Promise<{ id: string; email: string; role: string; posOnly: boolean; isActive: boolean }> => {
    const res = await apiClient.patch(`/auth/users/${id}/access`, { posOnly });
    return res.data;
  },
};
