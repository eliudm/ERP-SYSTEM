import axios from 'axios';

// In production/LAN, Nginx proxies /api/v1 → backend, so relative URL works
// from any machine. In dev, Vite's proxy does the same.
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('erp-auth');

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
      const token = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore malformed persisted auth state
    }
  }

  return config;
});
