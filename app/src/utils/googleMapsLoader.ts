import { api } from '../services/api';

let cachedGoogleKey: string | null | undefined = undefined;
let googleLoadPromise: Promise<boolean> | null = null;

/**
 * Fetch Google Maps JS API client key from backend public config (cached in memory).
 */
export async function fetchGoogleMapsKey(): Promise<string | null> {
  if (cachedGoogleKey) return cachedGoogleKey;
  try {
    const res = await api.get('/api/v1/auth/config/');
    const key = res.data?.google_maps_client_key;
    if (key && typeof key === 'string' && key.trim().length > 0) {
      cachedGoogleKey = key.trim();
      return cachedGoogleKey;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Dynamically load Google Maps JavaScript API in browser environments.
 */
export function loadGoogleMapsScript(apiKey: string): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
    return Promise.resolve(true);
  }
  if (googleLoadPromise) return googleLoadPromise;

  googleLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      let n = 0;
      const t = setInterval(() => {
        n++;
        if ((window as any).google?.maps?.Map) {
          clearInterval(t);
          resolve(true);
        } else if (n > 40) {
          clearInterval(t);
          resolve(false);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ar`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      let n = 0;
      const t = setInterval(() => {
        n++;
        if ((window as any).google?.maps?.Map) {
          clearInterval(t);
          resolve(true);
        } else if (n > 40) {
          clearInterval(t);
          resolve(false);
        }
      }, 100);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return googleLoadPromise;
}
