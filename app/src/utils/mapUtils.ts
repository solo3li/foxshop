import polyline from '@mapbox/polyline';
import * as turf from '@turf/turf';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Decodes an encoded polyline string from OSRM into an array of LatLng objects
 */
export function decodeRoutePolyline(encodedPolyline: string): LatLng[] {
  if (!encodedPolyline) return [];
  try {
    const points = polyline.decode(encodedPolyline);
    return points.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (error) {
    console.warn('[mapUtils] Failed to decode polyline:', error);
    return [];
  }
}

/**
 * Calculates geographical distance in kilometers between two GPS points using Turf
 */
export function calculateDistanceKm(point1: LatLng, point2: LatLng): number {
  try {
    const from = turf.point([point1.longitude, point1.latitude]);
    const to = turf.point([point2.longitude, point2.latitude]);
    return turf.distance(from, to, { units: 'kilometers' });
  } catch {
    return 0;
  }
}

/**
 * Calculates bearing angle (0 - 360 degrees) between two GPS points using Turf
 */
export function calculateBearing(origin: LatLng, destination: LatLng): number {
  try {
    const from = turf.point([origin.longitude, origin.latitude]);
    const to = turf.point([destination.longitude, destination.latitude]);
    const b = turf.bearing(from, to);
    return (b + 360) % 360;
  } catch {
    return 0;
  }
}
