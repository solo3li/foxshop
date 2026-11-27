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
  ArrowRight,
  Pencil,
  FileText,
  AlertCircle,
} from 'lucide-react-native';
import { api } from '../services/api';
import { restaurantService, BackendDeliveryZone } from '../services/restaurantService';
import { loadLeaflet } from '../utils/leafletLoader';
import { Address } from '../services/orderService';
import { useAddressStore } from '../store/addressStore';
import { CreativeLocationPin } from './CreativeLocationPin';
import { DEFAULT_COORDINATES } from '../constants/config';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSaved?: (address: Address) => void;
  initialCoords?: { latitude: number; longitude: number };
  editingAddress?: Address | null;
  mandatory?: boolean;
}

let cachedGoogleKey: string | null | undefined = undefined;
let googleLoadPromise: Promise<boolean> | null = null;

async function fetchGoogleKey(): Promise<string | null> {
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

function loadGoogleMaps(apiKey: string): Promise<boolean> {
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

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  onLocationSaved,
  initialCoords,
  editingAddress,
  mandatory = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapEngineRef = useRef<'google' | 'leaflet'>('leaflet');
  const googleGeocoderRef = useRef<any>(null);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeReqIdRef = useRef<number>(0);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasUserMovedMapRef = useRef<boolean>(false);
  const isManualAddressRef = useRef<boolean>(false);

  const [step, setStep] = useState<'map' | 'details'>('map');
  const [mapReady, setMapReady] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialCoords?.latitude || DEFAULT_COORDINATES.latitude,
    lng: initialCoords?.longitude || DEFAULT_COORDINATES.longitude,
  });
  const [addressTitle, setAddressTitle] = useState<'المنزل' | 'العمل' | 'أخرى'>('المنزل');
  const [customTitle, setCustomTitle] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [zones, setZones] = useState<BackendDeliveryZone[]>([]);
  const [detectedZone, setDetectedZone] = useState<BackendDeliveryZone | null>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string;
    lat: number;
    lng: number;
    is_in_zone?: boolean;
    is_current_zone?: boolean;
    zone_name?: string | null;
  }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const mapPolygonsRef = useRef<any[]>([]);
  const zoneDetectReqRef = useRef<number>(0);

  const { createAddress, updateAddress } = useAddressStore();

  const checkZoneForCoords = async (lat: number, lng: number) => {
    const reqId = ++zoneDetectReqRef.current;
    setCheckingZone(true);
    try {
      const res = await restaurantService.detectZone(lat, lng);
      if (reqId !== zoneDetectReqRef.current) return;
      if (res.data) {
        if (Array.isArray(res.data.zones)) setZones(res.data.zones);
        setDetectedZone(res.data.matched_zone || null);
      }
    } catch {
      // ignore transient network failure
    } finally {
      if (reqId === zoneDetectReqRef.current) {
        setCheckingZone(false);
      }
    }
  };

  // Reset or populate fields when modal opens
  useEffect(() => {
    if (visible) {
      setStep('map');
      hasUserMovedMapRef.current = false;
      lastGeocodedRef.current = null;
      if (editingAddress) {
        const lat = Number(editingAddress.latitude) || DEFAULT_COORDINATES.latitude;
        const lng = Number(editingAddress.longitude) || DEFAULT_COORDINATES.longitude;
        setSelectedCoords({ lat, lng });
        lastGeocodedRef.current = { lat, lng };
        isManualAddressRef.current = Boolean(editingAddress.street);
        setStreetAddress(editingAddress.street || '');
        setBuildingNumber(editingAddress.building_number || '');
        setFloor(editingAddress.floor || '');
        setApartmentNumber(editingAddress.apartment_number || '');
        setDeliveryInstructions(editingAddress.delivery_instructions || '');
        if (editingAddress.title === 'المنزل' || editingAddress.title === 'العمل') {
          setAddressTitle(editingAddress.title);
          setCustomTitle('');
        } else {
          setAddressTitle('أخرى');
          setCustomTitle(editingAddress.title || '');
        }
      } else {
        isManualAddressRef.current = false;
        setStreetAddress('');
        setBuildingNumber('');
        setFloor('');
        setApartmentNumber('');
        setDeliveryInstructions('');
        setAddressTitle('المنزل');
        setCustomTitle('');
        setSearchQuery('');
      }
    }
  }, [visible, editingAddress]);

  // Load Google Maps first if key exists, otherwise load clean Carto Voyager OSM via Leaflet
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    let isMounted = true;
    setLoadingMap(true);
    setMapReady(false);

    (async () => {
      const key = await fetchGoogleKey();
      if (!isMounted) return;

      if (key) {
        const ok = await loadGoogleMaps(key);
        if (!isMounted) return;
        if (ok) {
          mapEngineRef.current = 'google';
          setMapReady(true);
          setLoadingMap(false);
          return;
        }
      }

      try {
        await loadLeaflet();
        if (isMounted) {
          mapEngineRef.current = 'leaflet';
          setMapReady(true);
          setLoadingMap(false);
        }
      } catch {
        if (isMounted) setLoadingMap(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const isSameCoord = (lat: number, lng: number) => {
    const prev = lastGeocodedRef.current;
    if (!prev) return false;
    return Math.abs(prev.lat - lat) < 0.00005 && Math.abs(prev.lng - lng) < 0.00005;
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    const reqId = ++geocodeReqIdRef.current;
    lastGeocodedRef.current = { lat, lng };
    setIsGeocoding(true);
    try {
      if (mapEngineRef.current === 'google' && (window as any).google?.maps?.Geocoder) {
        if (!googleGeocoderRef.current) {
          googleGeocoderRef.current = new (window as any).google.maps.Geocoder();
        }
        const ok = await new Promise<boolean>((resolve) => {
          googleGeocoderRef.current.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (reqId !== geocodeReqIdRef.current) {
              resolve(true);
              return;
            }
            if (status === 'OK' && results?.[0]?.formatted_address) {
              if (!isManualAddressRef.current) {
                setStreetAddress(results[0].formatted_address);
              }
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });
        if (ok) return;
      }

      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      if (reqId !== geocodeReqIdRef.current) return;
      if (resp.ok) {
        const data = await resp.json();
        if (reqId === geocodeReqIdRef.current && data?.display_name && !isManualAddressRef.current) {
          setStreetAddress(data.display_name);
        }
      }
    } catch {
      // keep existing street input
    } finally {
      if (reqId === geocodeReqIdRef.current) {
        setIsGeocoding(false);
      }
    }
  };

  const scheduleReverseGeocode = (lat: number, lng: number) => {
    if (isSameCoord(lat, lng)) return;
    if (geocodeDebounceRef.current) {
      clearTimeout(geocodeDebounceRef.current);
    }
    geocodeDebounceRef.current = setTimeout(() => {
      reverseGeocode(lat, lng);
      checkZoneForCoords(lat, lng);
    }, 250);
  };

  // Initialize Map (Google Maps or Carto Voyager OSM fallback)
  useEffect(() => {
    if (!visible || step !== 'map' || !mapReady || !mapContainerRef.current || Platform.OS !== 'web') return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let t1: any;
    let t2: any;

    const startLat = selectedCoords.lat || initialCoords?.latitude || DEFAULT_COORDINATES.latitude;
    const startLng = selectedCoords.lng || initialCoords?.longitude || DEFAULT_COORDINATES.longitude;

    if (mapEngineRef.current === 'google' && (window as any).google?.maps?.Map) {
      const g = (window as any).google.maps;
      const map = new g.Map(mapContainerRef.current, {
        center: { lat: startLat, lng: startLng },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
      });
      mapInstanceRef.current = map;

      map.addListener('dragstart', () => {
        hasUserMovedMapRef.current = true;
        isManualAddressRef.current = false;
      });

      map.addListener('idle', () => {
        if (cancelled) return;
        const c = map.getCenter();
        if (c) {
          const pos = { lat: c.lat(), lng: c.lng() };
          if (!isSameCoord(pos.lat, pos.lng)) {
            setSelectedCoords(pos);
            scheduleReverseGeocode(pos.lat, pos.lng);
          }
        }
      });
    } else if ((window as any).L) {
      const L = (window as any).L;
      if (mapInstanceRef.current?.remove) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      t1 = setTimeout(() => { if (!cancelled) map.invalidateSize({ animate: false }); }, 150);
      t2 = setTimeout(() => { if (!cancelled) map.invalidateSize({ animate: false }); }, 450);

      let lastW = 0;
      let lastH = 0;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        ro = new ResizeObserver((entries) => {
          if (cancelled) return;
          const rect = entries?.[0]?.contentRect;
          if (rect) {
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            if (w <= 0 || h <= 0 || (w === lastW && h === lastH)) return;
            lastW = w;
            lastH = h;
          }
          map.invalidateSize({ animate: false });
        });
        ro.observe(mapContainerRef.current);
      }

      map.on('movestart', () => {
        hasUserMovedMapRef.current = true;
      });

      map.on('moveend', () => {
        if (cancelled) return;
        const c = map.getCenter();
        if (c) {
          const pos = { lat: c.lat, lng: c.lng() };
          if (!isSameCoord(pos.lat, pos.lng)) {
            setSelectedCoords(pos);
            scheduleReverseGeocode(pos.lat, pos.lng);
          }
        }
      });
    }

    if (navigator.geolocation && !initialCoords && !streetAddress) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || hasUserMovedMapRef.current) return;
          const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          panMapTo(userPos.lat, userPos.lng, 16);
          setSelectedCoords(userPos);
          reverseGeocode(userPos.lat, userPos.lng);
          checkZoneForCoords(userPos.lat, userPos.lng);
        },
        () => {
          if (!cancelled && !streetAddress && !hasUserMovedMapRef.current) {
            reverseGeocode(startLat, startLng);
            checkZoneForCoords(startLat, startLng);
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else if (!streetAddress) {
      reverseGeocode(startLat, startLng);
      checkZoneForCoords(startLat, startLng);
    }

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      if (geocodeDebounceRef.current) {
        clearTimeout(geocodeDebounceRef.current);
        geocodeDebounceRef.current = null;
      }
      if (ro) ro.disconnect();
      mapPolygonsRef.current.forEach((p) => {
        try {
          if (p?.setMap) p.setMap(null);
          else if (p?.remove) p.remove();
        } catch {}
      });
      mapPolygonsRef.current = [];
      if (mapEngineRef.current === 'google' && (window as any).google?.maps?.event && mapInstanceRef.current) {
        (window as any).google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
      } else if (mapEngineRef.current === 'leaflet' && mapInstanceRef.current?.remove) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [visible, step, mapReady]);

  // Fetch & draw active DeliveryZone polygons on the map
  useEffect(() => {
    if (!visible || step !== 'map') return;
    checkZoneForCoords(selectedCoords.lat, selectedCoords.lng);
  }, [visible, step]);

  useEffect(() => {
    if (!visible || step !== 'map' || !mapReady || !mapInstanceRef.current || zones.length === 0 || Platform.OS !== 'web') return;

    mapPolygonsRef.current.forEach((p) => {
      try {
        if (p?.setMap) p.setMap(null);
        else if (p?.remove) p.remove();
      } catch {}
    });
    mapPolygonsRef.current = [];

    if (mapEngineRef.current === 'google' && (window as any).google?.maps) {
      const g = (window as any).google.maps;
      const map = mapInstanceRef.current;
      zones.forEach((z) => {
        if (z.polygon_coordinates && z.polygon_coordinates.length >= 3) {
          const isMatched = detectedZone?.id === z.id;
          const poly = new g.Polygon({
            paths: z.polygon_coordinates.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: isMatched ? '#D70F64' : '#64748B',
            strokeOpacity: 0.85,
            strokeWeight: isMatched ? 2.2 : 1.2,
            fillColor: isMatched ? '#D70F64' : '#94A3B8',
            fillOpacity: isMatched ? 0.14 : 0.05,
            clickable: false,
          });
          poly.setMap(map);
          mapPolygonsRef.current.push(poly);
        }
      });
    } else if ((window as any).L) {
      const L = (window as any).L;
      const map = mapInstanceRef.current;
      zones.forEach((z) => {
        if (z.polygon_coordinates && z.polygon_coordinates.length >= 3) {
          const isMatched = detectedZone?.id === z.id;
          const poly = L.polygon(z.polygon_coordinates, {
            color: isMatched ? '#D70F64' : '#64748B',
            weight: isMatched ? 2.2 : 1.2,
            fillColor: isMatched ? '#D70F64' : '#94A3B8',
            fillOpacity: isMatched ? 0.14 : 0.05,
          }).addTo(map);
          mapPolygonsRef.current.push(poly);
        }
      });
    }
  }, [visible, step, mapReady, zones, detectedZone?.id]);

  const panMapTo = (lat: number, lng: number, zoom: number = 16) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (mapEngineRef.current === 'google') {
      if (map.getZoom && map.getZoom() !== zoom) {
        map.setZoom(zoom);
      }
      map.setCenter({ lat, lng });
    } else if (map.setView) {
      map.setView([lat, lng], zoom, { animate: false });
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        panMapTo(userPos.lat, userPos.lng, 17);
        setSelectedCoords(userPos);
        reverseGeocode(userPos.lat, userPos.lng);
        checkZoneForCoords(userPos.lat, userPos.lng);
      },
      () => {
        setIsLocating(false);
        alert('تعذر تحديد موقعك الحالي. يرجى تفعيل إذن الموقع في المتصفح.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await api.get(
        `/api/v1/auth/geocode-search/?q=${encodeURIComponent(searchQuery.trim())}&lat=${selectedCoords.lat}&lng=${selectedCoords.lng}`
      );
      const results = res.data?.results || [];
      if (Array.isArray(results) && results.length > 0) {
        setSearchResults(results);
        setShowSearchResults(true);
        const firstValid = results.find((r: any) => r.is_in_zone !== false);
        if (firstValid && results.length === 1) {
          const targetPos = { lat: Number(firstValid.lat), lng: Number(firstValid.lng) };
          lastGeocodedRef.current = targetPos;
          panMapTo(targetPos.lat, targetPos.lng, 16);
          setSelectedCoords(targetPos);
          setStreetAddress(firstValid.display_name || searchQuery);
          checkZoneForCoords(targetPos.lat, targetPos.lng);
          setShowSearchResults(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
        alert('لم يتم العثور على المكان، يرجى كتابة اسم مدينة أو حي معروف.');
      }
    } catch {
      alert('تعذر البحث عن العنوان حالياً.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectSearchSuggestion = (item: {
    display_name: string;
    lat: number;
    lng: number;
    is_in_zone?: boolean;
  }) => {
    if (item.is_in_zone === false) return;
    const targetPos = { lat: Number(item.lat), lng: Number(item.lng) };
    lastGeocodedRef.current = targetPos;
    panMapTo(targetPos.lat, targetPos.lng, 16);
    setSelectedCoords(targetPos);
    setStreetAddress(item.display_name);
    setShowSearchResults(false);
    checkZoneForCoords(targetPos.lat, targetPos.lng);
  };

  const handleSaveAddress = async () => {
    if (!detectedZone) {
      alert('التوصيل غير متوفر في هذه المنطقة في الوقت الحالي، يرجى تحديد موقع داخل مناطق التوصيل.');
      return;
    }
    if (!streetAddress.trim()) {
      alert('يرجى تحديد الشارع أو الموقع على الخريطة.');
      return;
    }

    const finalTitle = addressTitle === 'أخرى' && customTitle.trim() ? customTitle.trim() : addressTitle;

    setIsSubmitting(true);
    const payload = {
      title: finalTitle,
      street: streetAddress.trim(),
      building_number: buildingNumber.trim(),
      floor: floor.trim(),
      apartment_number: apartmentNumber.trim(),
      delivery_instructions: deliveryInstructions.trim(),
      latitude: Number(selectedCoords.lat.toFixed(6)),
      longitude: Number(selectedCoords.lng.toFixed(6)),
      is_default: true,
    };

    const savedAddress = editingAddress?.id
      ? await updateAddress(editingAddress.id, payload)
      : await createAddress(payload);

    setIsSubmitting(false);
    if (savedAddress) {
      if (onLocationSaved) onLocationSaved(savedAddress);
      onClose();
    } else {
      alert('تعذر حفظ موقع التوصيل. يرجى إعادة المحاولة.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={mandatory ? () => {} : onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          {step === 'details' ? (
            <TouchableOpacity onPress={() => setStep('map')} style={styles.closeBtn}>
              <ArrowRight size={20} color="#111827" />
            </TouchableOpacity>
          ) : mandatory ? (
            <View style={{ width: 38 }} />
          ) : (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.topBarTitle}>
            {step === 'map'
              ? mandatory
                ? 'حدد موقعك لعرض المتاجر القريبة'
                : 'تحديد موقع التوصيل'
              : 'تفاصيل العنوان'}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        {step === 'map' ? (
          <>
            {/* Unified Sleek Search Input + Prioritized Zone Results */}
            <View style={styles.searchBarRow}>
              <View style={styles.searchBox}>
                <TouchableOpacity onPress={handleSearchAddress} style={styles.searchIconInner}>
                  <Search size={18} color="#6B7280" />
                </TouchableOpacity>
                <TextInput
                  placeholder="ابحث عن حي، شارع، أو معلم..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={(txt) => {
                    setSearchQuery(txt);
                    if (!txt.trim()) setShowSearchResults(false);
                  }}
                  onSubmitEditing={handleSearchAddress}
                  style={[styles.searchInput, { outlineStyle: 'none' } as any]}
                />
              </View>

              {showSearchResults && searchResults.length > 0 && (
                <ScrollView style={styles.searchDropdown} keyboardShouldPersistTaps="handled">
                  {searchResults.map((resItem, idx) => {
                    const outOfZone = resItem.is_in_zone === false;
                    return (
                      <TouchableOpacity
                        key={`${resItem.lat}-${resItem.lng}-${idx}`}
                        disabled={outOfZone}
                        onPress={() => handleSelectSearchSuggestion(resItem)}
                        style={[
                          styles.searchResultRow,
                          outOfZone && { opacity: 0.55 },
                        ]}
                      >
                        <MapPin size={15} color={outOfZone ? '#9CA3AF' : '#D70F64'} />
                        <Text style={styles.searchResultText} numberOfLines={2}>
                          {resItem.display_name}
                        </Text>
                        <View
                          style={[
                            styles.searchResultBadge,
                            {
                              backgroundColor: outOfZone
                                ? '#F3F4F6'
                                : resItem.is_current_zone
                                ? '#ECFDF5'
                                : '#FDF2F8',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.searchResultBadgeText,
                              {
                                color: outOfZone
                                  ? '#6B7280'
                                  : resItem.is_current_zone
                                  ? '#059669'
                                  : '#D70F64',
                              },
                            ]}
                          >
                            {outOfZone
                              ? 'خارج نطاق التوصيل'
                              : resItem.is_current_zone
                              ? 'منطقتك الحالية'
                              : resItem.zone_name || 'متاح'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Full 75% Map Area */}
            <View style={styles.mapWrapper}>
              <div ref={mapContainerRef as any} style={{ width: '100%', height: '100%' }} />

              {loadingMap && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#D70F64" />
                </View>
              )}

              {/* Clean Ultra-Thin Needle Pin */}
              <View pointerEvents="none" style={styles.centerMarkerContainer}>
                <CreativeLocationPin size={10} />
              </View>

              {/* GPS Button */}
              <TouchableOpacity
                onPress={handleCurrentLocation}
                style={styles.gpsButton}
                disabled={isLocating}
                activeOpacity={0.85}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#D70F64" />
                ) : (
                  <Crosshair size={20} color="#111827" />
                )}
              </TouchableOpacity>
            </View>

            {/* Compact Step 1 Confirmation Footer with Manual Address Edit + Note */}
            <View style={styles.mapFooter}>
              <View style={styles.footerInputBox}>
                <MapPin size={18} color="#D70F64" />
                <TextInput
                  placeholder={isGeocoding ? 'جاري تحديد العنوان...' : 'اكتب أو عدّل العنوان يدوياً...'}
                  placeholderTextColor="#9CA3AF"
                  value={streetAddress}
                  onChangeText={(val) => {
                    isManualAddressRef.current = true;
                    setStreetAddress(val);
                  }}
                  style={[styles.footerTextInput, { outlineStyle: 'none' } as any]}
                />
                {isGeocoding ? (
                  <ActivityIndicator size="small" color="#D70F64" />
                ) : (
                  <Pencil size={15} color="#9CA3AF" />
                )}
              </View>

              <View style={styles.footerInputBox}>
                <FileText size={17} color="#6B7280" />
                <TextInput
                  placeholder="إضافة ملاحظة للمندوب (اختياري)..."
                  placeholderTextColor="#9CA3AF"
                  value={deliveryInstructions}
                  onChangeText={setDeliveryInstructions}
                  style={[styles.footerTextInput, { outlineStyle: 'none' } as any]}
                />
              </View>

              {(() => {
                const isOutOfZone = !checkingZone && !detectedZone;
                const jumpableZones = zones.filter(
                  (z) => z.center || (z.polygon_coordinates && z.polygon_coordinates.length >= 3)
                );
                return (
                  <>
                    {isOutOfZone && (
                      <View style={styles.outOfZoneBanner}>
                        <View style={styles.outOfZoneTopRow}>
                          <AlertCircle size={16} color="#DC2626" />
                          <Text style={styles.outOfZoneText}>
                            التوصيل غير متوفر في هذه المنطقة في الوقت الحالي
                          </Text>
                        </View>
                        {jumpableZones.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.zoneJumpRow}
                          >
                            {jumpableZones.map((z) => {
                              const lat = z.center?.latitude ?? z.polygon_coordinates[0][0];
                              const lng = z.center?.longitude ?? z.polygon_coordinates[0][1];
                              return (
                                <TouchableOpacity
                                  key={z.id}
                                  style={styles.zoneJumpPill}
                                  onPress={() => {
                                    panMapTo(lat, lng, 13);
                                    setSelectedCoords({ lat, lng });
                                    reverseGeocode(lat, lng);
                                    checkZoneForCoords(lat, lng);
                                  }}
                                >
                                  <MapPin size={12} color="#D70F64" />
                                  <Text style={styles.zoneJumpPillText}>{z.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => setStep('details')}
                      disabled={isOutOfZone || checkingZone}
                      style={[
                        styles.primaryBtn,
                        (isOutOfZone || checkingZone) && { backgroundColor: '#D1D5DB' },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.primaryBtnText}>
                        {checkingZone
                          ? 'جاري التحقق من المنطقة...'
                          : isOutOfZone
                          ? 'التوصيل غير متوفر هنا'
                          : 'تأكيد الموقع'}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </>
        ) : (
          /* Step 2: Clean Address Details Form */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
            {/* Selected Location Summary */}
            <TouchableOpacity
              onPress={() => setStep('map')}
              activeOpacity={0.8}
              style={styles.selectedSummaryCard}
            >
              <View style={styles.summaryIconCircle}>
                <MapPin size={18} color="#D70F64" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle} numberOfLines={2}>
                  {streetAddress || 'الموقع المحدد على الخريطة'}
                </Text>
                <Text style={styles.summaryChangeLink}>تغيير الموقع من الخريطة</Text>
              </View>
            </TouchableOpacity>

            {/* Address Type */}
            <Text style={styles.fieldLabel}>نوع العنوان</Text>
            <View style={styles.titleButtonsRow}>
              <TouchableOpacity
                onPress={() => setAddressTitle('المنزل')}
                style={[styles.titleBadge, addressTitle === 'المنزل' && styles.titleBadgeActive]}
              >
                <Home size={15} color={addressTitle === 'المنزل' ? '#D70F64' : '#4B5563'} />
                <Text style={[styles.titleBadgeText, addressTitle === 'المنزل' && styles.titleBadgeTextActive]}>
                  المنزل
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAddressTitle('العمل')}
                style={[styles.titleBadge, addressTitle === 'العمل' && styles.titleBadgeActive]}
              >
                <Briefcase size={15} color={addressTitle === 'العمل' ? '#D70F64' : '#4B5563'} />
                <Text style={[styles.titleBadgeText, addressTitle === 'العمل' && styles.titleBadgeTextActive]}>
                  العمل
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAddressTitle('أخرى')}
                style={[styles.titleBadge, addressTitle === 'أخرى' && styles.titleBadgeActive]}
              >
                <MapPin size={15} color={addressTitle === 'أخرى' ? '#D70F64' : '#4B5563'} />
                <Text style={[styles.titleBadgeText, addressTitle === 'أخرى' && styles.titleBadgeTextActive]}>
                  أخرى
                </Text>
              </TouchableOpacity>
            </View>

            {addressTitle === 'أخرى' && (
              <TextInput
                placeholder="اسم مخصص (مثال: منزل العائلة)"
                placeholderTextColor="#9CA3AF"
                value={customTitle}
                onChangeText={setCustomTitle}
                style={[styles.inputField, { marginTop: 10, outlineStyle: 'none' } as any]}
              />
            )}

            {/* Street */}
            <Text style={styles.fieldLabel}>الشارع والحي</Text>
            <TextInput
              placeholder="اسم الشارع أو الحي"
              placeholderTextColor="#9CA3AF"
              value={streetAddress}
              onChangeText={setStreetAddress}
              style={[styles.inputField, { outlineStyle: 'none' } as any]}
            />

            {/* Building / Floor / Apt */}
            <View style={styles.inputsRow}>
              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>رقم العمارة</Text>
                <TextInput
                  placeholder="14"
                  placeholderTextColor="#9CA3AF"
                  value={buildingNumber}
                  onChangeText={setBuildingNumber}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>

              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>الدور</Text>
                <TextInput
                  placeholder="3"
                  placeholderTextColor="#9CA3AF"
                  value={floor}
                  onChangeText={setFloor}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>

              <View style={styles.rowField}>
                <Text style={styles.fieldLabelSmall}>الشقة</Text>
                <TextInput
                  placeholder="5"
                  placeholderTextColor="#9CA3AF"
                  value={apartmentNumber}
                  onChangeText={setApartmentNumber}
                  style={[styles.inputField, { outlineStyle: 'none' } as any]}
                />
              </View>
            </View>

            {/* Delivery Instructions */}
            <Text style={styles.fieldLabel}>تعليمات للمندوب (اختياري)</Text>
            <TextInput
              placeholder="مثال: الجرس لا يعمل، اتصل عند الوصول"
              placeholderTextColor="#9CA3AF"
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              style={[styles.inputField, { outlineStyle: 'none' } as any]}
            />

            <TouchableOpacity
              onPress={handleSaveAddress}
              style={[styles.primaryBtn, { marginTop: 20 }]}
              disabled={isSubmitting}
              activeOpacity={0.9}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveBtnInner}>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>حفظ العنوان</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
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
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  searchBarRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
  },
  searchIconInner: {
    padding: 6,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  searchDropdown: {
    maxHeight: 200,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  searchResultText: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    textAlign: 'right',
  },
  searchResultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  searchResultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  outOfZoneBanner: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  outOfZoneTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outOfZoneText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'right',
  },
  zoneJumpRow: {
    flexDirection: 'row',
    gap: 6,
  },
  zoneJumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  zoneJumpPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D70F64',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 950,
  },
  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 24,
    height: 28,
    marginLeft: -12,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 900,
  },
  gpsButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 900,
  },
  mapFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  footerInputBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    height: 42,
  },
  footerTextInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#D70F64',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formScroll: {
    padding: 16,
    paddingBottom: 32,
  },
  selectedSummaryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  summaryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryChangeLink: {
    fontSize: 12,
    color: '#D70F64',
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
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
    flexDirection: 'row-reverse',
    gap: 8,
  },
  titleBadge: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  titleBadgeActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#D70F64',
  },
  titleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  titleBadgeTextActive: {
    color: '#D70F64',
  },
  inputField: {
    height: 44,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  inputsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 12,
  },
  rowField: {
    flex: 1,
  },
});
