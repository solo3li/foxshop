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
    console.warn('[navigationUtils] Failed to decode polyline:', error);
    return [];
  }
}

/**
 * Calculates bearing angle (0 - 360 degrees) between previous and current GPS point
 * Used to orient the driver car/bike marker in the real driving direction.
 */
export function calculateDriverBearing(fromCoord: LatLng, toCoord: LatLng): number {
  try {
    const from = turf.point([fromCoord.longitude, fromCoord.latitude]);
    const to = turf.point([toCoord.longitude, toCoord.latitude]);
    const bearing = turf.bearing(from, to);
    return (bearing + 360) % 360;
  } catch {
    return 0;
  }
}

/**
 * Calculates straight line driving distance in kilometers using Turf
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
