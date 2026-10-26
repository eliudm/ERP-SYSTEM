import { apiClient } from './client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  posOnly: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  posOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  me: async (): Promise<Profile> => {
    const res = await apiClient.get('/auth/profile');
    return res.data;
  },
};
