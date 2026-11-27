import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Crosshair, Map as MapIcon, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../hooks/use-theme';
import { useAddressStore } from '../store/addressStore';
import { LocationPickerModal } from './LocationPickerModal';

/**
 * Full-screen onboarding gate shown when the customer (guest or logged-in)
 * has no saved/selected delivery address yet. Cannot be dismissed until an
 * address is chosen via GPS or the map picker.
 */
export const MandatoryAddressGate: React.FC = () => {
  const theme = useTheme();
  const { createAddress } = useAddressStore();
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const reverseGeocodeStreet = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address || {};
        const parts = [
          addr.road || addr.street || addr.pedestrian || addr.neighbourhood,
          addr.suburb || addr.city_district || addr.quarter,
          addr.city || addr.town || addr.state,
        ].filter(Boolean);
        if (parts.length > 0) {
          return parts.join('، ');
        }
        if (data?.display_name) {
          return String(data.display_name).split(',').slice(0, 3).join('، ').trim();
        }
      }
    } catch {
      // Fallback to generic label
    }
    return 'موقعي الحالي';
  };

  const handleUseCurrentLocation = () => {
    setErrorMsg(null);
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setShowMapPicker(true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const street = await reverseGeocodeStreet(lat, lng);
          const saved = await createAddress({
            title: 'موقعي الحالي',
            street,
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            is_default: true,
          });
          if (!saved) {
            setErrorMsg('تعذر حفظ العنوان، يرجى المحاولة مرة أخرى أو الاختيار من الخريطة.');
          }
        } catch {
          setErrorMsg('حدث خطأ أثناء تحديد الموقع، يرجى الاختيار من الخريطة.');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        setErrorMsg('تعذر الوصول لموقعك تلقائياً. تأكد من تفعيل صلاحية الموقع أو اختر موقعك من الخريطة.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
          <MapPin size={44} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>
          حدد عنوان التوصيل أولاً
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          نحتاج لمعرفة موقعك لنعرض لك المطاعم والصيدليات والمتاجر المتاحة للتوصيل في منطقتك فقط.
        </Text>

        {errorMsg ? (
          <View style={[styles.errorBox, { backgroundColor: theme.isDark ? '#450A0A' : '#FEF2F2' }]}>
            <Text style={[styles.errorText, { color: theme.isDark ? '#FCA5A5' : '#DC2626' }]}>
              {errorMsg}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Crosshair size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>تحديد موقعي الحالي تلقائياً (GPS)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowMapPicker(true)}
            disabled={isLocating}
            activeOpacity={0.85}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <MapIcon size={20} color={theme.primary} />
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
              اختيار العنوان من الخريطة
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteRow}>
          <ShieldCheck size={16} color={theme.textSecondary} />
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>
            يمكنك تغيير أو إضافة عناوين أخرى في أي وقت من الشريط العلوي
          </Text>
        </View>
      </View>

      <LocationPickerModal
        visible={showMapPicker}
        mandatory={true}
        onClose={() => setShowMapPicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  errorBox: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  secondaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  noteRow: {
    marginTop: 24,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  noteText: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
  },
});
