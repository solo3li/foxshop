import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  MapPin,
  X,
  Crosshair,
  Home,
  Briefcase,
  Search,
  Check,
  Building,
  Layers,
  FileText,
} from 'lucide-react-native';
import { api } from '../services/api';
import { Address } from '../services/orderService';
import { useAddressStore } from '../store/addressStore';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSaved?: (address: Address) => void;
  initialCoords?: { latitude: number; longitude: number };
}

let cachedApiKey: string | null = null;
let scriptLoadPromise: Promise<void> | null = null;

async function fetchGoogleMapsKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;
  try {
    const res = await api.get('/api/v1/auth/config/');
    const key = res.data?.google_maps_client_key;
    if (key && typeof key === 'string' && key.trim().length > 0) {
      cachedApiKey = key.trim();
      return cachedApiKey;
    }
    return null;
  } catch (err) {
    console.error('[LocationPicker] Failed to fetch Google Maps key:', err);
    return null;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&language=ar&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('loading', 'async');
    script.onload = () => resolve();
    script.onerror = (err) => {
      scriptLoadPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

declare const google: any;

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  onLocationSaved,
  initialCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Form State
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialCoords?.latitude || 24.7136,
    lng: initialCoords?.longitude || 46.6753,
  });
  const [addressTitle, setAddressTitle] = useState<'المنزل' | 'العمل' | 'أخرى'>('المنزل');
  const [customTitle, setCustomTitle] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { createAddress } = useAddressStore();

  // Load Google Maps script once
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    setLoadingMap(true);

    (async () => {
      const key = await fetchGoogleMapsKey();
      if (!isMounted) return;

      if (!key) {
        setLoadingMap(false);
        return;
      }

      try {
        await loadGoogleMapsScript(key);
        if (isMounted) {
          setMapReady(true);
          setLoadingMap(false);
        }
      } catch (e) {
        if (isMounted) setLoadingMap(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Reverse geocoding helper
  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoderRef.current && (window as any).google?.maps) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    if (!geocoderRef.current) return;

    setIsGeocoding(true);
    geocoderRef.current.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      setIsGeocoding(false);
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const fullAddr = results[0].formatted_address;
        setStreetAddress(fullAddr);
      }
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!visible || !mapReady || !mapContainerRef.current) return;

    const startPos = {
      lat: initialCoords?.latitude || 24.7136,
      lng: initialCoords?.longitude || 46.6753,
    };

    const map = new google.maps.Map(mapContainerRef.current, {
      center: startPos,
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    mapInstanceRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    // Map idle event tracks center pin location
    map.addListener('idle', () => {
      const center = map.getCenter();
      if (center) {
        const lat = center.lat();
        const lng = center.lng();
        setSelectedCoords({ lat, lng });
        reverseGeocode(lat, lng);
      }
    });

    // Auto locate via browser GPS if available
    if (navigator.geolocation && !initialCoords) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.panTo(userPos);
          setSelectedCoords(userPos);
          reverseGeocode(userPos.lat, userPos.lng);
        },
        () => {
          reverseGeocode(startPos.lat, startPos.lng);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      reverseGeocode(startPos.lat, startPos.lng);
    }
  }, [visible, mapReady]);

  // GPS Locate Button Handler
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(userPos);
          mapInstanceRef.current.setZoom(17);
        }
        setSelectedCoords(userPos);
        reverseGeocode(userPos.lat, userPos.lng);
      },
      (err) => {
        setIsLocating(false);
        alert('تعذر تحديد موقعك الحالي. يرجى تفعيل إذن الموقع في المتصفح.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Search Address Handler
  const handleSearchAddress = () => {
    if (!searchQuery.trim() || !geocoderRef.current) return;
    geocoderRef.current.geocode({ address: searchQuery }, (results: any, status: any) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const loc = results[0].geometry.location;
        const targetPos = { lat: loc.lat(), lng: loc.lng() };
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(targetPos);
          mapInstanceRef.current.setZoom(16);
        }
        setSelectedCoords(targetPos);
        setStreetAddress(results[0].formatted_address);
      } else {
        alert('لم يتم العثور على المكان، يرجى كتابة اسم مدينة أو حي معروف.');
      }
    });
  };

  // Submit and Save Address
  const handleSaveAddress = async () => {
    if (!streetAddress.trim()) {
      alert('يرجى تحديد الشارع أو الموقع على الخريطة.');
      return;
    }

    const finalTitle = addressTitle === 'أخرى' && customTitle.trim() ? customTitle.trim() : addressTitle;

    setIsSubmitting(true);
    const newAddress = await createAddress({
      title: finalTitle,
      street: streetAddress.trim(),
      building_number: buildingNumber.trim(),
      floor: floor.trim(),
      apartment_number: apartmentNumber.trim(),
      delivery_instructions: deliveryInstructions.trim(),
      latitude: Number(selectedCoords.lat.toFixed(6)),
      longitude: Number(selectedCoords.lng.toFixed(6)),
      is_default: true,
    });

    setIsSubmitting(false);
    if (newAddress) {
      if (onLocationSaved) {
        onLocationSaved(newAddress);
      }
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>تحديد موقع التوصيل</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Map Container */}
        <View style={styles.mapWrapper}>
          {loadingMap ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D70F64" />
              <Text style={styles.loadingText}>جاري تجهيز الخريطة...</Text>
            </View>
          ) : (
            <div ref={mapContainerRef as any} style={{ width: '100%', height: '100%' }} />
          )}

          {/* Floating Search Bar */}
          <View style={styles.floatingSearch}>
            <TextInput
              placeholder="ابحث عن منطقة، حي، أو شارع..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchAddress}
              style={[styles.searchInput, { outlineStyle: 'none' } as any]}
            />
            <TouchableOpacity onPress={handleSearchAddress} style={styles.searchIconBtn}>
              <Search size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Center Pin Indicator */}
          <View pointerEvents="none" style={styles.centerMarkerContainer}>
            <View style={styles.pinBubble}>
              <Text style={styles.pinBubbleText}>
                {isGeocoding ? 'جاري تحديد العنوان...' : 'موقع التوصيل هنا'}
              </Text>
            </View>
            <MapPin size={42} color="#D70F64" strokeWidth={2.5} style={styles.pinShadow} />
            <View style={styles.pinBaseDot} />
          </View>

          {/* Floating Current Location GPS Button */}
          <TouchableOpacity
            onPress={handleCurrentLocation}
            style={styles.gpsButton}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#D70F64" />
            ) : (
              <Crosshair size={22} color="#D70F64" />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Details Form Sheet */}
        <View style={styles.bottomSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {/* Title Selector */}
            <Text style={styles.fieldLabel}>نوع العنوان:</Text>
            <View style={styles.titleButtonsRow}>
              <TouchableOpacity
                onPress={() => setAddressTitle('المنزل')}
                style={[styles.titleBadge, addressTitle === 'المنزل' && styles.titleBadgeActive]}
              >
                <Home size={16} color={addressTitle === 'المنزل' ? '#FFFFFF' : '#4B5563'} />
                <Text
                  style={[
                    styles.titleBadgeText,
                    addressTitle === 'المنزل' && styles.titleBadgeTextActive,
                  ]}
                >
                  المنزل
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAddressTitle('العمل')}
                style={[styles.titleBadge, addressTitle === 'العمل' && styles.titleBadgeActive]}
              >
                <Briefcase size={16} color={addressTitle === 'العمل' ? '#FFFFFF' : '#4B5563'} />
                <Text
                  style={[
                    styles.titleBadgeText,
                    addressTitle === 'العمل' && styles.titleBadgeTextActive,
                  ]}
                >
                  العمل
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAddressTitle('أخرى')}
                style={[styles.titleBadge, addressTitle === 'أخرى' && styles.titleBadgeActive]}
              >
                <MapPin size={16} color={addressTitle === 'أخرى' ? '#FFFFFF' : '#4B5563'} />
                <Text
                  style={[
                    styles.titleBadgeText,
                    addressTitle === 'أخرى' && styles.titleBadgeTextActive,
                  ]}
                >
                  أخرى
                </Text>
              </TouchableOpacity>
            </View>

            {addressTitle === 'أخرى' && (
              <TextInput
                placeholder="اسم مخصص للعنوان (مثال: شقة الأصدقاء)"
                placeholderTextColor="#9CA3AF"
                value={customTitle}
                onChangeText={setCustomTitle}
                style={[styles.inputField, { marginTop: 8, outlineStyle: 'none' } as any]}
              />
            )}

            {/* Street / Location Input */}
            <Text style={styles.fieldLabel}>تفاصيل الشارع والمنطقة:</Text>
            <View style={styles.inputWithIcon}>
              <MapPin size={18} color="#D70F64" style={styles.inputPrefixIcon} />
              <TextInput
                placeholder="اسم الشارع أو الحي"
                placeholderTextColor="#9CA3AF"
                value={streetAddress}
                onChangeText={setStreetAddress}
                style={[styles.inputFieldFlex, { outlineStyle: 'none' } as any]}
              />
            </View>

            {/* Building / Floor / Apt Row */}
            <View style={styles.inputsRow}>
              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>رقم العمارة</Text>
                <TextInput
                  placeholder="مثال: ١٤"
                  placeholderTextColor="#9CA3AF"
                  value={buildingNumber}
                  onChangeText={setBuildingNumber}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>

              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>الدور / الطابق</Text>
                <TextInput
                  placeholder="مثال: ٣"
                  placeholderTextColor="#9CA3AF"
                  value={floor}
                  onChangeText={setFloor}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>

              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>رقم الشقة</Text>
                <TextInput
                  placeholder="مثال: ٥"
                  placeholderTextColor="#9CA3AF"
                  value={apartmentNumber}
                  onChangeText={setApartmentNumber}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>
            </View>

            {/* Delivery Instructions */}
            <Text style={styles.fieldLabel}>تعليمات للمندوب (اختياري):</Text>
            <TextInput
              placeholder="مثال: اترك الطلب عند الباب / اتصل عند الوصول"
              placeholderTextColor="#9CA3AF"
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              style={[styles.inputField, { height: 44, outlineStyle: 'none' } as any]}
            />

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSaveAddress}
              disabled={isSubmitting}
              style={styles.saveButton}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.saveButtonText}>حفظ وتأكيد هذا العنوان</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  floatingSearch: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  searchIconBtn: {
    width: 46,
    height: 46,
    backgroundColor: '#D70F64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -21 }, { translateY: -42 }],
    alignItems: 'center',
    zIndex: 4,
  },
  pinBubble: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pinBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pinShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  pinBaseDot: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -2,
  },
  gpsButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 5,
  },
  bottomSheet: {
    maxHeight: '48%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  formScroll: {
    padding: 20,
    paddingBottom: 28,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 6,
    textAlign: 'right',
  },
  fieldLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'right',
  },
  titleButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  titleBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  titleBadgeActive: {
    backgroundColor: '#D70F64',
    borderColor: '#D70F64',
  },
  titleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  titleBadgeTextActive: {
    color: '#FFFFFF',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
  },
  inputPrefixIcon: {
    marginLeft: 6,
  },
  inputFieldFlex: {
    flex: 1,
    height: 44,
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
  },
  inputField: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  rowField: {
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D70F64',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
    shadowColor: '#D70F64',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
