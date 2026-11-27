import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Heart,
  Store,
  ChevronLeft,
  Flame,
  Plus,
  Minus,
  Check,
  UtensilsCrossed,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { restaurantService, mapBackendMenuItemToFoodItem } from '../../services/restaurantService';
import { FoodItem, Modifier, ModifierGroup } from '../../types/models';
import { useCartStore, SelectedModifier } from '../../store/cartStore';
import { useFavoriteStore } from '../../store/favoriteStore';
import { formatCurrency } from '../../constants/config';
import { PRICING_UNIT_LABELS } from '../../constants/sectors';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const cartRestaurantId = useCartStore((state) => state.restaurantId);
  const cartRestaurantName = useCartStore((state) => state.restaurantName);

  const isFavorite = useFavoriteStore((state) => (id ? state.isItemFavorite(String(id)) : false));
  const toggleItem = useFavoriteStore((state) => state.toggleItem);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setImageError(false);
    try {
      const res = await restaurantService.getMenuItemDetail(String(id));
      if (res.data) {
        const mapped = mapBackendMenuItemToFoodItem(res.data);
        setItem(mapped);
        setSelectedByGroup({});
        setValidationError(null);
      } else {
        setError(res.error || 'تعذر تحميل تفاصيل الصنف');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تحميل الصنف');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const modifierGroups = item?.modifier_groups || [];

  const handleSelectModifier = (group: ModifierGroup, mod: Modifier) => {
    if (!mod.is_available) return;
    setValidationError(null);

    setSelectedByGroup((prev) => {
      const current = prev[group.id] || [];
      const isSingle = group.max_selections === 1;
      const isOptional = !group.is_required && group.min_selections === 0;

      if (isSingle) {
        if (current.includes(mod.id)) {
          return isOptional ? { ...prev, [group.id]: [] } : prev;
        }
        return { ...prev, [group.id]: [mod.id] };
      }

      if (current.includes(mod.id)) {
        return { ...prev, [group.id]: current.filter((mid) => mid !== mod.id) };
      }

      if (group.max_selections > 0 && current.length >= group.max_selections) {
        return prev;
      }

      return { ...prev, [group.id]: [...current, mod.id] };
    });
  };

  const selectedModifiers: SelectedModifier[] = useMemo(() => {
    const result: SelectedModifier[] = [];
    for (const group of modifierGroups) {
      const ids = selectedByGroup[group.id] || [];
      for (const mod of group.modifiers) {
        if (ids.includes(mod.id)) {
          result.push({
            id: mod.id,
            name: mod.name,
            price_delta: Number(mod.price_delta) || 0,
          });
        }
      }
    }
    return result;
  }, [modifierGroups, selectedByGroup]);

  const missingRequiredGroups = useMemo(() => {
    return modifierGroups.filter((g) => {
      const minReq = g.is_required ? Math.max(1, g.min_selections) : g.min_selections;
      if (minReq <= 0) return false;
      const count = (selectedByGroup[g.id] || []).length;
      return count < minReq;
    });
  }, [modifierGroups, selectedByGroup]);

  const modifiersDelta = useMemo(
    () => selectedModifiers.reduce((sum, m) => sum + m.price_delta, 0),
    [selectedModifiers]
  );

  const unitTotal = item ? item.price + modifiersDelta : 0;
  const totalPrice = unitTotal * quantity;

  const isOutOfStock = Boolean(
    item &&
      (item.is_available === false ||
        (item.is_stock_tracked && item.stock_quantity !== undefined && item.stock_quantity <= 0))
  );

  const isMaxStockReached = Boolean(
    item?.is_stock_tracked &&
      item.stock_quantity !== undefined &&
      quantity >= item.stock_quantity
  );

  const unitLabel =
    item?.pricing_unit && PRICING_UNIT_LABELS[item.pricing_unit]
      ? PRICING_UNIT_LABELS[item.pricing_unit]
      : item?.pricing_unit
      ? ` / ${item.pricing_unit}`
      : '';

  const performAddToCart = () => {
    if (!item) return;
    addItem(item, item.restaurantId, item.restaurantName, selectedModifiers, quantity);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/carts' as any);
    }
  };

  const handleAddToCartPress = () => {
    if (!item || isOutOfStock) return;

    if (missingRequiredGroups.length > 0) {
      const names = missingRequiredGroups.map((g) => g.name).join('، ');
      const msg = `يرجى اختيار الخيارات المطلوبة أولاً: ${names}`;
      setValidationError(msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('خيارات مطلوبة', msg);
      }
      return;
    }

    const effectiveCartRestaurantId = cartRestaurantId || cartItems[0]?.restaurantId;
    const isDifferentStore = Boolean(
      cartItems.length > 0 &&
        effectiveCartRestaurantId &&
        item.restaurantId &&
        effectiveCartRestaurantId !== item.restaurantId
    );

    if (!isDifferentStore) {
      performAddToCart();
      return;
    }

    const oldStoreLabel = cartRestaurantName || 'متجر آخر';
    const newStoreLabel = item.restaurantName || 'هذا المتجر';
    const message = `سلتك تحتوي حالياً على منتجات من "${oldStoreLabel}". هل تريد إفراغ السلة الحالية وإضافة "${item.name}" من "${newStoreLabel}"؟`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        performAddToCart();
      }
      return;
    }

    Alert.alert('استبدال محتويات السلة؟', message, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'نعم، استبدال السلة',
        style: 'destructive',
        onPress: performAddToCart,
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>جاري تحميل تفاصيل الصنف...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background, padding: 24 }]}>
        <AlertCircle size={48} color={theme.error} strokeWidth={1.5} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>تعذر عرض الصنف</Text>
        <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
          {error || 'لم يتم العثور على الصنف المطلوب'}
        </Text>
        <View style={styles.errorActions}>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={fetchDetail}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backTextBtn, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            activeOpacity={0.8}
          >
            <Text style={[styles.backTextBtnLabel, { color: theme.text }]}>رجوع</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const showImage = Boolean(item.image && !imageError);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* Hero Image Header */}
        <View style={[styles.heroContainer, { backgroundColor: theme.surfaceSecondary }]}>
          {showImage ? (
            <Image
              source={{ uri: item.image }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <UtensilsCrossed size={56} color={theme.textMuted} strokeWidth={1.3} />
            </View>
          )}

          {/* Floating Top Bar */}
          <View style={[styles.floatingHeader, { top: Math.max(insets.top, 12) + 4 }]}>
            <TouchableOpacity
              style={[
                styles.floatingBtn,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(15, 23, 42, 0.85)'
                    : 'rgba(255, 255, 255, 0.94)',
                },
              ]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              activeOpacity={0.8}
            >
              <ArrowRight size={22} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.floatingBtn,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(15, 23, 42, 0.85)'
                    : 'rgba(255, 255, 255, 0.94)',
                },
              ]}
              onPress={() => toggleItem(item)}
              activeOpacity={0.8}
            >
              <Heart
                size={21}
                color={isFavorite ? theme.primary : theme.text}
                fill={isFavorite ? theme.primary : 'transparent'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.body}>
          {/* Store Info Bar */}
          {item.restaurantId && item.restaurantName ? (
            <TouchableOpacity
              style={[styles.storeBar, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => router.push(`/restaurant/${item.restaurantId}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.storeBarRight}>
                <View style={[styles.storeIconWrap, { backgroundColor: theme.card }]}>
                  <Store size={15} color={theme.primary} />
                </View>
                <View style={styles.storeTextWrap}>
                  <Text style={[styles.storeNameText, { color: theme.text }]} numberOfLines={1}>
                    {item.restaurantName}
                  </Text>
                  {item.category_name ? (
                    <Text style={[styles.categoryNameText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.category_name}
                    </Text>
                  ) : null}
                </View>
              </View>
              <ChevronLeft size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {/* Status Badges */}
          {(item.is_popular ||
            isOutOfStock ||
            (item.is_stock_tracked &&
              item.stock_quantity !== undefined &&
              item.stock_quantity > 0 &&
              item.stock_quantity <= 5)) && (
            <View style={styles.badgesRow}>
              {item.is_popular ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7' },
                  ]}
                >
                  <Flame size={13} color="#D97706" fill="#D97706" />
                  <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>الأكثر طلباً</Text>
                </View>
              ) : null}

              {isOutOfStock ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F3F4F6' },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: theme.textSecondary }]}>نفدت الكمية</Text>
                </View>
              ) : item.is_stock_tracked &&
                item.stock_quantity !== undefined &&
                item.stock_quantity > 0 &&
                item.stock_quantity <= 5 ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: theme.isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEE2E2' },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>
                    متبقي {item.stock_quantity} فقط
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Title, Price, Description */}
          <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.basePrice, { color: theme.text }]}>
              {formatCurrency(item.price)}
            </Text>
            {unitLabel ? (
              <Text style={[styles.unitLabel, { color: theme.textSecondary }]}>{unitLabel}</Text>
            ) : null}
          </View>

          {item.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {item.description}
            </Text>
          ) : null}

          {/* Validation Notice */}
          {validationError ? (
            <View style={[styles.validationBanner, { backgroundColor: theme.errorLight }]}>
              <AlertCircle size={16} color={theme.error} />
              <Text style={[styles.validationText, { color: theme.error }]}>{validationError}</Text>
            </View>
          ) : null}

          {/* Modifier Groups */}
          {modifierGroups.length > 0 ? (
            <View style={styles.modifiersSection}>
              {modifierGroups.map((group) => {
                const isReq = group.is_required || group.min_selections > 0;
                const isSingle = group.max_selections === 1;
                const selectedIds = selectedByGroup[group.id] || [];
                const hintText = isSingle
                  ? 'اختر 1'
                  : group.max_selections > 1
                  ? group.min_selections > 0
                    ? `اختر من ${group.min_selections} إلى ${group.max_selections}`
                    : `اختر حتى ${group.max_selections}`
                  : 'اختر ما يناسبك';

                return (
                  <View
                    key={group.id}
                    style={[
                      styles.modifierGroupCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.borderSubtle,
                      },
                    ]}
                  >
                    <View style={styles.groupHeader}>
                      <View style={styles.groupTitleWrap}>
                        <Text style={[styles.groupTitle, { color: theme.text }]}>{group.name}</Text>
                        <Text style={[styles.groupHint, { color: theme.textSecondary }]}>
                          {hintText}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.reqBadge,
                          {
                            backgroundColor: isReq ? theme.primaryLight : theme.surfaceSecondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reqBadgeText,
                            { color: isReq ? theme.primary : theme.textSecondary },
                          ]}
                        >
                          {isReq ? 'إلزامي' : 'اختياري'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modifiersList}>
                      {group.modifiers.map((mod, idx) => {
                        const isSelected = selectedIds.includes(mod.id);
                        const disabled = !mod.is_available;
                        return (
                          <TouchableOpacity
                            key={mod.id}
                            disabled={disabled}
                            onPress={() => handleSelectModifier(group, mod)}
                            activeOpacity={0.75}
                            style={[
                              styles.modifierRow,
                              idx < group.modifiers.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: theme.borderSubtle,
                              },
                              disabled && { opacity: 0.45 },
                            ]}
                          >
                            <View style={styles.modifierLeft}>
                              <View
                                style={[
                                  isSingle ? styles.radioOuter : styles.checkboxOuter,
                                  {
                                    borderColor: isSelected ? theme.primary : theme.textMuted,
                                    backgroundColor: isSelected
                                      ? isSingle
                                        ? 'transparent'
                                        : theme.primary
                                      : 'transparent',
                                  },
                                ]}
                              >
                                {isSelected && isSingle ? (
                                  <View
                                    style={[styles.radioInner, { backgroundColor: theme.primary }]}
                                  />
                                ) : isSelected ? (
                                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                                ) : null}
                              </View>
                              <Text style={[styles.modifierName, { color: theme.text }]}>
                                {mod.name}
                              </Text>
                            </View>

                            {disabled ? (
                              <Text style={[styles.unavailableMod, { color: theme.textMuted }]}>
                                غير متوفر
                              </Text>
                            ) : mod.price_delta > 0 ? (
                              <Text style={[styles.modifierDelta, { color: theme.textSecondary }]}>
                                +{formatCurrency(mod.price_delta)}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.borderSubtle,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        {/* Quantity Stepper */}
        <View style={[styles.qtyStepper, { backgroundColor: theme.surfaceSecondary }]}>
          <TouchableOpacity
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isOutOfStock}
            style={[styles.qtyBtn, quantity <= 1 && { opacity: 0.4 }]}
            activeOpacity={0.75}
          >
            <Minus size={18} color={theme.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={[styles.qtyValue, { color: theme.text }]}>{quantity}</Text>
          <TouchableOpacity
            onPress={() => {
              if (!isMaxStockReached) setQuantity((q) => q + 1);
            }}
            disabled={isMaxStockReached || isOutOfStock}
            style={[styles.qtyBtn, isMaxStockReached && { opacity: 0.4 }]}
            activeOpacity={0.75}
          >
            <Plus size={18} color={theme.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Add to Cart Button */}
        <TouchableOpacity
          onPress={handleAddToCartPress}
          disabled={isOutOfStock}
          activeOpacity={0.88}
          style={[
            styles.addCartBtn,
            {
              backgroundColor: isOutOfStock
                ? theme.surfaceSecondary
                : missingRequiredGroups.length > 0
                ? theme.primaryDark
                : theme.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.addCartBtnText,
              isOutOfStock && { color: theme.textSecondary },
            ]}
          >
            {isOutOfStock ? 'نفدت الكمية' : 'أضف للسلة'}
          </Text>
          {!isOutOfStock ? (
            <Text style={styles.addCartTotalText}>{formatCurrency(totalPrice)}</Text>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    marginTop: 14,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13.5,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  backTextBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  backTextBtnLabel: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  heroContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  storeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    marginBottom: 14,
  },
  storeBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  storeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeTextWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  storeNameText: {
    fontSize: 13.5,
    fontFamily: 'Tajawal_700Bold',
  },
  categoryNameText: {
    fontSize: 11.5,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontFamily: 'Tajawal_700Bold',
  },
  itemName: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'left',
    lineHeight: 30,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 12,
  },
  basePrice: {
    fontSize: 19,
    fontFamily: 'Tajawal_700Bold',
  },
  unitLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  description: {
    fontSize: 14.5,
    fontFamily: 'Tajawal_400Regular',
    lineHeight: 23,
    textAlign: 'left',
    marginBottom: 18,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  validationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'left',
  },
  modifiersSection: {
    gap: 14,
  },
  modifierGroupCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupTitleWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  groupTitle: {
    fontSize: 15.5,
    fontFamily: 'Tajawal_700Bold',
  },
  groupHint: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
  },
  reqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reqBadgeText: {
    fontSize: 11.5,
    fontFamily: 'Tajawal_700Bold',
  },
  modifiersList: {
    marginTop: 2,
  },
  modifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  modifierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modifierName: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
  },
  modifierDelta: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  unavailableMod: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 6,
    height: 50,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    minWidth: 28,
    textAlign: 'center',
  },
  addCartBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  addCartBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontFamily: 'Tajawal_700Bold',
  },
  addCartTotalText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontFamily: 'Tajawal_700Bold',
  },
});
