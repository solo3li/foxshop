import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import {
  PhoneCallSvg,
  WhatsAppSvg,
  ShieldOtpSvg,
  StepOrderPlacedSvg,
  StepCookingSvg,
  StepOnTheWaySvg,
  StepDeliveredSvg,
  BackArrowSvg,
  MapRadarSvg,
} from '../../components/TrackingIcons';
import { HelpCircle, RefreshCw, XCircle } from 'lucide-react-native';

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // 1. Fetch Order Details
  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await orderService.getOrderDetails(id);
      if (res.data) {
        setOrder(res.data);
      } else {
        setError(res.error || 'تعذر جلب تفاصيل الطلب');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل الطلب');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // 2. Real-time Subscription via Centrifugo for order status changes
  useEffect(() => {
    if (!id) return;

    const channel = `tracking:order_${id}`;
    const unsubscribe = centrifugo.subscribe(channel, (data) => {
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

  // Handle Cancel Order
  const handleCancelOrder = async () => {
    if (!id) return;
    const confirmMsg = 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟';
    const doCancel = async () => {
      setIsCancelling(true);
      try {
        const res = await orderService.cancelOrder(id);
        if (res.data) {
          fetchOrder();
          if (Platform.OS === 'web') window.alert('تم إلغاء الطلب بنجاح');
          else Alert.alert('نجاح', 'تم إلغاء الطلب بنجاح');
        } else {
          throw new Error(res.error || 'تعذر إلغاء الطلب');
        }
      } catch (err: any) {
        if (Platform.OS === 'web') window.alert(err?.message || 'تعذر إلغاء الطلب');
        else Alert.alert('خطأ', err?.message || 'تعذر إلغاء الطلب');
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        await doCancel();
      }
    } else {
      Alert.alert('تأكيد الإلغاء', confirmMsg, [
        { text: 'تراجع', style: 'cancel' },
        { text: 'نعم، إلغاء', style: 'destructive', onPress: doCancel },
      ]);
    }
  };

  // Stepper Phase Status Index
  const currentStepIndex = useMemo(() => {
    if (!order) return 0;
    const s = order.status;
    if (s === 'PENDING' || s === 'CONFIRMED') return 0;
    if (s === 'PREPARING' || s === 'READY_FOR_PICKUP') return 1;
    if (s === 'ON_THE_WAY') return 2;
    if (s === 'DELIVERED') return 3;
    return 0;
  }, [order?.status]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#FF2E7E" />
        <Text style={styles.loadingText}>جارٍ تحميل تفاصيل وتتبع الطلب...</Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>تعذر فتح الطلب</Text>
        <Text style={styles.errorSub}>{error || 'الطلب غير موجود'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrder}>
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="رجوع"
        >
          <BackArrowSvg size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>طلب #{order.order_number}</Text>
          <Text style={styles.headerSub}>{order.restaurant_name}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDelivered
                ? '#DCFCE7'
                : isCancelled
                ? '#FEE2E2'
                : '#FFE4E6',
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isDelivered
                  ? '#16A34A'
                  : isCancelled
                  ? '#DC2626'
                  : '#FF2E7E',
              },
            ]}
          >
            {order.status_display || order.status}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. Progress Stepper ── */}
        {!isCancelled && (
          <View style={styles.stepperCard}>
            <Text style={styles.cardSectionTitle}>حالة مسار الطلب</Text>
            <View style={styles.stepperRow}>
              {/* Step 1: Placed */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    currentStepIndex >= 0 && styles.stepActiveCircle,
                  ]}
                >
                  <StepOrderPlacedSvg
                    size={22}
                    color={currentStepIndex >= 0 ? '#FF2E7E' : '#9CA3AF'}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStepIndex >= 0 && styles.stepActiveLabel,
                  ]}
                >
                  تم الطلب
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  currentStepIndex >= 1 && styles.stepActiveLine,
                ]}
              />

              {/* Step 2: Cooking */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    currentStepIndex >= 1 && styles.stepActiveCircle,
                  ]}
                >
                  <StepCookingSvg
                    size={22}
                    color={currentStepIndex >= 1 ? '#F59E0B' : '#9CA3AF'}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStepIndex >= 1 && styles.stepActiveLabel,
                  ]}
                >
                  بالتجهيز
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  currentStepIndex >= 2 && styles.stepActiveLine,
                ]}
              />

              {/* Step 3: On The Way */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    currentStepIndex >= 2 && styles.stepActiveCircle,
                  ]}
                >
                  <StepOnTheWaySvg
                    size={22}
                    color={currentStepIndex >= 2 ? '#0284C7' : '#9CA3AF'}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStepIndex >= 2 && styles.stepActiveLabel,
                  ]}
                >
                  في الطريق
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  currentStepIndex >= 3 && styles.stepActiveLine,
                ]}
              />

              {/* Step 4: Delivered */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    currentStepIndex >= 3 && styles.stepActiveCircle,
                  ]}
                >
                  <StepDeliveredSvg
                    size={22}
                    color={currentStepIndex >= 3 ? '#10B981' : '#9CA3AF'}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    currentStepIndex >= 3 && styles.stepActiveLabel,
                  ]}
                >
                  تم التوصيل
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 3. OTP Code Security Banner (When Trip is Active) ── */}
        {order.delivery_info?.delivery_otp && !isDelivered && !isCancelled && (
          <View style={styles.otpCard}>
            <View style={styles.otpIconBox}>
              <ShieldOtpSvg size={26} color="#FF2E7E" />
            </View>
            <View style={styles.otpContent}>
              <Text style={styles.otpTitle}>رمز تسليم الطلب (OTP)</Text>
              <Text style={styles.otpDesc}>
                أعطِ هذا الرمز للكابتن فقط عند استلام الوجبة
              </Text>
            </View>
            <View style={styles.otpBadge}>
              <Text style={styles.otpBadgeText}>
                {order.delivery_info.delivery_otp}
              </Text>
            </View>
          </View>
        )}

        {/* ── 4. Direct Communication Cards (Driver & Restaurant) ── */}
        <View style={styles.contactsGrid}>
          {/* Driver Contact Card (Available once driver assigned) */}
          {order.delivery_info?.driver_name ? (
            <View style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <View style={styles.contactAvatarCircle}>
                  <Text style={styles.avatarEmoji}>🛵</Text>
                </View>
                <View style={styles.contactInfoCol}>
                  <Text style={styles.contactRole}>كابتن التوصيل</Text>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {order.delivery_info.driver_name}
                  </Text>
                </View>
              </View>

              <View style={styles.contactActionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.callBtn]}
                  onPress={() => handleCall(order.delivery_info?.driver_phone)}
                  activeOpacity={0.8}
                >
                  <PhoneCallSvg size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>اتصال</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.whatsappBtn]}
                  onPress={() => handleWhatsApp(order.delivery_info?.driver_phone)}
                  activeOpacity={0.8}
                >
                  <WhatsAppSvg size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>واتساب</Text>
                </TouchableOpacity>
              </View>

              {/* Track Driver Button inside Driver Card (Hidden if Delivered or Cancelled) */}
              {!isDelivered && !isCancelled && (
                <TouchableOpacity
                  style={styles.trackDriverBtn}
                  onPress={() => router.push(`/tracking/${order.id}` as any)}
                  activeOpacity={0.85}
                >
                  <MapRadarSvg size={20} color="#FFFFFF" />
                  <Text style={styles.trackDriverBtnText}>تتبع حركة الكابتن على الخريطة 🗺️</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.contactCard, styles.contactCardPending]}>
              <View style={styles.contactHeader}>
                <View style={styles.contactAvatarCircle}>
                  <Text style={styles.avatarEmoji}>⏳</Text>
                </View>
                <View style={styles.contactInfoCol}>
                  <Text style={styles.contactRole}>كابتن التوصيل</Text>
                  <Text style={styles.contactPendingText}>
                    جارٍ إسناد الطلب لأقرب كابتن متاح...
                  </Text>
                </View>
              </View>

              {/* View Route on Map even before driver assignment (Hidden if Delivered or Cancelled) */}
              {!isDelivered && !isCancelled && (
                <TouchableOpacity
                  style={[styles.trackDriverBtn, { backgroundColor: '#0284C7', marginTop: 10 }]}
                  onPress={() => router.push(`/tracking/${order.id}` as any)}
                  activeOpacity={0.85}
                >
                  <MapRadarSvg size={18} color="#FFFFFF" />
                  <Text style={styles.trackDriverBtnText}>عرض مسار الطلب على الخريطة 🗺️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Restaurant Contact Card */}
          <View style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View style={[styles.contactAvatarCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.avatarEmoji}>🏬</Text>
              </View>
              <View style={styles.contactInfoCol}>
                <Text style={styles.contactRole}>المطعم المُعد للطلب</Text>
                <Text style={styles.contactName} numberOfLines={1}>
                  {order.restaurant_name}
                </Text>
              </View>
            </View>

            <View style={styles.contactActionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                onPress={() => handleCall(order.restaurant_phone)}
                activeOpacity={0.8}
              >
                <PhoneCallSvg size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>اتصال</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.whatsappBtn]}
                onPress={() => handleWhatsApp(order.restaurant_phone)}
                activeOpacity={0.8}
              >
                <WhatsAppSvg size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>واتساب</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 5. Delivery Address Details ── */}
        {order.delivery_address_snapshot && (
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>عنوان التوصيل 📍</Text>
            <Text style={styles.addressStreet}>
              {order.delivery_address_snapshot.street || 'العنوان محدد في الخريطة'}
            </Text>
            {order.delivery_address_snapshot.building_number ? (
              <Text style={styles.addressDetails}>
                عمارة: {order.delivery_address_snapshot.building_number} • طابق:{' '}
                {order.delivery_address_snapshot.floor || '1'}
              </Text>
            ) : null}
            {order.delivery_address_snapshot.delivery_instructions ? (
              <Text style={styles.addressNotes}>
                ملاحظات: {order.delivery_address_snapshot.delivery_instructions}
              </Text>
            ) : null}
          </View>
        )}

        {/* ── 6. Order Items & Invoice Breakdown ── */}
        <View style={styles.infoCard}>
          <Text style={styles.cardSectionTitle}>تفاصيل الوجبات والفاتورة 🧾</Text>

          {order.items && order.items.length > 0 ? (
            <View style={styles.itemsList}>
              {order.items.map((item, idx) => (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={styles.itemQuantityBadge}>
                    <Text style={styles.itemQuantityText}>{item.quantity}x</Text>
                  </View>
                  <View style={styles.itemNameCol}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <Text style={styles.itemModifiers}>
                        {item.modifiers.map((m) => m.modifier_name).join(' • ')}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>{item.total_price} ر.س</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المجموع الفرعي</Text>
            <Text style={styles.totalVal}>{order.subtotal} ر.س</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>رسوم التوصيل</Text>
            <Text style={styles.totalVal}>{order.delivery_fee} ر.س</Text>
          </View>
          {Number(order.discount_amount || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: '#16A34A' }]}>الخصم</Text>
              <Text style={[styles.totalVal, { color: '#16A34A' }]}>
                -{order.discount_amount} ر.س
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>الإجمالي النهائي</Text>
            <Text style={styles.grandTotalVal}>{order.total_amount} ر.س</Text>
          </View>

          <View style={styles.paymentMethodPill}>
            <Text style={styles.paymentMethodText}>
              طريقة الدفع: {order.payment_method === 'COD' ? 'الدفع نقداً عند الاستلام (COD)' : 'مدفوع إلكترونياً ✅'}
            </Text>
          </View>
        </View>

        {/* ── 7. Cancel Order Action (Only if PENDING) ── */}
        {order.status === 'PENDING' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancelOrder}
            disabled={isCancelling}
            activeOpacity={0.8}
          >
            {isCancelling ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <>
                <XCircle size={18} color="#DC2626" />
                <Text style={styles.cancelBtnText}>إلغاء هذا الطلب</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── 8. Support & Refresh Actions ── */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => router.push('/help' as any)}
            activeOpacity={0.8}
          >
            <HelpCircle size={18} color="#6B7280" />
            <Text style={styles.helpBtnText}>مساعدة أو إبلاغ عن مشكلة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={fetchOrder}
            activeOpacity={0.8}
          >
            <RefreshCw size={18} color="#FF2E7E" />
            <Text style={styles.refreshBtnText}>تحديث الحالة</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Tajawal_500Medium',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  errorSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Tajawal_400Regular',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF2E7E',
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Map
  mapContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  liveChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveChipText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },

  // Stepper
  stepperCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 14,
  },
  stepperRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 6,
  },
  stepIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActiveCircle: {
    backgroundColor: '#FFF1F5',
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#9CA3AF',
  },
  stepActiveLabel: {
    color: '#111827',
    fontFamily: 'Tajawal_700Bold',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 20,
  },
  stepActiveLine: {
    backgroundColor: '#FF2E7E',
  },

  // OTP Card
  otpCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  otpIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  otpTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#9F0744',
  },
  otpDesc: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  otpBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FF2E7E',
  },
  otpBadgeText: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Contacts Grid
  contactsGrid: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  contactCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  contactCardPending: {
    backgroundColor: '#FAFAFA',
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  contactHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  contactAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  contactInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  contactRole: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Tajawal_400Regular',
  },
  contactName: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'Tajawal_700Bold',
    marginTop: 2,
  },
  contactPendingText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Tajawal_500Medium',
    marginTop: 2,
  },
  contactActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  callBtn: {
    backgroundColor: '#0284C7',
  },
  whatsappBtn: {
    backgroundColor: '#16A34A',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  trackDriverBtn: {
    backgroundColor: '#FF2E7E',
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF2E7E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  trackDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },

  // Info Cards
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  addressStreet: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'right',
  },
  addressDetails: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  addressNotes: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#D97706',
    textAlign: 'right',
    marginTop: 4,
  },

  // Items
  itemsList: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemQuantityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  itemQuantityText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
  },
  itemNameCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  itemModifiers: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Tajawal_400Regular',
  },
  totalVal: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'Tajawal_500Medium',
  },
  grandTotalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  grandTotalVal: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#FF2E7E',
  },
  paymentMethodPill: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: 'Tajawal_500Medium',
  },

  // Actions
  cancelBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#DC2626',
  },
  footerActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    gap: 12,
  },
  helpBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  refreshBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#FF2E7E',
  },
});
