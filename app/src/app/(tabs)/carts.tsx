import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { orderService, CheckoutPayload, ValidateCouponResult } from '../../services/orderService';
import { promotionService, CouponItem } from '../../services/promotionService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Plus, Minus, Trash2, LogIn, CheckCircle, MapPin, ChevronLeft, Tag, X, ShoppingBag, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { CURRENCY, formatCurrency } from '../../constants/config';
import { useAddressStore } from '../../store/addressStore';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';

export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { items, restaurantId: cartRestaurantId, addItem, removeItem, deleteItem, clearCart, getTotalPrice } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [isPlacingOrder, setIsPlacingOrder] = React.useState(false);
  const [showAddressModal, setShowAddressModal] = React.useState(false);

  // Promotions & Coupon state
  const [couponCodeInput, setCouponCodeInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<ValidateCouponResult | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = React.useState<CouponItem[]>([]);

  const { selectedAddress, fetchAddresses } = useAddressStore();

  React.useEffect(() => {
    fetchAddresses();
    promotionService.getCoupons().then((res) => {
      if (res.data) setAvailableCoupons(res.data);
    }).catch(() => {});
  }, []);

  const subtotal = getTotalPrice();
  const deliveryFee = 15;
  const discountAmount = appliedCoupon ? Number(appliedCoupon.discount_amount) : 0;
  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  // If subtotal drops below coupon minimum order amount, notify and clear coupon
  React.useEffect(() => {
    if (appliedCoupon && appliedCoupon.coupon) {
      const minRequired = Number(appliedCoupon.coupon.min_order_amount) || 0;
      if (subtotal < minRequired) {
        setAppliedCoupon(null);
        setCouponError(`تم إلغاء الكوبون لأن المجموع الفرعي أصبح أقل من ${minRequired} ${CURRENCY}`);
      }
    }
  }, [subtotal]);

  const applyCouponCode = async (codeToApply: string) => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    const code = codeToApply.trim().toUpperCase();
    if (!code) {
      setCouponError('يرجى إدخال كود الكوبون');
      return;
    }

    setCouponCodeInput(code);
    const targetRestaurantId = cartRestaurantId || items[0]?.restaurantId;
    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const res = await orderService.validateCoupon({
        code,
        subtotal,
        delivery_fee: deliveryFee,
        restaurant_id: targetRestaurantId,
      });

      if (res.data && res.data.valid) {
        setAppliedCoupon(res.data);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.error || 'كوبون الخصم غير صالح أو منتهي الصلاحية');
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err?.message || 'تعذر التحقق من الكوبون');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleApplyCoupon = () => applyCouponCode(couponCodeInput);

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
  };

  const handleClearCart = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من تفريغ سلة المشتريات بالكامل؟');
      if (confirmed) {
        clearCart();
        setAppliedCoupon(null);
      }
    } else {
      Alert.alert(
        'مسح السلة',
        'هل أنت متأكد من حذف جميع المنتجات من السلة؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'مسح',
            style: 'destructive',
            onPress: () => {
              clearCart();
              setAppliedCoupon(null);
            },
          },
        ]
      );
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      if (Platform.OS === 'web') {
        const proceed = window.confirm('يجب تسجيل الدخول لإتمام الطلب. هل تود الانتقال لصفحة الدخول؟');
        if (proceed) router.push('/auth/login');
      } else {
        Alert.alert(
          'تسجيل الدخول مطلوب',
          'يجب تسجيل الدخول لإتمام الطلب وتتبع السائق',
          [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'دخول', onPress: () => router.push('/auth/login') },
          ]
        );
      }
      return;
    }

    if (!selectedAddress) {
      const msg = 'يرجى تحديد عنوان التوصيل أولاً قبل إتمام الطلب';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('تنبيه', msg);
      setShowAddressModal(true);
      return;
    }

    try {
      setIsPlacingOrder(true);

      const targetRestaurantId = cartRestaurantId || items[0]?.restaurantId;
      if (!targetRestaurantId) {
        throw new Error('بيانات المتجر غير مكتملة في السلة');
      }

      const payload: CheckoutPayload = {
        restaurant_id: targetRestaurantId,
        items: items.map((i) => ({
          menu_item_id: i.id,
          quantity: i.quantity,
          unit_price: i.price,
          options: [],
        })),
        delivery_address_id: selectedAddress.id,
        delivery_fee: deliveryFee,
        payment_method: 'COD',
        coupon_code: appliedCoupon?.code,
      };

      const res = await orderService.createOrder(payload);

      if (res.data) {
        clearCart();
        setAppliedCoupon(null);
        router.push(`/order/${res.data.id}` as any);
      } else {
        const errMessage = res.error || 'حدث خطأ أثناء تنفيذ طلبك، يرجى المحاولة مرة أخرى.';
        if (Platform.OS === 'web') window.alert(errMessage);
        else Alert.alert('فشل إتمام الطلب', errMessage);
      }
    } catch (err: any) {
      const msg = err.message || 'حدث خطأ غير متوقع';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('خطأ', msg);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <View style={styles.webContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
              <ArrowRight color={theme.text} size={24} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>سلة المشتريات</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.emptyScrollContent}
          >
            <View style={styles.emptyContent}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight }]}>
                <ShoppingBag size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyText, { color: theme.text }]}>سلتك فارغة</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>لم تقم بإضافة أي منتجات بعد إلى سلتك.</Text>
              <TouchableOpacity style={[styles.startBrowsingBtn, { backgroundColor: theme.primary }]} onPress={() => router.push('/(tabs)')}>
                <Text style={styles.startBrowsingText}>تصفح المتاجر الآن</Text>
              </TouchableOpacity>

              {availableCoupons.length > 0 && (
                <View style={[styles.emptyCouponsBox, { backgroundColor: theme.surface }]}>
                  <View style={styles.emptyCouponsHeader}>
                    <Tag size={16} color={theme.primary} />
                    <Text style={[styles.emptyCouponsTitle, { color: theme.primary }]}>كوبونات الخصم الفعالة المتاحة لك اليوم:</Text>
                  </View>
                  <View style={styles.emptyCouponsPills}>
                    {availableCoupons.map((c) => (
                      <View key={c.id} style={[styles.emptyCouponPill, { backgroundColor: theme.card }]}>
                        <Text style={[styles.emptyCouponCode, { color: theme.primary }]}>{c.code}</Text>
                        <Text style={[styles.emptyCouponDesc, { color: theme.textSecondary }]}>
                          {c.discount_type === 'PERCENT'
                            ? `خصم ${parseFloat(String(c.discount_value))}%`
                            : c.discount_type === 'FREE_DELIVERY'
                            ? 'توصيل مجاني'
                            : `خصم ${parseFloat(String(c.discount_value))} ${CURRENCY}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.webContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
            <ArrowRight color={theme.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>سلة المشتريات</Text>
          <TouchableOpacity onPress={handleClearCart}>
            <Trash2 color={theme.error} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.itemsList}>
            {items.map((item) => (
              <View key={item.id} style={[styles.cartItem, { backgroundColor: theme.card }]}>
                <Image source={{ uri: item.image }} style={styles.itemImage} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.itemPrice, { color: theme.primary }]}>{formatCurrency(item.price * item.quantity)}</Text>
                </View>
                <View style={styles.itemActions}>
                  <View style={[styles.quantityControl, { backgroundColor: theme.surface }]}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, { backgroundColor: theme.primaryLight }]}
                      onPress={() => removeItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Minus size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, { backgroundColor: theme.primaryLight }]}
                      onPress={() => addItem(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Plus size={16} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.itemDeleteBtn, { backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}
                    onPress={() => deleteItem(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

        {/* Delivery Address Section */}
        <View style={[styles.addressSection, { backgroundColor: theme.card }]}>
          <View style={styles.addressSectionHeader}>
            <Text style={[styles.addressSectionTitle, { color: theme.text }]}>عنوان التوصيل</Text>
            <TouchableOpacity onPress={() => setShowAddressModal(true)} activeOpacity={0.7}>
              <Text style={[styles.changeAddressLink, { color: theme.primary }]}>
                {selectedAddress ? 'تغيير العنوان' : 'إضافة عنوان'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addressCard, { backgroundColor: theme.surface }]}
            onPress={() => setShowAddressModal(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.addressIconCircle, { backgroundColor: theme.primaryLight }]}>
              <MapPin size={20} color={theme.primary} />
            </View>
            <View style={styles.addressTextContainer}>
              {selectedAddress ? (
                <>
                  <Text style={[styles.addressTitleText, { color: theme.text }]}>{selectedAddress.title}</Text>
                  <Text style={[styles.addressStreetText, { color: theme.textSecondary }]} numberOfLines={2}>
                    {selectedAddress.street}
                  </Text>
                  {selectedAddress.building_number || selectedAddress.floor || selectedAddress.apartment_number ? (
                    <Text style={[styles.addressDetailsText, { color: theme.textSecondary }]}>
                      {[
                        selectedAddress.building_number ? `عمارة: ${selectedAddress.building_number}` : '',
                        selectedAddress.floor ? `دور: ${selectedAddress.floor}` : '',
                        selectedAddress.apartment_number ? `شقة: ${selectedAddress.apartment_number}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={[styles.noAddressSelectedText, { color: theme.primary }]}>
                  اضغط هنا لتحديد موقع وعنوان التوصيل
                </Text>
              )}
            </View>
            <ChevronLeft size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Coupon & Promotions Section */}
        <View style={[styles.couponSection, { backgroundColor: theme.card }]}>
          <View style={styles.couponSectionHeader}>
            <Tag size={18} color={theme.primary} />
            <Text style={[styles.couponSectionTitle, { color: theme.text }]}>كوبون الخصم أو العرض الترويجي</Text>
          </View>

          {appliedCoupon ? (
            <View style={[styles.appliedCouponCard, { backgroundColor: theme.successLight }]}>
              <View style={styles.appliedCouponInfo}>
                <View style={styles.appliedBadge}>
                  <Text style={styles.appliedCodeText}>{appliedCoupon.code}</Text>
                </View>
                <View style={styles.appliedDetails}>
                  <Text style={styles.appliedDiscountText}>
                    تم تطبيق الخصم: -{formatCurrency(discountAmount)}
                  </Text>
                  {appliedCoupon.coupon?.first_order_only && (
                    <Text style={styles.firstOrderTag}>للطلب الأول فقط</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon} style={styles.removeCouponBtn}>
                <X size={18} color={theme.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={[styles.couponInput, { backgroundColor: theme.surface, color: theme.text }]}
                  placeholder="أدخل كود الكوبون (مثال: FOX20)"
                  placeholderTextColor={theme.textSecondary}
                  value={couponCodeInput}
                  onChangeText={(text) => {
                    setCouponCodeInput(text.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  autoCapitalize="characters"
                  editable={!isValidatingCoupon}
                />
                <TouchableOpacity
                  style={[
                    styles.applyCouponBtn,
                    { backgroundColor: theme.primary },
                    (!couponCodeInput.trim() || isValidatingCoupon) && styles.applyCouponBtnDisabled,
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponCodeInput.trim() || isValidatingCoupon}
                  activeOpacity={0.8}
                >
                  {isValidatingCoupon ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.applyCouponText}>تطبيق</Text>
                  )}
                </TouchableOpacity>
              </View>

              {couponError && (
                <Text style={styles.couponErrorText}>{couponError}</Text>
              )}

              {/* Quick Available Coupon Chips */}
              {availableCoupons.length > 0 && !appliedCoupon && (
                <View style={styles.quickCouponsRow}>
                  <Text style={[styles.quickCouponsLabel, { color: theme.textSecondary }]}>كوبونات متاحة للتطبيق بضغطة زر:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
                    {availableCoupons.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => applyCouponCode(c.code)}
                        style={[styles.quickCouponChip, { backgroundColor: theme.surface }]}
                        activeOpacity={0.8}
                      >
                        <Tag size={12} color={theme.primary} />
                        <Text style={[styles.quickCouponChipCode, { color: theme.primary }]}>{c.code}</Text>
                        <Text style={[styles.quickCouponChipVal, { color: theme.textSecondary }]}>
                          ({c.discount_type === 'PERCENT' ? `${parseFloat(String(c.discount_value))}%` : c.discount_type === 'FREE_DELIVERY' ? 'توصيل مجاني' : `${parseFloat(String(c.discount_value))} ${CURRENCY}`})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={[styles.summaryContainer, { backgroundColor: theme.card }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>المجموع الفرعي</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>رسوم التوصيل</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{formatCurrency(deliveryFee)}</Text>
          </View>

          {appliedCoupon && discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.discountLabel}>خصم الكوبون ({appliedCoupon.code})</Text>
              <Text style={styles.discountValue}>-{formatCurrency(discountAmount)}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>الإجمالي النهائي</Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {!isAuthenticated && (
          <TouchableOpacity
            style={[styles.guestNotice, { backgroundColor: theme.primaryLight }]}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <LogIn size={18} color={theme.primary} />
            <Text style={[styles.guestNoticeText, { color: theme.primary }]}>
              أنت تتصفح كـ زائر، اضغط هنا لتسجيل الدخول قبل تأكيد الطلب.
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Pinned Checkout Footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.card,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: theme.primary }, isPlacingOrder && { opacity: 0.8 }]}
          onPress={handleCheckout}
          disabled={isPlacingOrder}
          activeOpacity={0.88}
        >
          {isPlacingOrder ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.checkoutText}>
              تأكيد الطلب • {formatCurrency(total)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      </View>

      <AddressSelectorModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1 },
  webContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    position: 'relative',
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: 'Tajawal_700Bold' },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyIconCircle: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  emptyText: { fontSize: 22, fontFamily: 'Tajawal_700Bold', marginBottom: 8 },
  emptySubtext: { fontSize: 15, fontFamily: 'Tajawal_400Regular', textAlign: 'center', marginBottom: 28 },
  startBrowsingBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24 },
  startBrowsingText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Tajawal_700Bold' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  itemsList: { marginBottom: 16, gap: 10 },
  cartItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 18,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  itemImage: { width: 64, height: 64, borderRadius: 14, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: 'Tajawal_700Bold', marginBottom: 4 },
  itemPrice: { fontSize: 15, fontFamily: 'Tajawal_700Bold' },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityControl: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 22, 
    padding: 3, 
    borderWidth: 0,
  },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 15, fontFamily: 'Tajawal_700Bold', marginHorizontal: 8 },
  itemDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressSection: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  addressSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressSectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  changeAddressLink: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0,
  },
  addressIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressTitleText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 2,
    textAlign: 'right',
  },
  addressStreetText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    lineHeight: 18,
    textAlign: 'right',
  },
  addressDetailsText: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
    textAlign: 'right',
  },
  noAddressSelectedText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
  },
  summaryContainer: { 
    padding: 16, 
    borderRadius: 18,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, fontFamily: 'Tajawal_400Regular' },
  summaryValue: { fontSize: 14, fontFamily: 'Tajawal_700Bold' },
  totalRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8, 
    paddingTop: 14, 
    marginBottom: 0,
  },
  totalLabel: { fontSize: 17, fontFamily: 'Tajawal_700Bold' },
  totalValue: { fontSize: 18, fontFamily: 'Tajawal_700Bold' },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 16, 
    paddingTop: 12, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -4 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 10, 
    elevation: 8, 
    borderWidth: 0,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  checkoutBtn: { height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  checkoutText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Tajawal_700Bold' },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
  },
  guestNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  couponSection: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  couponSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  couponSectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'left',
    letterSpacing: 1,
  },
  applyCouponBtn: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponBtnDisabled: {
    opacity: 0.5,
  },
  applyCouponText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  couponErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    marginTop: 6,
    textAlign: 'right',
  },
  appliedCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    borderWidth: 0,
  },
  appliedCouponInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  appliedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  appliedCodeText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 13,
    color: '#15803D',
    letterSpacing: 0.5,
  },
  appliedDetails: {
    flex: 1,
  },
  appliedDiscountText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#166534',
  },
  firstOrderTag: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#B45309',
    marginTop: 2,
  },
  removeCouponBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  discountLabel: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#16A34A',
  },
  discountValue: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#16A34A',
  },
  emptyCouponsBox: {
    marginTop: 24,
    width: '100%',
    borderRadius: 18,
    padding: 14,
    borderWidth: 0,
  },
  emptyCouponsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  emptyCouponsTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  emptyCouponsPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyCouponPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0,
  },
  emptyCouponCode: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    letterSpacing: 0.5,
  },
  emptyCouponDesc: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  quickCouponsRow: {
    marginTop: 10,
  },
  quickCouponsLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    marginBottom: 6,
    textAlign: 'right',
  },
  quickCouponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 0,
  },
  quickCouponChipCode: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  quickCouponChipVal: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
  },
});
