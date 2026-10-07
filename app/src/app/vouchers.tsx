import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Ticket,
  Copy,
  Check,
  Tag,
  Percent,
  Sparkles,
  AlertCircle,
  Calendar,
  ShoppingBag,
  ArrowRight,
  BadgePercent,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { promotionService, CouponItem } from '../services/promotionService';
import { useAuthStore } from '../store/authStore';

export default function VouchersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Manual code input
  const [inputCode, setInputCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    discount?: number;
  } | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await promotionService.getCoupons();
      if (res.data) {
        setCoupons(res.data);
      }
    } catch (err) {
      console.warn('Error fetching coupons:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCoupons();
  };

  const handleCopyCode = async (code: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
      }, 2500);
    } catch {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const handleValidateCode = async () => {
    const trimmed = inputCode.trim();
    if (!trimmed) return;

    if (!isAuthenticated) {
      setValidationResult({
        success: false,
        message: 'يرجى تسجيل الدخول أولاً للتحقق من صلاحية الكوبون في حسابك.',
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const res = await promotionService.validateCoupon(trimmed, 100);
      if (res.data && res.data.valid) {
        setValidationResult({
          success: true,
          message: `كوبون صالح! يوفر خصم بقيمة ${res.data.discount_amount} ر.س على طلب تجريبي بقيمة 100 ر.س`,
          discount: res.data.discount_amount,
        });
      } else {
        setValidationResult({
          success: false,
          message: res.error || 'كوبون الخصم غير صالح أو منتهي الصلاحية',
        });
      }
    } catch {
      setValidationResult({
        success: false,
        message: 'حدث خطأ أثناء فحص الكوبون. يرجى المحاولة لاحقاً',
      });
    } finally {
      setValidating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>القسائم والعروض</Text>
          <Text style={styles.headerSubtitle}>وفر أكثر مع كوبونات فوكس شوب الحصرية</Text>
        </View>
        <View style={styles.badgeWrapper}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{coupons.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />
        }
      >
        {/* Manual Voucher Input Card */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.inputCard}>
          <View style={styles.inputCardHeader}>
            <Ticket size={20} color={Colors.light.primary} />
            <Text style={styles.inputCardTitle}>هل لديك كود خصم خاص؟</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="أدخل كود الكوبون هنا..."
              placeholderTextColor="#9CA3AF"
              value={inputCode}
              onChangeText={(txt) => {
                setInputCode(txt.toUpperCase());
                if (validationResult) setValidationResult(null);
              }}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.applyButton, (!inputCode.trim() || validating) && styles.applyButtonDisabled]}
              onPress={handleValidateCode}
              disabled={!inputCode.trim() || validating}
              activeOpacity={0.8}
            >
              {validating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.applyButtonText}>تحقق</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Validation Result Box */}
          {validationResult && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={[
                styles.feedbackBox,
                validationResult.success ? styles.feedbackSuccess : styles.feedbackError,
              ]}
            >
              {validationResult.success ? (
                <Check size={18} color="#059669" style={{ marginLeft: 8 }} />
              ) : (
                <AlertCircle size={18} color="#DC2626" style={{ marginLeft: 8 }} />
              )}
              <Text
                style={[
                  styles.feedbackText,
                  validationResult.success ? styles.feedbackSuccessText : styles.feedbackErrorText,
                ]}
              >
                {validationResult.message}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Sparkles size={20} color={Colors.light.primary} />
          <Text style={styles.sectionTitle}>العروض المتاحة لك الآن</Text>
        </View>

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <Text style={styles.loadingText}>جاري تحميل أقوى العروض...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && coupons.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <BadgePercent size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>لا توجد كوبونات متاحة حالياً</Text>
            <Text style={styles.emptySubtitle}>تابعنا باستمرار للاستفادة من أحدث العروض والخصومات القادمة.</Text>
          </View>
        )}

        {/* Coupons List */}
        {!loading &&
          coupons.map((coupon, index) => {
            const isCopied = copiedCode === coupon.code;
            const isPercent = coupon.discount_type === 'PERCENT';
            const discountVal = parseFloat(coupon.discount_value);

            return (
              <Animated.View
                key={coupon.id}
                entering={FadeInUp.delay(150 + index * 80).springify()}
                style={styles.ticketCard}
              >
                {/* Left Ticket Stub (Discount value) */}
                <View style={styles.ticketStub}>
                  <View style={styles.discountValueRow}>
                    <Text style={styles.discountNum}>{discountVal}</Text>
                    {isPercent ? (
                      <Percent size={18} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text style={styles.discountCurrency}>ر.س</Text>
                    )}
                  </View>
                  <Text style={styles.stubSubtext}>
                    {isPercent ? 'خصم مئوي' : 'خصم مباشر'}
                  </Text>
                  {coupon.first_order_only && (
                    <View style={styles.firstOrderTag}>
                      <Text style={styles.firstOrderTagText}>أول طلب</Text>
                    </View>
                  )}
                </View>

                {/* Perforation Cutouts */}
                <View style={styles.notchContainer}>
                  <View style={styles.notchTop} />
                  <View style={styles.dashedLine} />
                  <View style={styles.notchBottom} />
                </View>

                {/* Right Ticket Body (Details & Code Action) */}
                <View style={styles.ticketBody}>
                  <View style={styles.couponTopRow}>
                    <View style={styles.codePill}>
                      <Tag size={13} color={Colors.light.primary} />
                      <Text style={styles.codePillText}>{coupon.code}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.copyBtn, isCopied && styles.copyBtnSuccess]}
                      onPress={() => handleCopyCode(coupon.code)}
                      activeOpacity={0.7}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} color="#059669" />
                          <Text style={styles.copiedText}>تم النسخ</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={14} color={Colors.light.primary} />
                          <Text style={styles.copyBtnText}>نسخ الكود</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.ticketTitle}>
                    وفر {discountVal} {isPercent ? '%' : 'ر.س'} عند الطلب
                  </Text>

                  {/* Conditions */}
                  <View style={styles.conditionRow}>
                    <ShoppingBag size={12} color="#6B7280" />
                    <Text style={styles.conditionText}>
                      الحد الأدنى للطلب: {parseFloat(coupon.min_order_amount)} ر.س
                    </Text>
                  </View>

                  {coupon.valid_to && (
                    <View style={styles.conditionRow}>
                      <Calendar size={12} color="#6B7280" />
                      <Text style={styles.conditionText}>
                        ينتهي في: {formatDate(coupon.valid_to)}
                      </Text>
                    </View>
                  )}

                  {/* Order Now Link */}
                  <TouchableOpacity
                    style={styles.useNowBtn}
                    onPress={() => router.push('/')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.useNowBtnText}>استخدم الكوبون الآن</Text>
                    <ArrowRight size={14} color={Colors.light.primary} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  badgeWrapper: {
    marginLeft: 8,
  },
  countBadge: {
    backgroundColor: Colors.light.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  countBadgeText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputCardTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginRight: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#111827',
    textAlign: 'right',
  },
  applyButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'left',
  },
  feedbackSuccessText: {
    color: '#065F46',
  },
  feedbackErrorText: {
    color: '#991B1B',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginRight: 8,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
  },
  ticketStub: {
    width: 100,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  discountValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  discountNum: {
    fontSize: 28,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
    lineHeight: 34,
  },
  discountCurrency: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
    marginRight: 2,
  },
  stubSubtext: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#FFE4E6',
    marginTop: 2,
  },
  firstOrderTag: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  firstOrderTagText: {
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  notchContainer: {
    width: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  notchTop: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginTop: -8,
  },
  dashedLine: {
    flex: 1,
    width: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  notchBottom: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: -8,
  },
  ticketBody: {
    flex: 1,
    padding: 14,
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  codePillText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  copyBtnSuccess: {
    backgroundColor: '#ECFDF5',
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  copiedText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#059669',
  },
  ticketTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'left',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
  },
  useNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  useNowBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
});
