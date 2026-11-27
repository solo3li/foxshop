// Lightweight singleton loader for Leaflet (OpenStreetMap) on Web
let leafletPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Leaflet requires browser DOM'));
  }
  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existing = document.querySelector('script[src*="leaflet"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L));
      existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).L) resolve((window as any).L);
      else reject(new Error('Leaflet loaded but window.L missing'));
    };
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error('Failed to load Leaflet script'));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}
