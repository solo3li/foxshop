import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, Clock, AlertCircle, ChevronLeft, Navigation, ShieldCheck } from 'lucide-react-native';
import { orderService, OrderResponse } from '../../services/orderService';
import { centrifugo } from '../../services/centrifugo';
import { OrderTrackingMap } from '../../components/OrderTrackingMap';
import { useTheme } from '../../hooks/use-theme';
import {
  PhoneCallSvg,
  WhatsAppSvg,
  BackArrowSvg,
  MapRadarSvg,
} from '../../components/TrackingIcons';

export default function OrderLiveTrackingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time live driver coordinates
  const [liveDriverLoc, setLiveDriverLoc] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
    speed?: number;
  } | null>(null);

  // 1. Fetch Order Details
  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await orderService.getOrderDetails(id);
      if (res.data) {
        setOrder(res.data);
        const dInfo = res.data.delivery_info;
        if (
          dInfo?.driver_latitude !== undefined &&
          dInfo?.driver_latitude !== null &&
          dInfo?.driver_longitude !== undefined &&
          dInfo?.driver_longitude !== null
        ) {
          setLiveDriverLoc({
            latitude: Number(dInfo.driver_latitude),
            longitude: Number(dInfo.driver_longitude),
            heading: Number(dInfo.driver_heading || 0),
            speed: Number(dInfo.driver_speed || 0),
          });
        }
      } else {
        setError(res.error || 'تعذر جلب تفاصيل التتبع');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل بيانات التتبع');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // 2. Real-time Subscription via Centrifugo for live driver location
  useEffect(() => {
    if (!id) return;

    const channel = `orders:order_${id}`;
    const unsubscribe = centrifugo.subscribe(channel, (data) => {
      // Driver GPS move event
      if (data?.latitude && data?.longitude) {
        setLiveDriverLoc({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          heading: Number(data.heading || 0),
          speed: Number(data.speed || 0),
        });
      }

      // Order or trip status change event
      if (data?.status || data?.trip_status) {
        fetchOrder();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [id, fetchOrder]);

  // Handle Phone Call
  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      if (Platform.OS === 'web') window.alert('رقم الهاتف غير متاح حالياً');
      else Alert.alert('تنبيه', 'رقم الهاتف غير متاح حالياً');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // Handle WhatsApp
  const handleWhatsApp = (phoneNumber?: string) => {
    if (!phoneNumber) {
      if (Platform.OS === 'web') window.alert('رقم الواتساب غير متاح حالياً');
      else Alert.alert('تنبيه', 'رقم الواتساب غير متاح حالياً');
      return;
    }
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${clean}?text=مرحباً، بخصوص الطلب رقم #${order?.order_number}`);
  };

  const isDelivered = order?.status === 'DELIVERED';
  const isCancelled = order?.status === 'CANCELLED';

  const statusLabel = useMemo(() => {
    if (!order) return '';
    if (isDelivered) return 'تم تسليم الطلب بنجاح';
    if (isCancelled) return 'تم إلغاء هذا الطلب';
    if (order.status === 'ON_THE_WAY') return 'الكابتن في الطريق لتسليم طلبك';
    if (order.status === 'READY_FOR_PICKUP') return 'الكابتن في طريقه للمطعم لاستلام الطلب';
    if (order.status === 'PREPARING') return 'المطعم يقوم بتجهيز وجبتك';
    return order.status_display || 'جارٍ متابعة مسار الطلب';
  }, [order?.status, isDelivered, isCancelled, order?.status_display]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.centeredScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          جارٍ فتح الخريطة والاتصال بنظام التتبع المباشر...
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.centeredScreen, { backgroundColor: theme.background }]}>
        <View style={[styles.errorIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
          <AlertCircle size={40} color={theme.error} strokeWidth={1.8} />
        </View>
        <Text style={[styles.errorTitle, { color: theme.text }]}>تعذر فتح التتبع</Text>
        <Text style={[styles.errorSub, { color: theme.textSecondary }]}>{error || 'الطلب غير موجود'}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={fetchOrder}>
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Text style={[styles.backHomeBtnText, { color: theme.textSecondary }]}>العودة للطلب</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Map markers locations
  const restLoc =
    order.restaurant_latitude && order.restaurant_longitude
      ? {
          latitude: Number(order.restaurant_latitude),
          longitude: Number(order.restaurant_longitude),
          name: order.restaurant_name,
        }
      : null;

  const custLoc =
    order.delivery_address_snapshot?.latitude && order.delivery_address_snapshot?.longitude
      ? {
          latitude: Number(order.delivery_address_snapshot.latitude),
          longitude: Number(order.delivery_address_snapshot.longitude),
          address: order.delivery_address_snapshot.street,
        }
      : null;

  const glassBg = theme.isDark ? 'rgba(21, 29, 47, 0.92)' : 'rgba(255, 255, 255, 0.94)';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── 1. Full-Bleed Interactive Live Map ── */}
      <View style={styles.mapLayer}>
        <OrderTrackingMap
          restaurantLocation={restLoc}
          customerLocation={custLoc}
          driverLocation={liveDriverLoc}
          orderStatus={order.status}
          isDark={theme.isDark}
        />
      </View>

      {/* ── 2. Floating Top Glass Header ── */}
      <SafeAreaView edges={['top']} style={styles.topHeaderWrapper}>
        <View style={[styles.topHeader, { backgroundColor: glassBg }]}>
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            activeOpacity={0.8}
            accessibilityLabel="رجوع لتفاصيل الطلب"
          >
            <BackArrowSvg size={20} color={theme.text} />
          </TouchableOpacity>

          {/* Title & Order info */}
          <View style={styles.headerInfoCol}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerOrderNum, { color: theme.text }]}>طلب #{order.order_number}</Text>
            </View>
            <Text style={[styles.headerRestaurantName, { color: theme.textSecondary }]} numberOfLines={1}>
              {order.restaurant_name}
            </Text>
          </View>

          {/* Live indicator chip */}
          <View style={[styles.liveChip, { backgroundColor: isDelivered ? (theme.isDark ? '#064E3B' : '#ECFDF5') : (theme.isDark ? '#831843' : theme.primaryLight) }]}>
            <View style={[styles.livePulseDot, { backgroundColor: isDelivered ? '#10B981' : theme.primary }]} />
            <Text style={[styles.liveChipText, { color: isDelivered ? '#10B981' : theme.primary }]}>
              {isDelivered ? 'مكتمل' : liveDriverLoc ? 'مباشر' : 'متصل'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── 3. Floating Bottom Glass HUD Panel ── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomHudWrapper}>
        <View style={[styles.hudCard, { backgroundColor: glassBg }]}>
          {/* Delivery OTP code banner if available & active */}
          {order.delivery_info?.delivery_otp && !isDelivered && !isCancelled && (
            <View style={[styles.otpBanner, { backgroundColor: theme.primaryLight }]}>
              <View style={[styles.otpIconCircle, { backgroundColor: theme.card }]}>
                <ShieldCheck size={20} color={theme.primary} />
              </View>
              <View style={styles.otpTextCol}>
                <Text style={[styles.otpTitle, { color: theme.primary }]}>رمز تأكيد الاستلام (OTP)</Text>
                <Text style={[styles.otpSubtitle, { color: theme.textSecondary }]}>أعطه للكابتن فقط عند وصول الوجبة إليك</Text>
              </View>
              <View style={[styles.otpCodeBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.otpCodeText}>{order.delivery_info.delivery_otp}</Text>
              </View>
            </View>
          )}

          {/* Driver & Trip status bar */}
          <View style={styles.statusBannerRow}>
            <MapRadarSvg size={18} color={theme.primary} />
            <Text style={[styles.statusBannerText, { color: theme.text }]}>{statusLabel}</Text>
          </View>

          {/* Driver Information & Action Buttons */}
          {order.delivery_info?.driver_name ? (
            <View style={styles.driverSection}>
              <View style={styles.driverInfoRow}>
                <View style={[styles.driverAvatar, { backgroundColor: theme.surfaceSecondary }]}>
                  <Bike size={22} color={theme.primary} />
                </View>
                <View style={styles.driverDetailsCol}>
                  <Text style={[styles.driverRole, { color: theme.textSecondary }]}>كابتن التوصيل</Text>
                  <Text style={[styles.driverName, { color: theme.text }]}>{order.delivery_info.driver_name}</Text>
                  {liveDriverLoc?.speed ? (
                    <Text style={styles.driverSpeedText}>
                      السرعة الحالية: {Math.round(liveDriverLoc.speed * 3.6)} كم/ساعة
                    </Text>
                  ) : null}
                </View>

                {/* Call & WhatsApp actions */}
                <View style={styles.driverActionsGroup}>
                  <TouchableOpacity
                    style={[styles.hudActionBtn, styles.callActionBtn]}
                    onPress={() => handleCall(order.delivery_info?.driver_phone)}
                    activeOpacity={0.8}
                    accessibilityLabel="اتصال بالكابتن"
                  >
                    <PhoneCallSvg size={18} color="#FFFFFF" />
                    <Text style={styles.hudActionBtnText}>اتصال</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.hudActionBtn, styles.whatsappActionBtn]}
                    onPress={() => handleWhatsApp(order.delivery_info?.driver_phone)}
                    activeOpacity={0.8}
                    accessibilityLabel="محادثة واتساب"
                  >
                    <WhatsAppSvg size={18} color="#FFFFFF" />
                    <Text style={styles.hudActionBtnText}>واتساب</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.pendingDriverBox}>
              <View style={[styles.pendingDriverIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
                <Clock size={20} color={theme.primary} />
              </View>
              <View style={styles.pendingDriverTextCol}>
                <Text style={[styles.pendingDriverTitle, { color: theme.text }]}>جارٍ تخصيص كابتن التوصيل</Text>
                <Text style={[styles.pendingDriverSub, { color: theme.textSecondary }]}>
                  سيظهر موقع الكابتن وبياناته هنا فور قبول المهمة
                </Text>
              </View>
            </View>
          )}

          {/* Footer details link */}
          <TouchableOpacity
            style={styles.orderDetailsLink}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            activeOpacity={0.8}
          >
            <View style={styles.orderDetailsLinkContent}>
              <Text style={[styles.orderDetailsLinkText, { color: theme.primary }]}>عرض الفاتورة وتفاصيل الطلب الكاملة</Text>
              <ChevronLeft size={16} color={theme.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'center',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
  },
  errorSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  backHomeBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  backHomeBtnText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },

  // ── Top Floating Glass Header ──
  topHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  topHeader: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  headerInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 12,
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerOrderNum: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  headerRestaurantName: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    marginTop: 2,
  },
  liveChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveChipText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Bottom Floating Glass HUD ──
  bottomHudWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  hudCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    borderWidth: 0,
  },

  // OTP Banner
  otpBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    marginBottom: 14,
    gap: 10,
    borderWidth: 0,
  },
  otpIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  otpTitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  otpSubtitle: {
    fontSize: 10,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 1,
  },
  otpCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  otpCodeText: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Status Banner
  statusBannerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 0,
  },
  statusBannerText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },

  // Driver Section
  driverSection: {
    marginBottom: 12,
  },
  driverInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetailsCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  driverRole: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
  },
  driverName: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    marginTop: 2,
  },
  driverSpeedText: {
    fontSize: 10,
    fontFamily: 'Tajawal_500Medium',
    color: '#0284C7',
    marginTop: 2,
  },
  driverActionsGroup: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  hudActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0,
  },
  callActionBtn: {
    backgroundColor: '#0284C7',
  },
  whatsappActionBtn: {
    backgroundColor: '#16A34A',
  },
  hudActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },

  // Pending Driver
  pendingDriverBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  pendingDriverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDriverTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pendingDriverTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  pendingDriverSub: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
  },

  // Order details link
  orderDetailsLink: {
    alignItems: 'center',
    paddingTop: 8,
  },
  orderDetailsLinkContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  orderDetailsLinkText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
