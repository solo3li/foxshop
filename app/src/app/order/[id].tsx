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
import { useTheme } from '../../hooks/use-theme';
import { formatCurrency, CURRENCY } from '../../constants/config';
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
import { HelpCircle, RefreshCw, XCircle, AlertCircle, Bike, Store, Clock, MapPin, Receipt, CheckCircle2 } from 'lucide-react-native';

export default function OrderTrackingScreen() {
  const router = useRouter();
  const theme = useTheme();
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

    const channel = `orders:order_${id}`;
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
      <SafeAreaView style={[styles.centeredScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>جارٍ تحميل تفاصيل وتتبع الطلب...</Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.centeredScreen, { backgroundColor: theme.background }]}>
        <View style={[styles.errorIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
          <AlertCircle size={40} color={theme.error} strokeWidth={1.8} />
        </View>
        <Text style={[styles.errorTitle, { color: theme.text }]}>تعذر فتح الطلب</Text>
        <Text style={[styles.errorSub, { color: theme.textSecondary }]}>{error || 'الطلب غير موجود'}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={fetchOrder}>
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Top Header ── */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          accessibilityLabel="رجوع"
        >
          <BackArrowSvg size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>طلب #{order.order_number}</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>{order.restaurant_name}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDelivered
                ? (theme.isDark ? '#064E3B' : '#DCFCE7')
                : isCancelled
                ? (theme.isDark ? '#7F1D1D' : '#FEE2E2')
                : (theme.isDark ? '#831843' : theme.primaryLight),
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isDelivered
                  ? '#10B981'
                  : isCancelled
                  ? '#EF4444'
                  : theme.primary,
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
          <View style={[styles.stepperCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardSectionTitle, { color: theme.text }]}>حالة مسار الطلب</Text>
            <View style={styles.stepperRow}>
              {/* Step 1: Placed */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    { backgroundColor: currentStepIndex >= 0 ? theme.primaryLight : theme.surfaceSecondary },
                  ]}
                >
                  <StepOrderPlacedSvg
                    size={22}
                    color={currentStepIndex >= 0 ? theme.primary : theme.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: currentStepIndex >= 0 ? theme.text : theme.textMuted },
                  ]}
                >
                  تم الطلب
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: currentStepIndex >= 1 ? theme.primary : theme.surfaceSecondary },
                ]}
              />

              {/* Step 2: Cooking */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    { backgroundColor: currentStepIndex >= 1 ? (theme.isDark ? '#78350F' : '#FEF3C7') : theme.surfaceSecondary },
                  ]}
                >
                  <StepCookingSvg
                    size={22}
                    color={currentStepIndex >= 1 ? '#F59E0B' : theme.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: currentStepIndex >= 1 ? theme.text : theme.textMuted },
                  ]}
                >
                  بالتجهيز
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: currentStepIndex >= 2 ? theme.primary : theme.surfaceSecondary },
                ]}
              />

              {/* Step 3: On The Way */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    { backgroundColor: currentStepIndex >= 2 ? (theme.isDark ? '#0C4A6E' : '#E0F2FE') : theme.surfaceSecondary },
                  ]}
                >
                  <StepOnTheWaySvg
                    size={22}
                    color={currentStepIndex >= 2 ? '#0284C7' : theme.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: currentStepIndex >= 2 ? theme.text : theme.textMuted },
                  ]}
                >
                  في الطريق
                </Text>
              </View>

              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: currentStepIndex >= 3 ? theme.primary : theme.surfaceSecondary },
                ]}
              />

              {/* Step 4: Delivered */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIconCircle,
                    { backgroundColor: currentStepIndex >= 3 ? (theme.isDark ? '#064E3B' : '#DCFCE7') : theme.surfaceSecondary },
                  ]}
                >
                  <StepDeliveredSvg
                    size={22}
                    color={currentStepIndex >= 3 ? '#10B981' : theme.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: currentStepIndex >= 3 ? theme.text : theme.textMuted },
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
          <View style={[styles.otpCard, { backgroundColor: theme.primaryLight }]}>
            <View style={[styles.otpIconBox, { backgroundColor: theme.card }]}>
              <ShieldOtpSvg size={24} color={theme.primary} />
            </View>
            <View style={styles.otpContent}>
              <Text style={[styles.otpTitle, { color: theme.primary }]}>رمز تسليم الطلب (OTP)</Text>
              <Text style={[styles.otpDesc, { color: theme.textSecondary }]}>
                أعطِ هذا الرمز للكابتن فقط عند استلام الوجبة
              </Text>
            </View>
            <View style={[styles.otpBadge, { backgroundColor: theme.primary }]}>
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
            <View style={[styles.contactCard, { backgroundColor: theme.card }]}>
              <View style={styles.contactHeader}>
                <View style={[styles.contactAvatarCircle, { backgroundColor: theme.surfaceSecondary }]}>
                  <Bike size={20} color={theme.primary} />
                </View>
                <View style={styles.contactInfoCol}>
                  <Text style={[styles.contactRole, { color: theme.textSecondary }]}>كابتن التوصيل</Text>
                  <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
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
                  style={[styles.trackDriverBtn, { backgroundColor: theme.primary }]}
                  onPress={() => router.push(`/tracking/${order.id}` as any)}
                  activeOpacity={0.85}
                >
                  <MapRadarSvg size={20} color="#FFFFFF" />
                  <Text style={styles.trackDriverBtnText}>تتبع حركة الكابتن على الخريطة</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.contactCard, styles.contactCardPending, { backgroundColor: theme.surface }]}>
              <View style={styles.contactHeader}>
                <View style={[styles.contactAvatarCircle, { backgroundColor: theme.surfaceSecondary }]}>
                  <Clock size={20} color={theme.primary} />
                </View>
                <View style={styles.contactInfoCol}>
                  <Text style={[styles.contactRole, { color: theme.textSecondary }]}>كابتن التوصيل</Text>
                  <Text style={[styles.contactPendingText, { color: theme.textMuted }]}>
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
                  <Text style={styles.trackDriverBtnText}>عرض مسار الطلب على الخريطة</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Restaurant Contact Card */}
          <View style={[styles.contactCard, { backgroundColor: theme.card }]}>
            <View style={styles.contactHeader}>
              <View style={[styles.contactAvatarCircle, { backgroundColor: theme.isDark ? '#78350F' : '#FEF3C7' }]}>
                <Store size={20} color="#D97706" />
              </View>
              <View style={styles.contactInfoCol}>
                <Text style={[styles.contactRole, { color: theme.textSecondary }]}>المطعم المُعد للطلب</Text>
                <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
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
          <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeaderTitleRow}>
              <MapPin size={18} color={theme.primary} />
              <Text style={[styles.cardSectionTitle, { color: theme.text, marginBottom: 0 }]}>عنوان التوصيل</Text>
            </View>
            <Text style={[styles.addressStreet, { color: theme.text }]}>
              {order.delivery_address_snapshot.street || 'العنوان محدد في الخريطة'}
            </Text>
            {order.delivery_address_snapshot.building_number ? (
              <Text style={[styles.addressDetails, { color: theme.textSecondary }]}>
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
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeaderTitleRow}>
            <Receipt size={18} color={theme.primary} />
            <Text style={[styles.cardSectionTitle, { color: theme.text, marginBottom: 0 }]}>تفاصيل الوجبات والفاتورة</Text>
          </View>

          {order.items && order.items.length > 0 ? (
            <View style={styles.itemsList}>
              {order.items.map((item, idx) => (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={[styles.itemQuantityBadge, { backgroundColor: theme.surfaceSecondary }]}>
                    <Text style={[styles.itemQuantityText, { color: theme.text }]}>{item.quantity}x</Text>
                  </View>
                  <View style={styles.itemNameCol}>
                    <Text style={[styles.itemName, { color: theme.text }]}>{item.item_name}</Text>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <Text style={[styles.itemModifiers, { color: theme.textSecondary }]}>
                        {item.modifiers.map((m) => m.modifier_name).join(' • ')}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.itemPrice, { color: theme.text }]}>{formatCurrency(item.total_price)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.surfaceSecondary }]} />

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>المجموع الفرعي</Text>
            <Text style={[styles.totalVal, { color: theme.text }]}>{formatCurrency(order.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>رسوم التوصيل</Text>
            <Text style={[styles.totalVal, { color: theme.text }]}>{formatCurrency(order.delivery_fee)}</Text>
          </View>
          {Number(order.discount_amount || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: '#16A34A' }]}>الخصم</Text>
              <Text style={[styles.totalVal, { color: '#16A34A' }]}>
                -{formatCurrency(order.discount_amount)}
              </Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.surfaceSecondary }]} />

          <View style={styles.grandTotalRow}>
            <Text style={[styles.grandTotalLabel, { color: theme.text }]}>الإجمالي النهائي</Text>
            <Text style={[styles.grandTotalVal, { color: theme.primary }]}>{formatCurrency(order.total_amount)}</Text>
          </View>

          <View style={[styles.paymentMethodPill, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={[styles.paymentMethodText, { color: theme.textSecondary }]}>
              طريقة الدفع: {order.payment_method === 'COD' ? 'الدفع نقداً عند الاستلام (COD)' : 'مدفوع إلكترونياً (بطاقة)'}
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
                <Text style={styles.cancelBtnText}>إلغاء الطلب</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── 8. Footer Links ── */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.helpBtn, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push('/help' as any)}
            activeOpacity={0.8}
          >
            <HelpCircle size={18} color={theme.textSecondary} />
            <Text style={[styles.helpBtnText, { color: theme.text }]}>تحتاج مساعدة بخصوص الطلب؟</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: theme.primaryLight }]}
            onPress={fetchOrder}
            activeOpacity={0.8}
          >
            <RefreshCw size={18} color={theme.primary} />
            <Text style={[styles.refreshBtnText, { color: theme.primary }]}>تحديث الحالة</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  errorIconWrap: {
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
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
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
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
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

  // Stepper
  stepperCard: {
    margin: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 20,
  },

  // OTP Card
  otpCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  otpIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  otpDesc: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
  },
  otpBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
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
    padding: 16,
    borderRadius: 18,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  contactCardPending: {
    borderWidth: 0,
  },
  contactHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  contactRole: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
  },
  contactName: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    marginTop: 2,
  },
  contactPendingText: {
    fontSize: 12,
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
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 0,
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
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0,
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
    borderRadius: 18,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  addressStreet: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
  },
  addressDetails: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
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
    borderRadius: 6,
  },
  itemQuantityText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  itemNameCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  itemModifiers: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
  },
  totalVal: {
    fontSize: 13,
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
  },
  grandTotalVal: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  paymentMethodPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  paymentMethodText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },

  // Actions
  cancelBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0,
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
    borderRadius: 14,
    borderWidth: 0,
  },
  helpBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0,
  },
  refreshBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
