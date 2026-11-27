/**
 * Central Configuration for FoxShop Client Application
 * Unifies currency, localization, and branding constants.
 */

export const APP_CONFIG = {
  appName: 'FoxShop',
  appNameAr: 'فوكس شوب',
  currency: 'ج.م',
  currencyCode: 'EGP',
  currencyNameAr: 'جنيه مصري',
  primaryColor: '#D70F64',
  taglineAr: 'توصيل سريع وأشهى المأكولات',
  defaultCoordinates: {
    latitude: 30.0444,
    longitude: 31.2357,
  },
} as const;

export const CURRENCY = APP_CONFIG.currency;
export const DEFAULT_COORDINATES = APP_CONFIG.defaultCoordinates;

/**
 * Format a numeric amount to unified Egyptian Pound string: e.g. "120 ج.م" or "120.50 ج.م"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') {
    return `0 ${CURRENCY}`;
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(numeric)) {
    return `0 ${CURRENCY}`;
  }
  const formatted = numeric.toFixed(2).replace(/\.00$/, '');
  return `${formatted} ${CURRENCY}`;
}

/**
 * Normalizes Arabic text for robust search matching and deduplication:
 * - Removes diacritics/tashkeel (Fatha, Damma, Kasra, Sukun, Tanween, etc.)
 * - Normalizes Alef variations (أ, إ, آ, ٱ -> ا)
 * - Normalizes Taa Marbouta to Haa (ة -> ه)
 * - Normalizes Alef Maqsura to Yaa (ى -> ي)
 */
export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}
