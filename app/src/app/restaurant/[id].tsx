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
  BackendMenuCategory,
} from '../../services/restaurantService';
import { FoodItemCard } from '../../components/FoodItemCard';
import { ArrowLeft, Star, Clock, Bike, Search, X, MapPin, ShieldCheck, PhoneCall } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { Colors } from '../../constants/theme';
import { InfoCircleSvg } from '../../components/DiscoveryIcons';

interface CategoryWithItems {
  id: string;
  name: string;
  items: FoodItem[];
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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
          });
        }

        if (isMounted && menuRes.data) {
          const parsedCategories: CategoryWithItems[] = menuRes.data.map(
            (cat: BackendMenuCategory) => ({
              id: cat.id,
              name: cat.name,
              items: (cat.items || []).map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                price: Number(item.base_price) || 0,
                image:
                  sanitizeImageUrl(item.image) ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
                restaurantId: String(id),
              })),
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
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.error}>المطعم غير متوفر أو غير نشط حالياً</Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
            <Text style={styles.backHomeText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
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
              style={styles.headerFloatingBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <ArrowLeft color="#1F2937" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerFloatingBtn}
              onPress={() => setShowInfoModal(true)}
              activeOpacity={0.8}
            >
              <InfoCircleSvg size={20} color="#1F2937" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Restaurant Info Card */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{restaurant?.name}</Text>
            {restaurant?.isBusy && (
              <View style={styles.busyBadge}>
                <Text style={styles.busyBadgeText}>مزدحم حالياً</Text>
              </View>
            )}
          </View>

          {restaurant?.description ? (
            <Text style={styles.descriptionText} numberOfLines={2}>
              {restaurant.description}
            </Text>
          ) : null}

          {/* Stats Badges */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Star size={15} color="#FFB800" fill="#FFB800" />
              <Text style={styles.statTextBold}>
                {restaurant?.rating?.toFixed(1) || '4.8'}
              </Text>
              {restaurant?.ratingCount ? (
                <Text style={styles.statSubText}>({restaurant.ratingCount})</Text>
              ) : null}
            </View>

            <View style={styles.statPill}>
              <Clock size={15} color="#0284C7" />
              <Text style={styles.statText}>{restaurant?.deliveryTime || '٢٥ دقيقة'}</Text>
            </View>

            <View style={styles.statPill}>
              <Bike size={15} color="#10B981" />
              <Text style={styles.statText}>
                {restaurant?.deliveryFee === 0
                  ? 'توصيل مجاني'
                  : `توصيل ${restaurant?.deliveryFee} ر.س`}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar Inside Menu */}
        <View style={styles.menuSearchWrapper}>
          <View style={styles.menuSearchBox}>
            <Search size={18} color="#9CA3AF" style={styles.menuSearchIcon} />
            <TextInput
              style={styles.menuSearchInput}
              placeholder="ابحث في قائمة طعام المطعم..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sticky/Scrollable Category Tabs */}
        {categories.length > 0 && (
          <View style={styles.categoryTabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContainer}
            >
              <TouchableOpacity
                style={[
                  styles.categoryTab,
                  selectedCategoryTab === 'all' && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategoryTab('all')}
              >
                <Text
                  style={[
                    styles.categoryTabText,
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
                    selectedCategoryTab === cat.id && styles.categoryTabActive,
                  ]}
                  onPress={() => setSelectedCategoryTab(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
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
              color={Colors.light.primary}
              style={{ marginVertical: 30 }}
            />
          ) : totalFilteredItemsCount === 0 ? (
            <View style={styles.emptyFilteredBox}>
              <Text style={styles.emptyFilterEmoji}>🍽️</Text>
              <Text style={styles.emptyMenuTitle}>لا توجد وجبات تطابق بحثك</Text>
              <Text style={styles.emptyMenuSub}>
                جرّب البحث باسم وجبة أخرى أو اختر تصنيفاً مختلفاً من القائمة أعلاه.
              </Text>
              {(searchQuery.length > 0 || selectedCategoryTab !== 'all') && (
                <TouchableOpacity
                  style={styles.resetSearchBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategoryTab('all');
                  }}
                >
                  <Text style={styles.resetSearchBtnText}>عرض كل القائمة</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredCategories.map((cat) => (
              <View key={cat.id} style={styles.categorySection}>
                <View style={styles.categorySectionHeader}>
                  <Text style={styles.categorySectionTitle}>{cat.name}</Text>
                  <Text style={styles.categorySectionCount}>({cat.items.length})</Text>
                </View>

                {cat.items.map((item) => (
                  <FoodItemCard key={item.id} item={item} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Checkout Button */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/(tabs)/carts')}
          activeOpacity={0.9}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
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
          <View style={styles.infoModalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#4B5563" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>معلومات المطعم</Text>
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
                <Text style={styles.modalRestaurantName}>{restaurant?.name}</Text>
                {restaurant?.description ? (
                  <Text style={styles.modalRestaurantDesc}>{restaurant.description}</Text>
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
                    <Text style={styles.modalInfoLabel}>ساعات العمل</Text>
                    <Text style={styles.modalInfoValue}>
                      يومياً: 09:00 ص - 02:00 ص (متاح الآن للتوصيل 🟢)
                    </Text>
                  </View>
                </View>

                {/* Delivery & Prep */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#ECFDF5' }]}>
                    <Bike size={20} color="#059669" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={styles.modalInfoLabel}>مدة التجهيز والتوصيل</Text>
                    <Text style={styles.modalInfoValue}>
                      متوسط {restaurant?.deliveryTime || '25 دقيقة'} • رسوم التوصيل:{' '}
                      {restaurant?.deliveryFee === 0
                        ? 'مجاني'
                        : `${restaurant?.deliveryFee} ر.س`}
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#FFF7ED' }]}>
                    <MapPin size={20} color="#EA580C" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={styles.modalInfoLabel}>الموقع والمسافة</Text>
                    <Text style={styles.modalInfoValue}>
                      فرع حي النخيل • يبعد حوالي{' '}
                      {restaurant?.distanceKm ? `${restaurant.distanceKm} كم` : '2.3 كم'} عنك
                    </Text>
                  </View>
                </View>

                {/* Hygiene & Quality Certificate */}
                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoIcon, { backgroundColor: '#FDF2F8' }]}>
                    <ShieldCheck size={20} color="#FF2E7E" />
                  </View>
                  <View style={styles.modalInfoContent}>
                    <Text style={styles.modalInfoLabel}>معايير الجودة والسلامة</Text>
                    <Text style={styles.modalInfoValue}>
                      معتمد ومطابق لاشتراطات سلامة الغذاء والتغليف الحراري الآمن 🛡️
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeModalActionBtn}
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    backgroundColor: Colors.light.primary,
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
    backgroundColor: Colors.light.primary,
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
    backgroundColor: Colors.light.primary,
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
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    shadowColor: Colors.light.primary,
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
    color: Colors.light.primary,
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    backgroundColor: Colors.light.primary,
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
});
