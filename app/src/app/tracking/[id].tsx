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
import { orderService, OrderResponse } from '../../services/orderService';
import { centrifugo } from '../../services/centrifugo';
import { OrderTrackingMap } from '../../components/OrderTrackingMap';
import {
  PhoneCallSvg,
  WhatsAppSvg,
  ShieldOtpSvg,
  BackArrowSvg,
  MapRadarSvg,
} from '../../components/TrackingIcons';

export default function OrderLiveTrackingScreen() {
  const router = useRouter();
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

    const channel = `tracking:order_${id}`;
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
    if (isDelivered) return 'تم تسليم الطلب بنجاح 🎉';
    if (isCancelled) return 'تم إلغاء هذا الطلب';
    if (order.status === 'ON_THE_WAY') return 'الكابتن في الطريق لتسليم طلبك 🛵';
    if (order.status === 'READY_FOR_PICKUP') return 'الكابتن في طريقه للمطعم لاستلام الطلب 🏬';
    if (order.status === 'PREPARING') return 'المطعم يقوم بتجهيز وجبتك اللذيذة 🍳';
    return order.status_display || 'جارٍ متابعة مسار الطلب';
  }, [order?.status, isDelivered, isCancelled, order?.status_display]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#FF2E7E" />
        <Text style={styles.loadingText}>جارٍ فتح الخريطة والاتصال بنظام التتبع المباشر...</Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر فتح التتبع</Text>
        <Text style={styles.errorSub}>{error || 'الطلب غير موجود'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrder}>
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
          <Text style={styles.backHomeBtnText}>العودة للطلب</Text>
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

  return (
    <View style={styles.container}>
      {/* ── 1. Full-Screen Interactive Live Map ── */}
      <View style={styles.mapLayer}>
        <OrderTrackingMap
          restaurantLocation={restLoc}
          customerLocation={custLoc}
          driverLocation={liveDriverLoc}
          orderStatus={order.status}
        />
      </View>

      {/* ── 2. Floating Top Header ── */}
      <SafeAreaView edges={['top']} style={styles.topHeaderWrapper}>
        <View style={styles.topHeader}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="رجوع لتفاصيل الطلب"
          >
            <BackArrowSvg size={22} color="#111827" />
          </TouchableOpacity>

          {/* Title & Order info */}
          <View style={styles.headerInfoCol}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerOrderNum}>طلب #{order.order_number}</Text>
            </View>
            <Text style={styles.headerRestaurantName} numberOfLines={1}>
              {order.restaurant_name}
            </Text>
          </View>

          {/* Live indicator chip */}
          <View style={styles.liveChip}>
            <View style={[styles.livePulseDot, isDelivered && { backgroundColor: '#10B981' }]} />
            <Text style={styles.liveChipText}>
              {isDelivered ? 'مكتمل' : liveDriverLoc ? 'مباشر 📡' : 'متصل'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── 3. Floating Bottom Driver HUD ── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomHudWrapper}>
        <View style={styles.hudCard}>
          {/* Delivery OTP code banner if available & active */}
          {order.delivery_info?.delivery_otp && !isDelivered && !isCancelled && (
            <View style={styles.otpBanner}>
              <View style={styles.otpIconCircle}>
                <ShieldOtpSvg size={20} color="#FF2E7E" />
              </View>
              <View style={styles.otpTextCol}>
                <Text style={styles.otpTitle}>رمز تأكيد الاستلام (OTP)</Text>
                <Text style={styles.otpSubtitle}>أعطه للكابتن فقط عند وصول الوجبة إليك</Text>
              </View>
              <View style={styles.otpCodeBadge}>
                <Text style={styles.otpCodeText}>{order.delivery_info.delivery_otp}</Text>
              </View>
            </View>
          )}

          {/* Driver & Trip status bar */}
          <View style={styles.statusBannerRow}>
            <MapRadarSvg size={18} color="#FF2E7E" />
            <Text style={styles.statusBannerText}>{statusLabel}</Text>
          </View>

          {/* Driver Information & Action Buttons */}
          {order.delivery_info?.driver_name ? (
            <View style={styles.driverSection}>
              <View style={styles.driverInfoRow}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>🛵</Text>
                </View>
                <View style={styles.driverDetailsCol}>
                  <Text style={styles.driverRole}>كابتن التوصيل</Text>
                  <Text style={styles.driverName}>{order.delivery_info.driver_name}</Text>
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
              <Text style={styles.pendingDriverEmoji}>⏳</Text>
              <View style={styles.pendingDriverTextCol}>
                <Text style={styles.pendingDriverTitle}>جارٍ تخصيص كابتن التوصيل</Text>
                <Text style={styles.pendingDriverSub}>
                  سيظهر موقع الكابتن وبياناته هنا فور قبول المهمة
                </Text>
              </View>
            </View>
          )}

          {/* Footer details link */}
          <TouchableOpacity
            style={styles.orderDetailsLink}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.orderDetailsLinkText}>عرض الفاتورة وتفاصيل الطلب الكاملة ←</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
    textAlign: 'center',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  errorSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#FF2E7E',
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
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },

  // ── Top Floating Header ──
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#111827',
  },
  headerRestaurantName: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
    marginTop: 2,
  },
  liveChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveChipText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#065F46',
  },

  // ── Bottom Floating HUD ──
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
    marginBottom: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.9)',
  },

  // OTP Banner
  otpBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    marginBottom: 12,
    gap: 10,
  },
  otpIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
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
    color: '#9F0744',
  },
  otpSubtitle: {
    fontSize: 10,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 1,
  },
  otpCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FF2E7E',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },

  // Driver Section
  driverSection: {
    marginBottom: 10,
  },
  driverInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 22,
  },
  driverDetailsCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  driverRole: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
  },
  driverName: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
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
    borderRadius: 10,
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
    gap: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pendingDriverEmoji: {
    fontSize: 26,
  },
  pendingDriverTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pendingDriverTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
  },
  pendingDriverSub: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Order details link
  orderDetailsLink: {
    alignItems: 'center',
    paddingTop: 8,
  },
  orderDetailsLinkText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#FF2E7E',
  },
});
