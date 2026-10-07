import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { DeliveryTrip, useTripStore } from '../store/tripStore';
import { useSupportStore } from '../store/supportStore';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Banknote,
  ShieldCheck,
  Headphones,
  X,
  Camera,
  MessageSquare,
  Send,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Modal } from 'react-native';

interface ActiveTripCardProps {
  trip: DeliveryTrip;
  onClose?: () => void;
}

export const ActiveTripCard: React.FC<ActiveTripCardProps> = ({ trip, onClose }) => {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { pickupTrip, verifyOtpAndComplete, completeContactless, isActionLoading } = useTripStore();
  const { tickets, createTicket } = useSupportStore();
  const [isOpeningSupport, setIsOpeningSupport] = useState(false);

  // New features: Quick Chat & Contactless POD
  const [showQuickChatModal, setShowQuickChatModal] = useState(false);
  const [showContactlessModal, setShowContactlessModal] = useState(false);
  const [contactlessNote, setContactlessNote] = useState('تم ترك الطلب بأمان عند باب العميل');
  const [isPhotoAttached, setIsPhotoAttached] = useState(false);

  const CANNED_MESSAGES = [
    'أنا في الطريق إليك الآن بالطلب 🛵',
    'وصلت لعنوانك وبانتظارك بالأسفل 📍',
    'أرجو تجهيز رمز الاستلام (OTP) 🔢',
    'الرجاء الرد على الهاتف لتسليم وجبتك 📞',
  ];

  const handleSendCannedMessage = (msg: string) => {
    setShowQuickChatModal(false);
    const phone = trip.customer?.phone_number || (trip as any).customer_phone;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`sms:${phone}?body=${encodeURIComponent(msg)}`);
      });
    }
  };

  const handleConfirmContactless = async () => {
    setShowContactlessModal(false);
    const res = await completeContactless(trip.id, contactlessNote);
    if (!res.success) {
      Alert.alert('تنبيه', res.error || 'تعذر إتمام التسليم بدون تواصل');
    }
  };

  const handleOpenOrderSupport = async () => {
    setIsOpeningSupport(true);
    try {
      const existing = tickets.find(
        (t) =>
          (t.order === trip.order_id || t.order_number === trip.order_number) &&
          (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_USER')
      );

      if (existing) {
        setIsOpeningSupport(false);
        router.push(`/support/${existing.id}` as any);
        return;
      }

      const newTicket = await createTicket({
        subject: `مساعدة عاجلة في الطلب #${trip.order_number}`,
        category: 'ORDER_ISSUE',
        order_id: trip.order_id || trip.id,
        initial_message: `مرحباً، أحتاج مساعدة عاجلة من فريق الدعم بخصوص الطلب #${trip.order_number}`,
      });

      setIsOpeningSupport(false);
      if (newTicket) {
        router.push(`/support/${newTicket.id}` as any);
      } else {
        router.push('/support' as any);
      }
    } catch {
      setIsOpeningSupport(false);
      router.push('/support' as any);
    }
  };
  
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
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeIconBox, { backgroundColor: colors.surface }]}
              accessibilityLabel="إغلاق اللوحة الجانبية"
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <View style={[styles.collapseIconBox, { backgroundColor: colors.surface }]}>
            {isCollapsed ? (
              <ChevronUp size={18} color={colors.text} />
            ) : (
              <ChevronDown size={18} color={colors.text} />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Body content (hidden when collapsed) */}
      {!isCollapsed && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.md, paddingBottom: 4 }}
          style={{ maxHeight: 540 }}
        >

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
                onPress={handleOpenOrderSupport}
                disabled={isOpeningSupport}
                style={[styles.circleButton, { backgroundColor: colors.primaryLight }]}
                accessibilityLabel="الدعم الفني للطلب"
              >
                {isOpeningSupport ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Headphones size={18} color={colors.primary} />
                )}
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
                onPress={() => setShowQuickChatModal(true)}
                style={[styles.circleButton, { backgroundColor: colors.surface }]}
                accessibilityLabel="رسائل سريعة للعميل"
              >
                <MessageSquare size={18} color={colors.primary} />
              </TouchableOpacity>
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
                onPress={handleOpenOrderSupport}
                disabled={isOpeningSupport}
                style={[styles.circleButton, { backgroundColor: colors.primaryLight }]}
                accessibilityLabel="الدعم الفني للطلب"
              >
                {isOpeningSupport ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Headphones size={18} color={colors.primary} />
                )}
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

          {/* Fallback Contactless POD Trigger */}
          <TouchableOpacity
            onPress={() => setShowContactlessModal(true)}
            style={styles.contactlessToggleBtn}
            activeOpacity={0.7}
          >
            <Camera size={16} color={colors.primary} />
            <Text style={[styles.contactlessToggleText, { color: colors.primary, fontFamily: Fonts.medium }]}>
              تعذر الحصول على OTP؟ تسليم بدون تواصل بالصورة 📸
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )}

  {/* Quick Chat Canned Messages Modal */}
  <Modal
    visible={showQuickChatModal}
    transparent
    animationType="fade"
    onRequestClose={() => setShowQuickChatModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowQuickChatModal(false)}
            style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            رسائل جاهزة وسريعة للعميل 💬
          </Text>
        </View>

        <Text style={[styles.modalSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
          اختر رسالة ليتم إرسالها فوراً عبر واتساب أو الرسائل القصيرة:
        </Text>

        <View style={styles.cannedList}>
          {CANNED_MESSAGES.map((msg, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSendCannedMessage(msg)}
              activeOpacity={0.7}
              style={[
                styles.cannedItem,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Send size={16} color={colors.primary} />
              <Text style={[styles.cannedText, { color: colors.text, fontFamily: Fonts.medium }]}>
                {msg}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  </Modal>

  {/* Contactless Proof of Delivery Modal */}
  <Modal
    visible={showContactlessModal}
    transparent
    animationType="fade"
    onRequestClose={() => setShowContactlessModal(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowContactlessModal(false)}
            style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            تسليم بدون تواصل (POD) 📸
          </Text>
        </View>

        <Text style={[styles.modalSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
          يرجى التقاط صورة تثبت وضع الطلب بأمان عند باب العميل أو في مكان التسليم
        </Text>

        {/* Photo Box Simulator */}
        <TouchableOpacity
          onPress={() => setIsPhotoAttached((prev) => !prev)}
          style={[
            styles.photoBox,
            {
              backgroundColor: isPhotoAttached ? colors.successLight : colors.surface,
              borderColor: isPhotoAttached ? colors.success : colors.border,
            },
          ]}
          activeOpacity={0.8}
        >
          {isPhotoAttached ? (
            <>
              <CheckCircle2 size={36} color={colors.success} />
              <Text style={[styles.photoBoxText, { color: colors.success, fontFamily: Fonts.bold }]}>
                تم التقاط صورة إثبات التسليم بنجاح 📸
              </Text>
              <Text style={[styles.photoBoxSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                انقر لتغيير الصورة
              </Text>
            </>
          ) : (
            <>
              <Camera size={36} color={colors.primary} />
              <Text style={[styles.photoBoxText, { color: colors.text, fontFamily: Fonts.bold }]}>
                انقر لالتقاط صورة للطلب عند الباب
              </Text>
              <Text style={[styles.photoBoxSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                صورة الإثبات تُحفظ مع تفاصيل الرحلة
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Note Input */}
        <View style={styles.modalInputBlock}>
          <Text style={[styles.modalInputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            ملاحظة إضافية (اختياري):
          </Text>
          <TextInput
            style={[
              styles.modalTextInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
                fontFamily: Fonts.regular,
              },
            ]}
            value={contactlessNote}
            onChangeText={setContactlessNote}
            placeholder="مثال: تم ترك الطلب على الطاولة أمام الباب"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlign="right"
          />
        </View>

        {/* Confirm Action Button */}
        <TouchableOpacity
          onPress={handleConfirmContactless}
          disabled={isActionLoading}
          style={[styles.primaryActionBtn, { backgroundColor: colors.success, marginTop: Spacing.sm }]}
        >
          {isActionLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryActionBtnText, { fontFamily: Fonts.bold }]}>
              تأكيد إنهاء الطلب بدون تواصل ✅
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
</View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    gap: Spacing.sm,
    maxHeight: '100%',
  },
  cardCollapsed: {
    paddingVertical: Spacing.sm,
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
    gap: 6,
  },
  closeIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
  contactlessToggleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  contactlessToggleText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  cannedList: {
    gap: Spacing.sm,
    marginTop: 4,
  },
  cannedItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  cannedText: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
  },
  photoBoxText: {
    fontSize: 14,
    textAlign: 'center',
  },
  photoBoxSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalInputBlock: {
    gap: 6,
  },
  modalInputLabel: {
    fontSize: 13,
    textAlign: 'right',
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 70,
  },
});
