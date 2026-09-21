import { Linking, Platform } from 'react-native';

export type NavigationApp = 'google' | 'waze' | 'apple';

export function openExternalNavigation(
  latitude: number,
  longitude: number,
  label?: string,
  preferredApp: NavigationApp = 'google'
) {
  const destName = encodeURIComponent(label || 'الوجهة');

  if (preferredApp === 'waze') {
    const wazeUrl = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    Linking.canOpenURL(wazeUrl).then((supported) => {
      if (supported) {
        Linking.openURL(wazeUrl);
      } else {
        // Fallback to google
        openGoogleMaps(latitude, longitude, destName);
      }
    });
    return;
  }

  if (preferredApp === 'apple' && Platform.OS === 'ios') {
    const appleUrl = `maps://?daddr=${latitude},${longitude}&q=${destName}`;
    Linking.openURL(appleUrl);
    return;
  }

  openGoogleMaps(latitude, longitude, destName);
}

function openGoogleMaps(latitude: number, longitude: number, label: string) {
  const scheme = Platform.select({
    ios: `maps://0,0?q=${label}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  });
  Linking.openURL(scheme as string).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
  });
}
