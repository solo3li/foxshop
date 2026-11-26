import AsyncStorage from '@react-native-async-storage/async-storage';

// Universal persistent cross-platform storage adapter for Web and Native Expo
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn(`[storage] getItem failed for ${key}:`, e);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[storage] setItem failed for ${key}:`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[storage] removeItem failed for ${key}:`, e);
    }
  },
};
