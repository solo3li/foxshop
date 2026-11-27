import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Store,
  MapPin,
  CheckCircle2,
  Crosshair,
  Bike,
  Truck,
  User as UserIcon,
  Phone,
  Lock,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../hooks/use-theme';
import {
  restaurantService,
  BackendStoreSector,
  BackendDeliveryZone,
} from '../services/restaurantService';
import { loadLeaflet } from '../utils/leafletLoader';
import { fetchGoogleMapsKey, loadGoogleMapsScript } from '../utils/googleMapsLoader';
import { DEFAULT_COORDINATES } from '../constants/config';
import { CreativeLocationPin } from '../components/CreativeLocationPin';

const FALLBACK_SECTORS: BackendStoreSector[] = [
  { id: 'RESTAURANT', code: 'RESTAURANT', name: 'مطاعم ومأكولات', short_title: 'مطاعم', sort_order: 1, is_active: true },
  { id: 'SUPERMARKET', code: 'SUPERMARKET', name: 'سوبرماركت وبقالة', short_title: 'سوبرماركت', sort_order: 2, is_active: true },
  { id: 'PHARMACY', code: 'PHARMACY', name: 'صيدليات وعناية', short_title: 'صيدليات', sort_order: 3, is_active: true },
  { id: 'BUTCHERY_VEG', code: 'BUTCHERY_VEG', name: 'لحوم وخضار طازجة', short_title: 'لحوم وخضار', sort_order: 4, is_active: true },
  { id: 'FLOWERS_GIFTS', code: 'FLOWERS_GIFTS', name: 'زهور وهدايا', short_title: 'زهور وهدايا', sort_order: 5, is_active: true },
  { id: 'GENERAL_RETAIL', code: 'GENERAL_RETAIL', name: 'متاجر وتجزئة عامة', short_title: 'تجزئة عامة', sort_order: 6, is_active: true },
];

export default function PartnerApplyScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Dynamic metadata from backend
  const [sectors, setSectors] = useState<BackendStoreSector[]>(FALLBACK_SECTORS);
  const [zones, setZones] = useState<BackendDeliveryZone[]>([]);
  const [selectedSectorCode, setSelectedSectorCode] = useState<string>('RESTAURANT');
  const [selectedSectorId, setSelectedSectorId] = useState<string | undefined>(undefined);

  // Location & auto-detected zone state
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
  });
  const [detectedZone, setDetectedZone] = useState<BackendDeliveryZone | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [detectingZone, setDetectingZone] = useState(false);

  // Store & Owner form state
  const [storeName, setStoreName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PLATFORM_MANAGED' | 'STORE_OWN_FLEET'>('PLATFORM_MANAGED');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    message: string;
    storeName: string;
    zoneName: string | null;
  } | null>(null);

  // Web Map refs (Google Maps primary, Leaflet OSM fallback)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapEngineRef = useRef<'google' | 'leaflet'>('google');
  const mapPolygonsRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectReqIdRef = useRef(0);

  // 1. Load dynamic sectors & zones on mount
  useEffect(() => {
    restaurantService.getSectors().then((res) => {
      if (res.data?.sectors && res.data.sectors.length > 0) {
        setSectors(res.data.sectors);
        setSelectedSectorCode(res.data.sectors[0].code);
        setSelectedSectorId(res.data.sectors[0].id);
      }
    }).catch(() => {});

    restaurantService.detectZone(DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude).then((res) => {
      if (res.data) {
        setZones(res.data.zones || []);
        if (res.data.matched_zone) {
          setDetectedZone(res.data.matched_zone);
          setSelectedZoneId(res.data.matched_zone.id);
        }
      }
    }).catch(() => {});
  }, []);

  // 2. Auto-detect zone whenever pin coordinates change
  const runZoneDetection = useCallback((lat: number, lng: number) => {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    detectTimerRef.current = setTimeout(async () => {
      const reqId = ++detectReqIdRef.current;
      setDetectingZone(true);
      try {
        const res = await restaurantService.detectZone(lat, lng);
        if (reqId !== detectReqIdRef.current) return;
        if (res.data) {
          if (res.data.zones) setZones(res.data.zones);
          setDetectedZone(res.data.matched_zone || null);
          if (res.data.matched_zone) {
            setSelectedZoneId(res.data.matched_zone.id);
          }
        }
      } catch {
        // Ignore transient network errors during pan
      } finally {
        if (reqId === detectReqIdRef.current) {
          setDetectingZone(false);
        }
      }
    }, 350);
  }, []);

  // 3. Initialize interactive Web Map (Google Maps primary, OpenStreetMap fallback)
  useEffect(() => {
    if (Platform.OS !== 'web' || successData) return;
    let isCancelled = false;

    const initMap = async () => {
      const key = await fetchGoogleMapsKey();
      if (isCancelled || !mapContainerRef.current) return;

      if (key) {
        const loaded = await loadGoogleMapsScript(key);
        if (isCancelled || !mapContainerRef.current) return;
        if (loaded && (window as any).google?.maps?.Map) {
          const google = (window as any).google;
          mapEngineRef.current = 'google';
          const map = new google.maps.Map(mapContainerRef.current, {
            center: { lat: coords.latitude, lng: coords.longitude },
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
          });

          map.addListener('idle', () => {
            const center = map.getCenter();
            if (!center) return;
            const lat = Number(center.lat().toFixed(6));
            const lng = Number(center.lng().toFixed(6));
            setCoords({ latitude: lat, longitude: lng });
            runZoneDetection(lat, lng);
          });

          map.addListener('click', (e: any) => {
            if (e?.latLng) map.panTo(e.latLng);
          });

          mapRef.current = map;
          setMapReady(true);
          return;
        }
      }

      try {
        const L = await loadLeaflet();
        if (isCancelled || !mapContainerRef.current || mapRef.current) return;
        mapEngineRef.current = 'leaflet';

        const map = L.map(mapContainerRef.current, {
          center: [coords.latitude, coords.longitude],
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        map.on('moveend', () => {
          const center = map.getCenter();
          const lat = Number(center.lat.toFixed(6));
          const lng = Number(center.lng.toFixed(6));
          setCoords({ latitude: lat, longitude: lng });
          runZoneDetection(lat, lng);
        });

        map.on('click', (e: any) => {
          map.panTo(e.latlng);
        });

        mapRef.current = map;
        setMapReady(true);
      } catch {
        // Map load failure handled gracefully by zone dropdown
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      mapPolygonsRef.current.forEach((p) => {
        try {
          if (p?.setMap) p.setMap(null);
          else if (p?.remove) p.remove();
        } catch {}
      });
      mapPolygonsRef.current = [];
      if (mapRef.current && mapEngineRef.current === 'leaflet' && mapRef.current.remove) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
  }, [successData]);

  // 4. Draw zone polygons on active map (Google Maps or Leaflet)
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapReady || !mapRef.current || zones.length === 0) return;
    let isCancelled = false;

    // Clear previous polygons before redrawing highlight
    mapPolygonsRef.current.forEach((p) => {
      try {
        if (p?.setMap) p.setMap(null);
        else if (p?.remove) p.remove();
      } catch {}
    });
    mapPolygonsRef.current = [];

    if (mapEngineRef.current === 'google' && (window as any).google?.maps) {
      const google = (window as any).google;
      const map = mapRef.current;
      zones.forEach((zone) => {
        if (zone.polygon_coordinates && zone.polygon_coordinates.length >= 3) {
          const isMatched = (selectedZoneId || detectedZone?.id) === zone.id;
          const poly = new google.maps.Polygon({
            paths: zone.polygon_coordinates.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: isMatched ? '#D70F64' : '#64748B',
            strokeOpacity: 0.85,
            strokeWeight: isMatched ? 2.5 : 1.2,
            fillColor: isMatched ? '#D70F64' : '#94A3B8',
            fillOpacity: isMatched ? 0.16 : 0.06,
            clickable: false,
          });
          poly.setMap(map);
          mapPolygonsRef.current.push(poly);
        }
      });
      return;
    }

    loadLeaflet().then((L) => {
      if (isCancelled || !mapRef.current) return;
      const map = mapRef.current;

      zones.forEach((zone) => {
        if (zone.polygon_coordinates && zone.polygon_coordinates.length >= 3) {
          const isMatched = (selectedZoneId || detectedZone?.id) === zone.id;
          const poly = L.polygon(zone.polygon_coordinates, {
            color: isMatched ? '#D70F64' : '#64748B',
            weight: isMatched ? 2.5 : 1.2,
            fillColor: isMatched ? '#D70F64' : '#94A3B8',
            fillOpacity: isMatched ? 0.16 : 0.06,
          }).addTo(map);
          poly.bindTooltip(zone.name, { sticky: true });
          mapPolygonsRef.current.push(poly);
        }
      });
    }).catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [mapReady, zones, selectedZoneId, detectedZone?.id]);

  // Pan map when user selects a zone from the chips
  const handleSelectZoneFromList = (zone: BackendDeliveryZone) => {
    setSelectedZoneId(zone.id);
    setDetectedZone(zone);
    const targetLat = zone.center?.latitude ?? zone.polygon_coordinates?.[0]?.[0];
    const targetLng = zone.center?.longitude ?? zone.polygon_coordinates?.[0]?.[1];
    if (targetLat !== undefined && targetLng !== undefined) {
      setCoords({ latitude: targetLat, longitude: targetLng });
      if (Platform.OS === 'web' && mapRef.current) {
        if (mapEngineRef.current === 'google') {
          mapRef.current.panTo({ lat: targetLat, lng: targetLng });
          mapRef.current.setZoom(13);
        } else {
          mapRef.current.setView([targetLat, targetLng], 13, { animate: true });
        }
      }
    }
  };

  const handleUseMyLocation = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setCoords({ latitude: lat, longitude: lng });
          if (mapRef.current) {
            if (mapEngineRef.current === 'google') {
              mapRef.current.panTo({ lat, lng });
              mapRef.current.setZoom(14);
            } else {
              mapRef.current.setView([lat, lng], 14, { animate: true });
            }
          }
          runZoneDetection(lat, lng);
        },
        () => {
          setErrorMsg('تعذر تحديد موقعك الحالي عبر المتصفح، يرجى تحريك الخريطة يدوياً.');
        }
      );
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!detectedZone) {
      return setErrorMsg('التوصيل غير متوفر في هذه المنطقة في الوقت الحالي، يرجى تحديد موقع المتجر داخل حدود المناطق المرسومة على الخريطة.');
    }

    if (!storeName.trim()) return setErrorMsg('يرجى إدخال اسم المطعم أو المتجر.');
    if (!addressText.trim()) return setErrorMsg('يرجى إدخال العنوان النصي للمتجر.');
    if (!firstName.trim()) return setErrorMsg('يرجى إدخال الاسم الأول للمسؤول.');
    if (!phoneNumber.trim()) return setErrorMsg('يرجى إدخال رقم الهاتف.');
    if (!username.trim()) return setErrorMsg('يرجى إدخال اسم المستخدم للدخول لبوابة التاجر.');
    if (password.length < 6) return setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');

    setSubmitting(true);
    try {
      const res = await restaurantService.registerPartner({
        store_name: storeName.trim(),
        store_type: selectedSectorCode,
        sector_id: selectedSectorId && selectedSectorId !== selectedSectorCode ? selectedSectorId : undefined,
        description: description.trim(),
        address_text: addressText.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        delivery_zone_id: selectedZoneId || detectedZone?.id || null,
        delivery_mode: deliveryMode,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
        username: username.trim(),
        password,
      });

      if (res.data) {
        setSuccessData({
          message: res.data.message,
          storeName: res.data.store_name,
          zoneName: res.data.detected_zone?.name || detectedZone?.name || null,
        });
      } else {
        setErrorMsg(res.error || 'تعذر إرسال الطلب، يرجى مراجعة البيانات المدخلة.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successData) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: Platform.OS === 'web' ? '#F3F4F6' : theme.background,
        }}
      >
        <View style={[styles.container, styles.successContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.successIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <CheckCircle2 size={46} color="#10B981" strokeWidth={1.8} />
          </View>
          <Text style={[styles.successTitle, { color: theme.text }]}>
            تم استلام طلب انضمام «{successData.storeName}»
          </Text>
          <Text style={[styles.successSub, { color: theme.textSecondary }]}>
            {successData.message}
          </Text>
          {successData.zoneName && (
            <View style={[styles.zoneSuccessPill, { backgroundColor: theme.primaryLight }]}>
              <MapPin size={15} color={theme.primary} />
              <Text style={[styles.zoneSuccessText, { color: theme.primary }]}>
                المنطقة المرتبطة: {successData.zoneName}
              </Text>
            </View>
          )}
          <Text style={[styles.successNote, { color: theme.textMuted }]}>
            بعد موافقة الإدارة، يمكنك تسجيل الدخول مباشرة عبر بوابة التاجر باستخدام اسم المستخدم وكلمة المرور المسجلين.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 20, width: '100%' }]}
            onPress={() => router.replace('/(tabs)/account' as any)}
          >
            <Text style={styles.primaryBtnText}>العودة لحسابي</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeZoneObj = zones.find((z) => z.id === (selectedZoneId || detectedZone?.id)) || detectedZone;
  const isOutOfZone = !detectingZone && !detectedZone;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: Platform.OS === 'web' ? '#F3F4F6' : theme.background,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Minimalist Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/account' as any))}
            style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
            activeOpacity={0.75}
          >
            <ArrowRight size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>انضم كشريك • سجّل متجرك</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro */}
          <View style={styles.introBlock}>
            <View style={[styles.introIconWrap, { backgroundColor: theme.primaryLight }]}>
              <Store size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.introTitle, { color: theme.text }]}>قدّم طلب انضمام متجرك إلى فوكس شوب</Text>
              <Text style={[styles.introSub, { color: theme.textSecondary }]}>
                حدّد موقع متجرك على الخريطة ليتم ربطه بالمنطقة تلقائياً وإرساله لمراجعة الإدارة.
              </Text>
            </View>
          </View>

          {errorMsg && (
            <View style={[styles.errorBanner, { backgroundColor: theme.errorLight }]}>
              <AlertCircle size={16} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
            </View>
          )}

          {/* 1. Location & Auto-Detected Zone Map */}
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                1. موقع المتجر والمنطقة على الخريطة
              </Text>
              {Platform.OS === 'web' && (
                <TouchableOpacity style={styles.gpsBtn} onPress={handleUseMyLocation}>
                  <Crosshair size={14} color={theme.primary} />
                  <Text style={[styles.gpsBtnText, { color: theme.primary }]}>موقعي الحالي</Text>
                </TouchableOpacity>
              )}
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.mapFrame}>
                <div
                  ref={mapContainerRef}
                  style={{ width: '100%', height: '100%', borderRadius: 18 }}
                />
                <View style={styles.centerPinOverlay} pointerEvents="none">
                  <CreativeLocationPin />
                </View>
              </View>
            ) : (
              <View style={[styles.mobileCoordsBox, { backgroundColor: theme.surfaceSecondary }]}>
                <MapPin size={20} color={theme.primary} />
                <Text style={[styles.mobileCoordsText, { color: theme.text }]}>
                  الإحداثيات: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </Text>
              </View>
            )}

            {/* Auto-Detected Zone Status Pill */}
            <View
              style={[
                styles.detectedZoneBox,
                {
                  backgroundColor: activeZoneObj
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isOutOfZone
                    ? theme.errorLight
                    : 'rgba(245, 158, 11, 0.08)',
                },
              ]}
            >
              <View style={styles.detectedZoneRow}>
                <MapPin
                  size={16}
                  color={activeZoneObj ? '#059669' : isOutOfZone ? theme.error : '#D97706'}
                />
                <Text
                  style={[
                    styles.detectedZoneText,
                    { color: activeZoneObj ? '#065F46' : isOutOfZone ? theme.error : '#92400E' },
                  ]}
                >
                  {detectingZone
                    ? 'جاري تحديد المنطقة تلقائياً...'
                    : activeZoneObj
                    ? `المنطقة المحددة تلقائياً: ${activeZoneObj.name} (${activeZoneObj.city})`
                    : 'هذه المنطقة غير متاحة في الوقت الحالي — حرّك الدبوس داخل إحدى المناطق المرسومة على الخريطة'}
                </Text>
              </View>
            </View>

            {/* Manual Zone Quick Switcher */}
            {zones.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {zones.map((z) => {
                  const selected = (selectedZoneId || detectedZone?.id) === z.id;
                  return (
                    <TouchableOpacity
                      key={z.id}
                      style={[
                        styles.pillChip,
                        {
                          backgroundColor: selected ? theme.primary : '#F5F6F8',
                        },
                      ]}
                      onPress={() => handleSelectZoneFromList(z)}
                    >
                      <Text style={[styles.pillChipText, { color: selected ? '#FFFFFF' : theme.text }]}>
                        {z.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* 2. Store Info & Dynamic Sector */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>2. بيانات المتجر والقسم</Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>القسم / النشاط</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {sectors.map((sec) => {
                const selected = selectedSectorCode === sec.code;
                return (
                  <TouchableOpacity
                    key={sec.id || sec.code}
                    style={[
                      styles.pillChip,
                      { backgroundColor: selected ? theme.primaryLight : '#F5F6F8' },
                    ]}
                    onPress={() => {
                      setSelectedSectorCode(sec.code);
                      setSelectedSectorId(sec.id !== sec.code ? sec.id : undefined);
                    }}
                  >
                    <Sparkles size={13} color={selected ? theme.primary : theme.textMuted} />
                    <Text
                      style={[
                        styles.pillChipText,
                        { color: selected ? theme.primary : theme.text },
                      ]}
                    >
                      {sec.short_title || sec.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>اسم المطعم أو المتجر *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F8FAFC', color: theme.text }]}
              placeholder="مثال: مطعم فوكس للمشويات"
              placeholderTextColor={theme.textMuted}
              value={storeName}
              onChangeText={setStoreName}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>العنوان التفصيلي *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F8FAFC', color: theme.text }]}
              placeholder="اسم الشارع، المعلم القريب، رقم المبنى"
              placeholderTextColor={theme.textMuted}
              value={addressText}
              onChangeText={setAddressText}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>نبذة مختصرة (اختياري)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F8FAFC', color: theme.text }]}
              placeholder="تخصص المتجر أو أشهر الأصناف"
              placeholderTextColor={theme.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>نظام التوصيل</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor:
                      deliveryMode === 'PLATFORM_MANAGED' ? theme.primaryLight : '#F8FAFC',
                  },
                ]}
                onPress={() => setDeliveryMode('PLATFORM_MANAGED')}
              >
                <Bike
                  size={18}
                  color={deliveryMode === 'PLATFORM_MANAGED' ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.modeText,
                    { color: deliveryMode === 'PLATFORM_MANAGED' ? theme.primary : theme.text },
                  ]}
                >
                  كباتن المنصة
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor:
                      deliveryMode === 'STORE_OWN_FLEET' ? theme.primaryLight : '#F8FAFC',
                  },
                ]}
                onPress={() => setDeliveryMode('STORE_OWN_FLEET')}
              >
                <Truck
                  size={18}
                  color={deliveryMode === 'STORE_OWN_FLEET' ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.modeText,
                    { color: deliveryMode === 'STORE_OWN_FLEET' ? theme.primary : theme.text },
                  ]}
                >
                  أسطول المتجر الخاص
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Owner / Merchant Account Credentials */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              3. بيانات المسؤول وحساب الدخول لبوابة التاجر
            </Text>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>الاسم الأول *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#F8FAFC', color: theme.text }]}
                  placeholder="أحمد"
                  placeholderTextColor={theme.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>الاسم الأخير</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#F8FAFC', color: theme.text }]}
                  placeholder="محمد"
                  placeholderTextColor={theme.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>رقم الهاتف *</Text>
            <View style={[styles.iconInput, { backgroundColor: '#F8FAFC' }]}>
              <Phone size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.innerInput, { color: theme.text }]}
                placeholder="01012345678"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>اسم المستخدم (للدخول) *</Text>
            <View style={[styles.iconInput, { backgroundColor: '#F8FAFC' }]}>
              <UserIcon size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.innerInput, { color: theme.text }]}
                placeholder="fox_restaurant"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>كلمة المرور *</Text>
            <View style={[styles.iconInput, { backgroundColor: '#F8FAFC' }]}>
              <Lock size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.innerInput, { color: theme.text }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isOutOfZone ? '#D1D5DB' : theme.primary,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={submitting || isOutOfZone}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isOutOfZone ? 'غير متاح في هذه المنطقة في الوقت الحالي' : 'إرسال طلب الانضمام للمراجعة'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 20,
  },
  introBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
  },
  introSub: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
    textAlign: 'right',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  section: {
    gap: 10,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  gpsBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  mapFrame: {
    height: 230,
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  centerPinOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44,
    zIndex: 400,
  },
  mobileCoordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  mobileCoordsText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  detectedZoneBox: {
    borderRadius: 14,
    padding: 12,
  },
  detectedZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectedZoneText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  pillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillChipText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
    marginTop: 2,
  },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  iconInput: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  innerInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  modeText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  successIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 19,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  zoneSuccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 14,
  },
  zoneSuccessText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  successNote: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
});
