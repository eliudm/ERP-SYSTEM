import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from '../utils/storage';

const resolveApiUrl = (): string => {
  const override =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  if (Platform.OS === 'web') {
    // The browser runs on the same machine as the backend.
    return 'http://localhost:3000/api/v1';
  }

  // On a physical device or simulator, "localhost" means the device
  // itself, not this computer. Derive the dev machine's LAN address from
  // the same host:port Metro used to serve this JS bundle to the device
  // (Constants.expoConfig.hostUri, e.g. "192.168.1.5:8081") — this stays
  // correct automatically if the network/IP changes between sessions.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000/api/v1` : 'http://localhost:3000/api/v1';
};

const API_URL = resolveApiUrl();

export const TOKEN_KEY = 'nexora-auth-token';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
