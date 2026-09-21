import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { DeliveryTrip, useTripStore } from '../store/tripStore';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Phone, MessageCircle, Navigation, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, PackageCheck, Banknote, ShieldCheck, Headphones } from 'lucide-react-native';
import { openExternalNavigation } from '../utils/navigation';

interface ActiveTripCardProps {
  trip: DeliveryTrip;
}

export const ActiveTripCard: React.FC<ActiveTripCardProps> = ({ trip }) => {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { pickupTrip, verifyOtpAndComplete, isActionLoading } = useTripStore();
  
  // Local state for phase advancement when driver clicks arrived
  const [localPhase, setLocalPhase] = useState<'TO_STORE' | 'AT_STORE' | 'TO_CUST' | 'AT_CUST'>(() => {
    if (trip.status === 'ACCEPTED') return 'TO_STORE';
    if (trip.status === 'ARRIVED_AT_STORE') return 'AT_STORE';
    if (trip.status === 'PICKED_UP') return 'TO_CUST';
    if (trip.status === 'ARRIVED_AT_CUSTOMER') return 'AT_CUST';
    return 'TO_STORE';
  });

  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleItemCheck = (index: number) => {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleWhatsApp = (phone?: string) => {
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const handlePickup = async () => {
    const success = await pickupTrip(trip.id);
    if (success) {
      setLocalPhase('TO_CUST');
    }
  };

  const handleCompleteOtp = async () => {
    if (otpInput.length < 4) {
      setOtpError('الرجاء إدخال رمز التحقق المكون من 4 أرقام');
      return;
    }
    setOtpError(null);
    const result = await verifyOtpAndComplete(trip.id, otpInput);
    if (!result.success) {
      setOtpError(result.error || 'رمز التحقق غير صحيح، يرجى سؤال العميل مجدداً');
    }
  };

  // Determine current step badge
  const getPhaseBadge = () => {
    switch (localPhase) {
      case 'TO_STORE':
        return { label: 'في الطريق إلى المطعم 🛵', color: colors.primary };
      case 'AT_STORE':
        return { label: 'داخل المطعم - استلام الطلب 🛍️', color: colors.secondary };
      case 'TO_CUST':
        return { label: 'في الطريق إلى العميل 📦', color: colors.primary };
      case 'AT_CUST':
        return { label: 'عند العميل - تأكيد التسليم ✅', color: colors.success };
    }
  };

  const badge = getPhaseBadge();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        isCollapsed && styles.cardCollapsed,
      ]}
    >
      {/* Top Status Bar (tap to toggle collapse/expand) */}
      <TouchableOpacity
        style={styles.topBar}
        onPress={() => setIsCollapsed((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.topBarRight}>
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={[styles.badgeText, { fontFamily: Fonts.bold }]}>{badge.label}</Text>
          </View>
          <Text style={[styles.orderNum, { color: colors.text, fontFamily: Fonts.bold }]}>
            طلب #{trip.order_number}
          </Text>
        </View>

        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={() => router.push(`/support?order_id=${trip.id}` as any)}
            activeOpacity={0.7}
            style={[styles.emergencySupportBtn, { backgroundColor: colors.primaryLight }]}
          >
            <Headphones size={13} color={colors.primary} />
            <Text style={[styles.emergencySupportText, { color: colors.primary, fontFamily: Fonts.bold }]}>
              الدعم 🎧
            </Text>
          </TouchableOpacity>

          <View style={[styles.collapseIconBox, { backgroundColor: colors.surface }]}>
            {isCollapsed ? (
              <ChevronUp size={20} color={colors.text} />
            ) : (
              <ChevronDown size={20} color={colors.text} />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Body content (hidden when collapsed) */}
      {!isCollapsed && (
        <>

      {/* PHASE 1: TO RESTAURANT */}
      {localPhase === 'TO_STORE' && (
        <View style={styles.phaseContainer}>
          <View style={styles.infoRow}>
            <View style={styles.infoTextContainer}>
              <Text style={[styles.targetLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                مطعم الاستلام
              </Text>
              <Text style={[styles.targetName, { color: colors.text, fontFamily: Fonts.bold }]}>
                {trip.restaurant?.name || (trip as any).restaurant_name || 'المطعم'}
              </Text>
              <Text style={[styles.targetAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                {trip.restaurant?.address_text || (trip as any).restaurant_address || 'العنوان محدد في الخريطة'}
              </Text>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                onPress={() => handleCall(trip.restaurant?.phone_number || (trip as any).restaurant_phone)}
                style={[styles.circleButton, { backgroundColor: colors.surface }]}
              >
                <Phone size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const lat = trip.restaurant?.latitude ?? Number((trip as any).restaurant_latitude);
                  const lon = trip.restaurant?.longitude ?? Number((trip as any).restaurant_longitude);
                  if (lat && lon) {
                    openExternalNavigation(
                      lat,
                      lon,
                      trip.restaurant?.name || (trip as any).restaurant_name || 'المطعم'
                    );
                  }
                }}
                style={[styles.circleButton, { backgroundColor: colors.primaryLight }]}
              >
                <Navigation size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setLocalPhase('AT_STORE')}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryActionBtnText, { fontFamily: Fonts.bold }]}>
              وصلت إلى المطعم
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PHASE 2: AT RESTAURANT (Check items & Pickup) */}
      {localPhase === 'AT_STORE' && (
        <View style={styles.phaseContainer}>
          <View style={[styles.instructionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PackageCheck size={20} color={colors.primary} />
            <Text style={[styles.instructionText, { color: colors.text, fontFamily: Fonts.medium }]}>
              يرجى مراجعة الأصناف ومطابقة رقم الطلب #{trip.order_number} مع فاتورة المطعم
            </Text>
          </View>

          {/* Items Checklist */}
          <ScrollView style={styles.itemsList} nestedScrollEnabled>
            {(trip.items || []).map((item, idx) => {
              const isChecked = !!checkedItems[idx];
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleItemCheck(idx)}
                  activeOpacity={0.7}
                  style={[
                    styles.itemRow,
                    { borderColor: colors.border },
                    isChecked && { backgroundColor: colors.surface },
                  ]}
                >
                  <View style={styles.itemQuantityBadge}>
                    <Text style={[styles.itemQty, { color: colors.primary, fontFamily: Fonts.bold }]}>
                      {item.quantity}x
                    </Text>
                  </View>
                  <View style={styles.itemTextContainer}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: colors.text, fontFamily: Fonts.medium },
                        isChecked && styles.strikethrough,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <CheckCircle2
                    size={22}
                    color={isChecked ? colors.success : colors.border}
                    fill={isChecked ? colors.successLight : 'transparent'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={handlePickup}
            disabled={isActionLoading}
            style={[styles.primaryActionBtn, { backgroundColor: colors.secondary }]}
          >
            {isActionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryActionBtnText, { fontFamily: Fonts.bold }]}>
                استلمت الطلب وبدء التحرك للعميل 🚀
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* PHASE 3: TO CUSTOMER */}
      {localPhase === 'TO_CUST' && (
        <View style={styles.phaseContainer}>
          <View style={styles.infoRow}>
            <View style={styles.infoTextContainer}>
              <Text style={[styles.targetLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                العميل ومكان التسليم
              </Text>
              <Text style={[styles.targetName, { color: colors.text, fontFamily: Fonts.bold }]}>
                {trip.customer
                  ? `${trip.customer.first_name || ''} ${trip.customer.last_name || ''}`.trim()
                  : ((trip as any).customer_name || 'العميل')}
              </Text>
              <Text style={[styles.targetAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                {trip.delivery_address?.street || 'العنوان محدد في الخريطة'}
                {trip.delivery_address?.building_number ? ` - عمارة ${trip.delivery_address.building_number}` : ''}
                {trip.delivery_address?.floor ? ` - طابق ${trip.delivery_address.floor}` : ''}
              </Text>
              {trip.delivery_address?.delivery_instructions ? (
                <Text style={[styles.instructions, { color: colors.secondary, fontFamily: Fonts.medium }]}>
                  ملاحظات: {trip.delivery_address.delivery_instructions}
                </Text>
              ) : null}
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                onPress={() => handleCall(trip.customer?.phone_number || (trip as any).customer_phone)}
                style={[styles.circleButton, { backgroundColor: colors.surface }]}
              >
                <Phone size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleWhatsApp(trip.customer?.phone_number || (trip as any).customer_phone)}
                style={[styles.circleButton, { backgroundColor: colors.successLight }]}
              >
                <MessageCircle size={18} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const lat = trip.delivery_address?.latitude ?? Number((trip as any).delivery_address?.latitude);
                  const lon = trip.delivery_address?.longitude ?? Number((trip as any).delivery_address?.longitude);
                  if (lat && lon) {
                    openExternalNavigation(
                      lat,
                      lon,
                      trip.customer?.first_name || 'العميل'
                    );
                  }
                }}
                style={[styles.circleButton, { backgroundColor: colors.primaryLight }]}
              >
                <Navigation size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setLocalPhase('AT_CUST')}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryActionBtnText, { fontFamily: Fonts.bold }]}>
              وصلت لموقع العميل 📍
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PHASE 4: AT CUSTOMER (COD Alert & OTP Input) */}
      {localPhase === 'AT_CUST' && (
        <View style={styles.phaseContainer}>
          {/* COD or Paid Online Banner */}
          {trip.payment_method === 'COD' ? (
            <View style={[styles.paymentBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Banknote size={24} color={colors.warning} />
              <View style={styles.paymentBannerText}>
                <Text style={[styles.paymentBannerTitle, { color: colors.warning, fontFamily: Fonts.bold }]}>
                  تحصيل كاش من العميل
                </Text>
                <Text style={[styles.paymentBannerAmount, { color: colors.text, fontFamily: Fonts.extraBold }]}>
                  المبلغ المطلوب تحصيله: {trip.cash_to_collect || trip.total_amount} ج.م
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.paymentBanner, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
              <ShieldCheck size={24} color={colors.success} />
              <View style={styles.paymentBannerText}>
                <Text style={[styles.paymentBannerTitle, { color: colors.success, fontFamily: Fonts.bold }]}>
                  الطلب مدفوع إلكترونياً
                </Text>
                <Text style={[styles.paymentBannerAmount, { color: colors.text, fontFamily: Fonts.medium }]}>
                  لا تحصّل أي مبالغ نقدية من العميل
                </Text>
              </View>
            </View>
          )}

          {/* OTP Verification Box */}
          <View style={[styles.otpSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.otpTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              رمز تسليم الطلب (OTP)
            </Text>
            <Text style={[styles.otpSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              اطلب من العميل إعطائك رمز التأكيد المكون من 4 أرقام
            </Text>

            <TextInput
              style={[
                styles.otpInput,
                {
                  backgroundColor: colors.card,
                  borderColor: otpError ? colors.danger : colors.border,
                  color: colors.text,
                  fontFamily: Fonts.extraBold,
                },
              ]}
              value={otpInput}
              onChangeText={(text) => {
                setOtpInput(text);
                setOtpError(null);
              }}
              placeholder="----"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />

            {otpError && (
              <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                {otpError}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleCompleteOtp}
            disabled={isActionLoading}
            style={[styles.primaryActionBtn, { backgroundColor: colors.success }]}
          >
            {isActionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryActionBtnText, { fontFamily: Fonts.bold }]}>
                تأكيد التسليم وإنهاء الطلب 🎉
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: Spacing.md,
  },
  cardCollapsed: {
    paddingVertical: Spacing.sm + 2,
    gap: 0,
  },
  topBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  topBarLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  emergencySupportBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 4,
  },
  emergencySupportText: {
    fontSize: 11,
  },
  collapseIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  orderNum: {
    fontSize: 16,
  },
  phaseContainer: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  targetLabel: {
    fontSize: 12,
  },
  targetName: {
    fontSize: 17,
    marginTop: 2,
  },
  targetAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  instructions: {
    fontSize: 12,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtn: {
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  instructionBox: {
    flexDirection: 'row-reverse',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  itemsList: {
    maxHeight: 160,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  itemQuantityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  itemQty: {
    fontSize: 14,
  },
  itemTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    fontSize: 14,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  paymentBanner: {
    flexDirection: 'row-reverse',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Spacing.md,
  },
  paymentBannerText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  paymentBannerTitle: {
    fontSize: 13,
  },
  paymentBannerAmount: {
    fontSize: 15,
    marginTop: 2,
  },
  otpSection: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  otpTitle: {
    fontSize: 16,
  },
  otpSubtitle: {
    fontSize: 12,
  },
  otpInput: {
    width: 160,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    fontSize: 26,
    letterSpacing: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
