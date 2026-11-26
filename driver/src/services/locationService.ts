import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';

export const LOCATION_TASK_NAME = 'BACKGROUND_DRIVER_LOCATION_TASK';

// Register background location task
if (typeof TaskManager.defineTask === 'function') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.warn('[locationService] Background location task error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const loc = locations[locations.length - 1];
        const lat = Number(loc.coords.latitude.toFixed(6));
        const lng = Number(loc.coords.longitude.toFixed(6));
        const heading = loc.coords.heading != null ? Number(loc.coords.heading.toFixed(1)) : 0;
        const speed = loc.coords.speed != null ? Number(loc.coords.speed.toFixed(1)) : 0;
        try {
          await api.post('/api/v1/driver/gps/', {
            latitude: lat,
            longitude: lng,
            heading,
            speed,
          });
        } catch (e) {
          // Ignore transient background network errors
        }
      }
    }
  });
}

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      return false;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  } catch (e) {
    console.warn('[locationService] Permission request failed:', e);
    return false;
  }
}

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      console.warn('[locationService] Background location permission denied');
      return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 10, // 10 meters filter for battery efficiency
      timeInterval: 10000,   // 10 seconds
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'فوكس شوب - وضع الكابتن',
        notificationBody: 'تتبع الموقع الجغرافي نشط لخدمة توصيل الطلبات',
      },
    });
    return true;
  } catch (e) {
    console.warn('[locationService] Failed to start location updates:', e);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    if (typeof Location.stopLocationUpdatesAsync === 'function') {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (e) {
    console.warn('[locationService] Failed to stop location updates:', e);
  }
}
