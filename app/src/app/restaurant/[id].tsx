import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Restaurant, FoodItem } from '../../types/models';
import {
  restaurantService,
  sanitizeImageUrl,
  mapBackendMenuItemToFoodItem,
  BackendMenuCategory,
} from '../../services/restaurantService';
import { FoodItemCard } from '../../components/FoodItemCard';
import { ArrowLeft, Star, Clock, Bike, Search, X, MapPin, ShieldCheck, PhoneCall, UtensilsCrossed, Store } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../../hooks/use-theme';
import { CURRENCY } from '../../constants/config';
import { InfoCircleSvg } from '../../components/DiscoveryIcons';

interface CategoryWithItems {
  id: string;
  name: string;
  items: FoodItem[];
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cartItems = useCartStore((state) => state.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [detailRes, menuRes] = await Promise.all([
          restaurantService.getRestaurantDetail(id),
          restaurantService.getRestaurantMenu(id),
        ]);

        if (isMounted && detailRes.data) {
          const r = detailRes.data;
          setRestaurant({
            id: r.id,
            name: r.name,
            description: r.description,
            rating: Number(r.rating) || 0,
            ratingCount: r.rating_count,
            deliveryTime: `${r.estimated_prep_time_minutes || 25} دقيقة`,
            deliveryFee: Number(r.delivery_fee) || 0,
            image:
              sanitizeImageUrl(r.cover_image) ||
              sanitizeImageUrl(r.logo) ||
              'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
            isBusy: r.is_busy,
            distanceKm: r.distance_km,
            store_type: (r.store_type as any) || 'RESTAURANT',
            delivery_mode: r.delivery_mode,
          });
        }

        if (isMounted && menuRes.data) {
          const parsedCategories: CategoryWithItems[] = menuRes.data.map(
            (cat: BackendMenuCategory) => ({
              id: cat.id,
              name: cat.name,
              items: (cat.items || []).map((item) =>
                mapBackendMenuItemToFoodItem(item, String(id), detailRes.data?.name)
              ),
            })
          );
          setCategories(parsedCategories);
        }
      } catch {
        // Leave restaurant null → error screen will show
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // All flattened items
  const allMenuItems = useMemo(() => {
    return categories.flatMap((c) => c.items);
  }, [categories]);

  // Filtered categories & items
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        // Tab filtering
        if (selectedCategoryTab !== 'all' && cat.id !== selectedCategoryTab) {
          return null;
        }

        // Search filtering
        const matchingItems = cat.items.filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
          );
        });

        if (matchingItems.length === 0) return null;

        return {
          ...cat,
          items: matchingItems,
        };
      })
      .filter(Boolean) as CategoryWithItems[];
  }, [categories, selectedCategoryTab, searchQuery]);

  const totalFilteredItemsCount = useMemo(() => {
    return filteredCategories.reduce((sum, c) => sum + c.items.length, 0);
  }, [filteredCategories]);

  if (!restaurant && !isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
            <Store size={40} color={theme.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={[styles.error, { color: theme.text }]}>المتجر غير متوفر أو غير نشط حالياً</Text>
          <TouchableOpacity style={[styles.backHomeBtn, { backgroundColor: theme.primary }]} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Text style={styles.backHomeText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Cover Image & Header Controls */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                restaurant?.image ||
                'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
            }}
            style={styles.coverImage}
          />
          <View style={styles.imageGradientOverlay} />

          {/* Floating Top Bar (Back & Info) */}
          <SafeAreaView edges={['top']} style={styles.floatingHeaderBar}>
            <TouchableOpacity
              style={[styles.headerFloatingBtn, { backgroundColor: theme.card }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              activeOpacity={0.8}
            >
              <ArrowLeft color={theme.text} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerFloatingBtn, { backgroundColor: theme.card }]}
              onPress={() => setShowInfoModal(true)}
              activeOpacity={0.8}
            >
              <InfoCircleSvg size={20} color={theme.text} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Restaurant Info Card */}
        <View style={[styles.infoContainer, { backgroundColor: theme.card }]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text }]}>{restaurant?.name}</Text>
            {restaurant?.isBusy && (
              <View style={styles.busyBadge}>
                <Text style={styles.busyBadgeText}>مزدحم حالياً</Text>
              </View>
            )}
          </View>

          {restaurant?.description ? (
            <Text style={[styles.descriptionText, { color: theme.textSecondary }]} numberOfLines={2}>
              {restaurant.description}
            </Text>
          ) : null}

          {/* Stats Badges */}
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: theme.surfaceSecondary }]}>
              <Star size={15} color="#FFB800" fill="#FFB800" />
              <Text style={[styles.statTextBold, { color: theme.text }]}>
                {restaurant?.rating?.toFixed(1) || '4.8'}
              </Text>
              {restaurant?.ratingCount ? (
                <Text style={[styles.statSubText, { color: theme.textMuted }]}>({restaurant.ratingCount})</Text>
              ) : null}
            </View>

            <View style={[styles.statPill, { backgroundColor: theme.surfaceSecondary }]}>
              <Clock size={15} color="#0284C7" />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>{restaurant?.deliveryTime || '٢٥ دقيقة'}</Text>
            </View>

            <View style={[styles.statPill, { backgroundColor: theme.surfaceSecondary }]}>
              <Bike size={15} color="#10B981" />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {restaurant?.deliveryFee === 0
                  ? 'توصيل مجاني'
                  : `توصيل ${restaurant?.deliveryFee} ${CURRENCY}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar Inside Menu */}
        <View style={[styles.menuSearchWrapper, { backgroundColor: theme.card }]}>
          <View style={[styles.menuSearchBox, { backgroundColor: theme.surfaceSecondary }]}>
            <Search size={18} color={theme.textMuted} style={styles.menuSearchIcon} />
            <TextInput
              style={[styles.menuSearchInput, { color: theme.text }]}
              placeholder="ابحث في قائمة المنتجات والأصناف..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sticky/Scrollable Category Tabs */}
        {categories.length > 0 && (
          <View style={[styles.categoryTabsWrapper, { backgroundColor: theme.card }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContainer}
            >
              <TouchableOpacity
                style={[
                  styles.categoryTab,
                  { backgroundColor: theme.surfaceSecondary },
                  selectedCategoryTab === 'all' && { backgroundColor: theme.primary },
                ]}
                onPress={() => setSelectedCategoryTab('all')}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: theme.textSecondary },
                    selectedCategoryTab === 'all' && styles.categoryTabTextActive,
                  ]}
                >
                  الكل ({allMenuItems.length})
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryTab,
                    { backgroundColor: theme.surfaceSecondary },
                    selectedCategoryTab === cat.id && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setSelectedCategoryTab(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      { color: theme.textSecondary },
                      selectedCategoryTab === cat.id && styles.categoryTabTextActive,
                    ]}
                  >
                    {cat.name} ({cat.items.length})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Menu Section */}
        <View style={styles.menuContainer}>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={{ marginVertical: 30 }}
            />
          ) : totalFilteredItemsCount === 0 ? (
            <View style={styles.emptyFilteredBox}>
              <View style={[styles.emptyFilterIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
                <UtensilsCrossed size={36} color={theme.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyMenuTitle, { color: theme.text }]}>لا توجد منتجات تطابق بحثك</Text>
              <Text style={[styles.emptyMenuSub, { color: theme.textSecondary }]}>
                جرّب البحث باسم منتج آخر أو اختر قسماً مختلفاً من القائمة أعلاه.
              </Text>
              {(searchQuery.length > 0 || selectedCategoryTab !== 'all') && (
                <TouchableOpacity
                  style={[styles.resetSearchBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategoryTab('all');
                  }}
                >
                  <Text style={styles.resetSearchBtnText}>عرض كافة المنتجات</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCategories.map((cat) => (
              <View key={cat.id} style={styles.categorySection}>
                <View style={[styles.categorySectionHeader, { backgroundColor: theme.surfaceSecondary }]}>
                  <Text style={[styles.categorySectionTitle, { color: theme.text }]}>{cat.name}</Text>
                  <Text style={[styles.categorySectionCount, { color: theme.textMuted }]}>({cat.items.length})</Text>
                </View>

                {cat.items.map((item) => (
                  <FoodItemCard key={item.id} item={item} showRestaurantLink={false} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Checkout Button */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={() => router.push('/(tabs)/carts')}
          activeOpacity={0.9}
        >
          <View style={[styles.cartBadge, { backgroundColor: theme.card }]}>
            <Text style={[styles.cartBadgeText, { color: theme.primary }]}>{totalItems}</Text>
          </View>
          <Text style={styles.checkoutText}>عرض السلة</Text>
        </TouchableOpacity>
      )}

      {/* Restaurant Info & Policies Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModalCard, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceSecondary }]}
              >
                <X size={20} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>معلومات المتجر</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Restaurant Headline */}
              <View style={styles.modalRestaurantHead}>
                <Image
                  source={{
                    uri:
                      restaurant?.image ||
                      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
                  }}
                  style={styles.modalLogo}
                />
                <Text style={[styles.modalRestaurantName, { color: theme.text }]}>{restaurant?.name}</Text>
                {restaurant?.description ? (
                  <Text style={[styles.modalRestaurantDesc, { color: theme.textSecondary }]}>{restaurant.description}</Text>
                ) : null}
              </View>

              {/* Info Items List */}
              <View style={styles.modalInfoList}>
                {/* Working Hours */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Clock size={20} color="#2563EB" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={[styles.modalInfoLabel, { color: theme.textMuted }]}>ساعات العمل</Text>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                      <Text style={[styles.modalInfoValue, { color: theme.text }]}>
                        يومياً: 09:00 ص - 02:00 ص (متاح الآن للتوصيل)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Delivery & Prep */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#ECFDF5' }]}>
                    <Bike size={20} color="#059669" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={[styles.modalInfoLabel, { color: theme.textMuted }]}>مدة التجهيز والتوصيل</Text>
                    <Text style={[styles.modalInfoValue, { color: theme.text }]}>
                      متوسط {restaurant?.deliveryTime || '25 دقيقة'} • رسوم التوصيل:{' '}
                      {restaurant?.deliveryFee === 0
                        ? 'مجاني'
                        : `${restaurant?.deliveryFee} ${CURRENCY}`}
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#FFF7ED' }]}>
                    <MapPin size={20} color="#EA580C" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={[styles.modalInfoLabel, { color: theme.textMuted }]}>الموقع والمسافة</Text>
                    <Text style={[styles.modalInfoValue, { color: theme.text }]}>
                      فرع حي النخيل • يبعد حوالي{' '}
                      {restaurant?.distanceKm ? `${restaurant.distanceKm} كم` : '2.3 كم'} عنك
                    </Text>
                  </View>
                </View>

                {/* Hygiene & Quality Certificate */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: theme.primaryLight }]}>
                    <ShieldCheck size={20} color={theme.primary} />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={[styles.modalInfoLabel, { color: theme.textMuted }]}>معايير الجودة والسلامة</Text>
                    <Text style={[styles.modalInfoValue, { color: theme.text }]}>
                      معتمد ومطابق لاشتراطات سلامة الغذاء والتغليف الحراري الآمن
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.closeModalActionBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowInfoModal(false)}
              >
                <Text style={styles.closeModalActionText}>إغلاق</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 110 },
  imageContainer: { position: 'relative' },
  coverImage: { width: '100%', height: 240 },
  imageGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  floatingHeaderBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerFloatingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
  },
  nameRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
  },
  busyBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  busyBadgeText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#DC2626',
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F9FAFB',
    borderWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statTextBold: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  statSubText: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  menuSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  menuSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  menuSearchIcon: {
    marginRight: 8,
  },
  menuSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#1F2937',
    textAlign: 'right',
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryTabsWrapper: {
    borderBottomWidth: 0,
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
  },
  categoryTabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row-reverse',
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  categoryTabActive: {
    backgroundColor: '#D70F64',
  },
  categoryTabText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#4B5563',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  menuContainer: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 16,
  },
  categorySectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    gap: 6,
  },
  categorySectionTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  categorySectionCount: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#9CA3AF',
  },
  emptyFilteredBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyFilterEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyMenuTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
    marginBottom: 6,
  },
  emptyMenuSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  resetSearchBtn: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  error: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  backHomeBtn: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backHomeText: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
  },
  checkoutBtn: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#D70F64',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  cartBadge: {
    position: 'absolute',
    left: 20,
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#D70F64',
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  infoModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  modalRestaurantHead: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0,
  },
  modalLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  modalRestaurantName: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalRestaurantDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  modalInfoList: {
    paddingVertical: 16,
    gap: 16,
  },
  modalInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  modalInfoIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInfoContent: {
    flex: 1,
  },
  modalInfoLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#9CA3AF',
    textAlign: 'right',
  },
  modalInfoValue: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    textAlign: 'right',
    marginTop: 2,
  },
  closeModalActionBtn: {
    backgroundColor: '#D70F64',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  closeModalActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyFilterIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});
