import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation (there's no OS keychain in a
// browser) — fall back to localStorage there. See
// https://docs.expo.dev/versions/v58.0.0/sdk/securestore/ ("Android, iOS,
// tvOS, Included in Expo Go" — web is not listed).
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore (e.g. private browsing with storage disabled)
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
