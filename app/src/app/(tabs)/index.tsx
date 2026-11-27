import React, { useRef, useState, useMemo } from 'react'; 
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationService } from '../../services/notificationService';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { FoodItemCard } from '../../components/FoodItemCard';
import { restaurantService, mapBackendRestaurantToModel, mapBackendMenuItemToFoodItem, BackendStoreSector } from '../../services/restaurantService';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, MapPin, Search, RotateCcw, Sparkles, Bike } from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { Restaurant, FoodCategory, FoodItem } from '../../types/models';
import { SECTORS, SectorKey } from '../../constants/sectors';
import { useAuthStore } from '../../store/authStore';
import { useAddressStore } from '../../store/addressStore';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';
import { MandatoryAddressGate } from '../../components/MandatoryAddressGate';
import { orderService, OrderResponse } from '../../services/orderService';
import { NotificationBellSvg } from '../../components/DiscoveryIcons';

const CATEGORY_TO_SECTOR: Record<string, SectorKey> = {
  all_1: 'RESTAURANT',
  all_2: 'SUPERMARKET',
  all_3: 'PHARMACY',
  all_4: 'BUTCHERY_VEG',
  all_5: 'FLOWERS_GIFTS',
  all_6: 'GENERAL_RETAIL',
};

const STATIC_CATEGORIES: FoodCategory[] = [
  { id: '1', name: 'بيتزا', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=300&auto=format&fit=crop' },
  { id: '2', name: 'برجر', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop' },
  { id: '3', name: 'سوشي', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=300&auto=format&fit=crop' },
  { id: '4', name: 'صحي', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=300&auto=format&fit=crop' },
  { id: '5', name: 'قهوة', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=300&auto=format&fit=crop' },
  { id: '6', name: 'حلويات', image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=300&auto=format&fit=crop' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [dynamicSectors, setDynamicSectors] = useState<BackendStoreSector[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(true);
  const [restaurantList, setRestaurantList] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [quickProducts, setQuickProducts] = useState<FoodItem[]>([]);

  const currentSectorDef = (SECTORS[selectedSector as SectorKey] || SECTORS.ALL);

  const sectorFilterCategories = useMemo(() => {
    return dynamicSectors.map((sec) => ({
      id: sec.code,
      name: sec.short_title || sec.name,
      image: sec.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&q=80',
      searchPlaceholder: sec.search_placeholder,
    }));
  }, [dynamicSectors]);

  const activePlaceholder = useMemo(() => {
    const matched = sectorFilterCategories.find((c) => c.id === selectedSector);
    return matched?.searchPlaceholder || currentSectorDef.searchPlaceholder;
  }, [sectorFilterCategories, selectedSector, currentSectorDef]);

  const { isAuthenticated } = useAuthStore();
  const { selectedAddress, fetchAddresses, isInitialized: addressInitialized } = useAddressStore();

  React.useEffect(() => {
    // Safely load saved address (guest local or user backend)
    fetchAddresses();

    // Load dynamic sectors configured in Django Admin
    setSectorsLoading(true);
    restaurantService.getSectors().then((res) => {
      if (res.data?.sectors) {
        setDynamicSectors(res.data.sectors);
      } else {
        setDynamicSectors([]);
      }
    }).catch(() => {
      setDynamicSectors([]);
    }).finally(() => {
      setSectorsLoading(false);
    });

    // Authenticated-only network requests (prevents 401s for guest browsing)
    if (isAuthenticated) {
      // Check notifications unread count
      notificationService.getNotifications().then((res) => {
        if (res.data) {
          setUnreadNotificationsCount(res.data.unread_count || 0);
        }
      }).catch(() => {});

      const checkActiveOrder = async () => {
        try {
          const res = await orderService.getOrderHistory();
          if (res.data && res.data.length > 0) {
            const ongoing = res.data.find(
              (o) =>
                o.status === 'PENDING' ||
                o.status === 'CONFIRMED' ||
                o.status === 'PREPARING' ||
                o.status === 'READY_FOR_PICKUP' ||
                o.status === 'ON_THE_WAY'
            );
            if (ongoing) {
              setActiveOrder(ongoing);
            }
          }
        } catch {}
      };
      checkActiveOrder();
    } else {
      setUnreadNotificationsCount(0);
      setActiveOrder(null);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchRestaurants = async () => {
      if (
        !addressInitialized ||
        !selectedAddress ||
        selectedAddress.latitude === undefined ||
        selectedAddress.longitude === undefined
      ) {
        if (isMounted) {
          setRestaurantList([]);
          setQuickProducts([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const params: {
          store_type?: string;
          latitude?: number;
          longitude?: number;
          lat?: number;
          lng?: number;
        } = {
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude,
          lat: selectedAddress.latitude,
          lng: selectedAddress.longitude,
        };

        if (selectedSector !== 'ALL') {
          params.store_type = selectedSector;
        }

        const [res, searchRes] = await Promise.all([
          restaurantService.getRestaurants(params),
          restaurantService.searchUniversal('', {
            store_type: selectedSector === 'ALL' ? undefined : selectedSector,
            lat: params.lat,
            lng: params.lng,
          }),
        ]);
        if (isMounted && res.data) {
          const mapped: Restaurant[] = res.data.map(mapBackendRestaurantToModel);
          setRestaurantList(mapped);
        }
        if (isMounted && searchRes.data) {
          const rawProducts = searchRes.data.products || searchRes.data.items || [];
          const mappedQuick: FoodItem[] = rawProducts
            .filter((p) => p.id && p.restaurant_id && p.is_available !== false)
            .slice(0, 3)
            .map((p) => mapBackendMenuItemToFoodItem(p, p.restaurant_id, p.restaurant_name));
          setQuickProducts(mappedQuick);
        }
      } catch {
        // Backend unavailable — list stays empty, user sees empty state
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchRestaurants();
    return () => {
      isMounted = false;
    };
  }, [selectedSector, addressInitialized, selectedAddress?.latitude, selectedAddress?.longitude]);

  // Filtered restaurants computation
  const filteredRestaurants = useMemo(() => {
    let list = [...restaurantList];

    // Filter by store_type (client-side safety check alongside backend query)
    if (selectedSector !== 'ALL') {
      list = list.filter((r) => (r.store_type || 'RESTAURANT') === selectedSector);
    }

    return list;
  }, [restaurantList, selectedSector]);

  const hasActiveFilters = selectedSector !== 'ALL';

  const resetAllFilters = () => {
    setSelectedSector('ALL');
  };

  // Animation value for scrolling
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animate opacity of promo text and location based on scroll position
  const promoOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (!addressInitialized) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!selectedAddress) {
    return <MandatoryAddressGate />;
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? (theme.isDark ? theme.background : '#F3F4F6') : theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]} // Make SearchBar sticky!
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false } // useNativeDriver: false is safer for web sticky headers
        )}
        scrollEventThrottle={16}
      >
        
        {/* 0. Top Bar (Location + Active Order Tracker) */}
        <Animated.View style={{ opacity: promoOpacity }}>
          <View style={[styles.locationRow, { backgroundColor: theme.background }]}>
            <TouchableOpacity
              style={styles.locationContainer}
              onPress={() => setShowAddressModal(true)}
              activeOpacity={0.8}
            >
              <MapPin size={20} color={theme.primary} strokeWidth={2.2} />
              <Text style={[styles.locationTitle, { color: theme.text }]} numberOfLines={1}>
                {selectedAddress
                  ? `${selectedAddress.title} - ${selectedAddress.street}`
                  : 'حدد موقع التوصيل'}
              </Text>
              <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} style={{ marginRight: 2 }} />
            </TouchableOpacity>

            <View style={styles.headerIconsRow}>
              <TouchableOpacity
                onPress={() => router.push('/notifications' as any)}
                activeOpacity={0.7}
                style={[
                  styles.headerIconBtn,
                  { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F9FAFB' },
                ]}
              >
                <NotificationBellSvg size={20} color={theme.text} hasUnread={unreadNotificationsCount > 0} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Order Live Tracker Banner */}
          {activeOrder && (
            <TouchableOpacity
              style={[styles.activeOrderBanner, { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#FFF1F5' }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/order/${activeOrder.id}` as any)}
            >
              <View style={styles.activeOrderRight}>
                <View style={[styles.activeOrderPulse, { backgroundColor: theme.primary }]} />
                <View>
                  <Text style={[styles.activeOrderTitle, { color: theme.text }]}>
                    طلب نشط #{activeOrder.order_number} • {activeOrder.restaurant_name}
                  </Text>
                  <Text style={[styles.activeOrderSub, { color: theme.primary }]}>
                    الحالة: {activeOrder.status_display || activeOrder.status} • تتبع مسار الكابتن
                  </Text>
                </View>
              </View>
              <View style={[styles.activeOrderIconBox, { backgroundColor: theme.card }]}>
                <Bike size={20} color={theme.primary} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* 1. Sticky Soft Floating Pill Search Bar */}
        <View style={[styles.searchWrapper, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[
              styles.searchContainer,
              {
                backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC',
              },
            ]}
            onPress={() =>
              router.push(
                selectedSector !== 'ALL'
                  ? ({ pathname: '/search', params: { sector: selectedSector } } as any)
                  : '/search'
              )
            }
            activeOpacity={0.88}
          >
            <Search size={20} color={theme.primary} style={styles.searchIcon} strokeWidth={2} />
            <Text style={[styles.searchPlaceholderText, { color: theme.textSecondary }]}>
              {activePlaceholder}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Fluid Body Content */}
        <View style={[styles.bodyContainer, { backgroundColor: theme.background }]}>

          {/* Dynamic Store Categories / Sectors Filter Row */}
          {sectorFilterCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {sectorFilterCategories.map((cat, index) => {
                const isSelected = selectedSector === cat.id;
                return (
                  <CategoryItem
                    key={cat.id}
                    category={{ id: cat.id, name: cat.name, image: cat.image }}
                    isSelected={isSelected}
                    onPress={() => setSelectedSector(isSelected ? 'ALL' : cat.id)}
                    index={index}
                  />
                );
              })}
            </ScrollView>
          )}
          {!sectorsLoading && sectorFilterCategories.length === 0 && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'right' }}>
                لا توجد أقسام
              </Text>
            </View>
          )}

          {/* Active Filter Bar if filtered */}
          {hasActiveFilters && (
            <View style={styles.activeFilterNotice}>
              <TouchableOpacity onPress={resetAllFilters} style={styles.resetFilterBtn}>
                <RotateCcw size={14} color="#EF4444" />
                <Text style={styles.resetFilterText}>إلغاء الفلاتر</Text>
              </TouchableOpacity>
              <Text style={styles.activeFilterCountText}>
                تم العثور على ({filteredRestaurants.length}) {currentSectorDef.storeUnit}
              </Text>
            </View>
          )}

          {/* Section: Popular Stores */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{currentSectorDef.popularTitle}</Text>
            <View style={styles.chevronBtn}>
              <ChevronLeft size={20} color={theme.text} />
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : filteredRestaurants.length === 0 ? (
            <View style={styles.noFilterResultsBox}>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? currentSectorDef.emptyMessage
                  : selectedSector === 'ALL'
                  ? 'لا توجد متاجر متاحة في منطقتك حالياً'
                  : currentSectorDef.emptyMessage}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.resetFilterPill} onPress={resetAllFilters}>
                  <Text style={styles.resetFilterPillText}>
                    عرض جميع {currentSectorDef.storeUnit === 'مطعم' ? 'المطاعم' : 'المتاجر'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resetFilterPill} onPress={() => setShowAddressModal(true)}>
                  <Text style={styles.resetFilterPillText}>تغيير العنوان</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {filteredRestaurants.slice(0, 3).map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} horizontal index={index} />
              ))}
            </ScrollView>
          )}

          {/* Section: All / Local Favorite Stores */}
          {(isLoading || filteredRestaurants.length > 0) && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{currentSectorDef.localTitle}</Text>
                <TouchableOpacity style={styles.chevronBtn}>
                  <ChevronLeft size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              {isLoading ? null : (
                <View style={{ paddingHorizontal: 16 }}>
                  {filteredRestaurants.map((restaurant, index) => (
                    <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Section: Available Products in Zone (after Stores) */}
          {quickProducts.length > 0 && (
            <View style={styles.quickAddSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWithIcon}>
                  <Sparkles size={20} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {selectedSector === 'SUPERMARKET'
                      ? 'مقاضي سريعة الإضافة'
                      : selectedSector === 'PHARMACY'
                      ? 'مستلزمات طبية سريعة الإضافة'
                      : selectedSector === 'BUTCHERY_VEG'
                      ? 'طازج وسريع الإضافة'
                      : selectedSector === 'FLOWERS_GIFTS'
                      ? 'هدايا وباقات سريعة الإضافة'
                      : selectedSector === 'GENERAL_RETAIL'
                      ? 'منتجات تجزئة سريعة الإضافة'
                      : 'منتجات متوفرة في منطقتك'}
                  </Text>
                </View>
              </View>
              <View style={{ marginBottom: 14 }}>
                {quickProducts.map((item) => (
                  <FoodItemCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          )}

        </View>
      </Animated.ScrollView>
      </View>

      {/* Address Selector Bottom Sheet */}
      <AddressSelectorModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF', 
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  locationTitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  searchWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 10, // Ensure sticky header stays above body
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 18,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchPlaceholderText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
    textAlign: 'right',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  bodyContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 32,
    marginTop: 0,
    zIndex: 2,
  },
  categoriesList: {
    flexGrow: 0,
    marginBottom: 14,
  },
  bannersList: {
    marginBottom: 12,
  },
  bannerCard: {
    width: 280,
    height: 140,
    borderRadius: 20,
    marginRight: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 4,
  },
  bannerBadge: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  couponsSectionContainer: {
    marginBottom: 34,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewAllCouponsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllCouponsText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#D70F64',
  },
  homeCouponCard: {
    width: 230,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  couponCodePill: {
    backgroundColor: '#FCE7F3',
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  couponCodeText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 13,
    color: '#D70F64',
    letterSpacing: 0.5,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  copyPillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#D70F64',
  },
  copiedPillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#15803D',
  },
  homeCouponDiscountText: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  homeCouponSubtext: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
  },
  chevronBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 16,
  },
  activeOrderBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF1F5',
    borderWidth: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  activeOrderRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activeOrderPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D70F64',
  },
  activeOrderTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  activeOrderSub: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#D70F64',
    marginTop: 2,
  },
  activeOrderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterNotice: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF1F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 0,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetFilterText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#EF4444',
  },
  activeFilterCountText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#991B1B',
  },
  noFilterResultsBox: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  resetFilterPill: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  resetFilterPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  quickAddSection: {
    marginBottom: 28,
  },
  bannerDotsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 28,
  },
  bannerDot: {
    height: 5,
    borderRadius: 3,
  },
  bannerDotActive: {
    width: 16,
  },
  bannerDotInactive: {
    width: 6,
  },
});
