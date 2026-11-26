import { create } from 'zustand';
import { storage } from '../services/storage';
import { normalizeArabic } from '../constants/config';

interface SearchHistoryState {
  history: string[];
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  addSearchTerm: (term: string) => Promise<void>;
  removeSearchTerm: (term: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const STORAGE_KEY_SEARCH_HISTORY = 'foxshop_recent_searches';
const MAX_HISTORY_ITEMS = 10;

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  history: [],
  isLoaded: false,

  loadHistory: async () => {
    try {
      const stored = await storage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      const parsed = stored ? JSON.parse(stored) : [];
      const list = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

      // Deduplicate on load using normalized forms
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const item of list) {
        const clean = item.trim();
        const norm = normalizeArabic(clean);
        if (!seen.has(norm)) {
          seen.add(norm);
          deduped.push(clean);
        }
      }

      set({
        history: deduped.slice(0, MAX_HISTORY_ITEMS),
        isLoaded: true,
      });
    } catch (e) {
      console.warn('[SearchHistory] Failed to load search history:', e);
      set({ history: [], isLoaded: true });
    }
  },

  addSearchTerm: async (term: string) => {
    const clean = term.trim();
    if (!clean) return;

    const norm = normalizeArabic(clean);
    const current = get().history;
    const filtered = current.filter((item) => normalizeArabic(item) !== norm);
    const updated = [clean, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    set({ history: updated });
    try {
      await storage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[SearchHistory] Failed to save search history:', e);
    }
  },

  removeSearchTerm: async (term: string) => {
    const clean = term.trim();
    const norm = normalizeArabic(clean);
    const current = get().history;
    const updated = current.filter((item) => normalizeArabic(item) !== norm);
    set({ history: updated });
    try {
      await storage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[SearchHistory] Failed to remove search history item:', e);
    }
  },

  clearHistory: async () => {
    set({ history: [] });
    try {
      await storage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
    } catch (e) {
      console.warn('[SearchHistory] Failed to clear search history:', e);
    }
  },
}));
