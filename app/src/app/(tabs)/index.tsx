import React, { useRef, useState, useMemo } from 'react'; 
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Animated, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { restaurantService, sanitizeImageUrl } from '../../services/restaurantService';
import { useCartStore } from '../../store/cartStore';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, X, Clock, MapPin, Heart, Search, RotateCcw } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { Restaurant, FoodCategory } from '../../types/models';
import { useAddressStore } from '../../store/addressStore';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';
import { orderService, OrderResponse } from '../../services/orderService';
import {
  RatingFilterSvg,
  FastDeliverySvg,
  FreeDeliverySvg,
  OpenNowSvg,
  NotificationBellSvg,
} from '../../components/DiscoveryIcons';
import NotificationCenterModal from '../../components/NotificationCenterModal';

const STATIC_CATEGORIES: FoodCategory[] = [
  { id: '1', name: 'بيتزا', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=300&auto=format&fit=crop' },
  { id: '2', name: 'برجر', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop' },
  { id: '3', name: 'سوشي', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=300&auto=format&fit=crop' },
  { id: '4', name: 'صحي', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=300&auto=format&fit=crop' },
  { id: '5', name: 'قهوة', image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=300&auto=format&fit=crop' },
  { id: '6', name: 'حلويات', image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=300&auto=format&fit=crop' },
];

const banners = [
  { id: '1', title: 'خصم ١٠ ر.م', subtitle: 'كود FOX10', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2940&auto=format&fit=crop' },
  { id: '2', title: 'سلسلة المشروبات', subtitle: 'ابتداءً من ٩.٩٠ ر.م', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop' },
];

const services = [
  { id: 'offers', title: 'عروض', image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=200&auto=format&fit=crop' },
  { id: 'mart', title: 'فوكس مارت', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop' },
  { id: 'bakery', title: 'مخبز الثعلب', image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=200&auto=format&fit=crop' },
  { id: 'healthy', title: 'صحة وجمال', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=200&auto=format&fit=crop' },
  { id: 'new', title: 'جديد', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200&auto=format&fit=crop' }
];

export type DiscoveryFilterType = 'all' | 'top_rated' | 'fast_delivery' | 'free_delivery' | 'open_now';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DiscoveryFilterType>('all');
  const [showPromo, setShowPromo] = useState(true);
  const [restaurantList, setRestaurantList] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);

  const { selectedAddress, fetchAddresses } = useAddressStore();

  React.useEffect(() => {
    fetchAddresses();

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
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const res = await restaurantService.getRestaurants();
        if (isMounted && res.data) {
          const mapped: Restaurant[] = res.data.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            rating: Number(r.rating) || 0,
            ratingCount: r.rating_count,
            deliveryTime: `${r.estimated_prep_time_minutes || 25} دقيقة`,
            deliveryFee: Number(r.delivery_fee) || 0,
            image: sanitizeImageUrl(r.cover_image) || sanitizeImageUrl(r.logo) || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
            isBusy: r.is_busy,
            distanceKm: r.distance_km,
          }));
          setRestaurantList(mapped);
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
  }, []);

  // Filtered restaurants computation
  const filteredRestaurants = useMemo(() => {
    let list = [...restaurantList];

    // Filter by selected cuisine/category
    if (selectedCategory) {
      const catObj = STATIC_CATEGORIES.find((c) => c.id === selectedCategory);
      if (catObj) {
        const catName = catObj.name.toLowerCase();
        list = list.filter(
          (r) =>
            (r.name && r.name.toLowerCase().includes(catName)) ||
            (r.description && r.description.toLowerCase().includes(catName))
        );
      }
    }

    // Filter by quick filter chips
    if (activeFilter === 'top_rated') {
      list = list.filter((r) => r.rating >= 4.3);
    } else if (activeFilter === 'fast_delivery') {
      list = list.filter((r) => {
        const minutes = parseInt(r.deliveryTime) || 30;
        return minutes <= 30;
      });
    } else if (activeFilter === 'free_delivery') {
      list = list.filter((r) => r.deliveryFee === 0);
    } else if (activeFilter === 'open_now') {
      list = list.filter((r) => !r.isBusy);
    }

    return list;
  }, [restaurantList, selectedCategory, activeFilter]);

  const hasActiveFilters = selectedCategory !== null || activeFilter !== 'all';

  const resetAllFilters = () => {
    setSelectedCategory(null);
    setActiveFilter('all');
  };

  const handleServicePress = (serviceId: string) => {
    switch (serviceId) {
      case 'offers':
        router.push('/vouchers');
        break;
      case 'mart':
        setActiveFilter('fast_delivery');
        break;
      case 'bakery':
        setSelectedCategory(selectedCategory === '6' ? null : '6');
        break;
      case 'healthy':
        setSelectedCategory(selectedCategory === '4' ? null : '4');
        break;
      case 'new':
        setActiveFilter('top_rated');
        break;
      default:
        break;
    }
  };

  // Animation value for scrolling
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animate opacity of promo text and location based on scroll position
  const promoOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.light.primary }}>
      <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]} // Make SearchBar sticky!
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false } // useNativeDriver: false is safer for web sticky headers
        )}
        scrollEventThrottle={16}
      >
        
        {/* 0. Location Row */}
        <Animated.View style={[styles.locationRow, { paddingTop: 16, opacity: promoOpacity }]}>
          <TouchableOpacity
            style={styles.locationContainer}
            onPress={() => setShowAddressModal(true)}
            activeOpacity={0.8}
          >
            <MapPin size={20} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.locationTitle} numberOfLines={1}>
              {selectedAddress
                ? `${selectedAddress.title} - ${selectedAddress.street}`
                : 'حدد موقع التوصيل 📍'}
            </Text>
            <ChevronDown size={15} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 2 }} />
          </TouchableOpacity>

          <View style={styles.headerIconsRow}>
            <TouchableOpacity
              onPress={() => setShowNotificationCenter(true)}
              activeOpacity={0.8}
              style={styles.headerIconBtn}
            >
              <NotificationBellSvg size={22} color="#FFFFFF" hasUnread={true} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/favorites')}
              activeOpacity={0.8}
              style={styles.headerIconBtn}
            >
              <Heart size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Active Order Live Tracker Banner */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.activeOrderBanner}
            activeOpacity={0.85}
            onPress={() => router.push(`/order/${activeOrder.id}` as any)}
          >
            <View style={styles.activeOrderRight}>
              <View style={styles.activeOrderPulse} />
              <View>
                <Text style={styles.activeOrderTitle}>
                  طلب نشط #{activeOrder.order_number} • {activeOrder.restaurant_name}
                </Text>
                <Text style={styles.activeOrderSub}>
                  الحالة: {activeOrder.status_display || activeOrder.status} • تتبع مسار الكابتن ➔
                </Text>
              </View>
            </View>
            <View style={styles.activeOrderIconBox}>
              <Text style={{ fontSize: 22 }}>🛵</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 1. Sticky Search Bar Container */}
        <View style={styles.searchWrapper}>
          <TouchableOpacity
            style={styles.searchContainer}
            onPress={() => router.push('/search')}
            activeOpacity={0.88}
          >
            <Search size={20} color="#FF2E7E" style={styles.searchIcon} />
            <Text style={styles.searchPlaceholderText}>ابحث عن المتاجر، المطاعم والوجبات...</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Promo Row */}
        <Animated.View style={[styles.promoContainer, { opacity: promoOpacity }]}>
          <Text style={styles.promoTextBold}>
            خصم ٤٠٪ على طلب الاستلام الأول
          </Text>
          <Text style={styles.promoTextBold}>
            الكود: NEWPICKUP
          </Text>
          <TouchableOpacity
            style={styles.pickupBtn}
            onPress={() => router.push('/vouchers')}
          >
            <Text style={styles.pickupText}>استلم الآن</Text>
            <ChevronLeft size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* 3. White Body Content */}
        <View style={styles.bodyContainer}>
          
          {/* Bottom sheet indicator */}
          <View style={styles.indicatorContainer}>
            <View style={styles.indicator} />
          </View>
          
          {/* Services Row */}
          <View style={styles.servicesRow}>
            {services.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.serviceItem}
                onPress={() => handleServicePress(item.id)}
                activeOpacity={0.75}
              >
                <View style={styles.serviceIconPlaceholder}>
                  <Image source={{ uri: item.image }} style={styles.serviceImage} />
                </View>
                <Text style={styles.serviceText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Discovery Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterChipsRow}
            contentContainerStyle={styles.filterChipsContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                الكل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'top_rated' && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === 'top_rated' ? 'all' : 'top_rated')}
            >
              <RatingFilterSvg size={15} color={activeFilter === 'top_rated' ? '#FFFFFF' : '#F59E0B'} />
              <Text style={[styles.filterChipText, activeFilter === 'top_rated' && styles.filterChipTextActive]}>
                الأعلى تقييماً
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'fast_delivery' && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === 'fast_delivery' ? 'all' : 'fast_delivery')}
            >
              <FastDeliverySvg size={15} color={activeFilter === 'fast_delivery' ? '#FFFFFF' : '#0284C7'} />
              <Text style={[styles.filterChipText, activeFilter === 'fast_delivery' && styles.filterChipTextActive]}>
                الأسرع توصيلاً
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'free_delivery' && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === 'free_delivery' ? 'all' : 'free_delivery')}
            >
              <FreeDeliverySvg size={15} color={activeFilter === 'free_delivery' ? '#FFFFFF' : '#10B981'} />
              <Text style={[styles.filterChipText, activeFilter === 'free_delivery' && styles.filterChipTextActive]}>
                توصيل مجاني
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'open_now' && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === 'open_now' ? 'all' : 'open_now')}
            >
              <OpenNowSvg size={15} color={activeFilter === 'open_now' ? '#FFFFFF' : '#16A34A'} />
              <Text style={[styles.filterChipText, activeFilter === 'open_now' && styles.filterChipTextActive]}>
                مفتوح الآن
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Cuisines / Categories Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {STATIC_CATEGORIES.map((cat, index) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                isSelected={selectedCategory === cat.id}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                index={index}
              />
            ))}
          </ScrollView>

          {/* Active Filter Bar if filtered */}
          {hasActiveFilters && (
            <View style={styles.activeFilterNotice}>
              <TouchableOpacity onPress={resetAllFilters} style={styles.resetFilterBtn}>
                <RotateCcw size={14} color="#EF4444" />
                <Text style={styles.resetFilterText}>إلغاء الفلاتر</Text>
              </TouchableOpacity>
              <Text style={styles.activeFilterCountText}>
                تم العثور على ({filteredRestaurants.length}) مطعم
              </Text>
            </View>
          )}

          {/* Promo Banners */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bannersList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {banners.map((banner) => (
              <TouchableOpacity
                key={banner.id}
                style={styles.bannerCard}
                onPress={() => {
                  if (banner.id === '1') router.push('/vouchers');
                  else setSelectedCategory('5');
                }}
                activeOpacity={0.88}
              >
                <Image source={{ uri: banner.image }} style={styles.bannerImage} />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>{banner.subtitle}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Section: Popular Restaurants */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>أشهر المطاعم</Text>
            <TouchableOpacity style={styles.chevronBtn} onPress={() => setActiveFilter('top_rated')}>
              <ChevronLeft size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} />
          ) : filteredRestaurants.length === 0 ? (
            <View style={styles.noFilterResultsBox}>
              <Text style={styles.emptyText}>لا توجد مطاعم مطابقة لهذا الفلتر</Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.resetFilterPill} onPress={resetAllFilters}>
                  <Text style={styles.resetFilterPillText}>عرض جميع المطاعم</Text>
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

          {/* Section: All / Local Favorite Restaurants */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>مطاعم محلية مفضلة</Text>
            <TouchableOpacity style={styles.chevronBtn}>
              <ChevronLeft size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          {isLoading ? null : (
            <View style={{ paddingHorizontal: 16 }}>
              {filteredRestaurants.map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
              ))}
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* Floating Flash Deal */}
      {showPromo && (
        <View style={styles.floatingPromo}>
          <View style={styles.promoIconContainer}>
            <Clock size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoMainText}>وفر ٢٥٪</Text>
            <Text style={styles.promoSubText}>عروض سريعة: لفترة محدودة</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>٤٢ : ٢٠</Text>
          </View>
          <TouchableOpacity onPress={() => setShowPromo(false)} style={styles.closeBtn}>
            <X size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}
      </View>

      {/* Address Selector Bottom Sheet */}
      <AddressSelectorModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      {/* In-App Notification Center Modal */}
      <NotificationCenterModal
        visible={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        onNavigateToOrder={() => router.push('/(tabs)/orders' as any)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', 
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.primary,
    zIndex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  searchWrapper: {
    backgroundColor: Colors.light.primary, // Keeps background orange when sticky
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10, // Ensure sticky header stays above body
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  promoContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
    marginTop: -24,
    backgroundColor: Colors.light.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  promoTextBold: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    lineHeight: 28,
  },
  pickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  pickupText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Tajawal_500Medium',
  },
  bodyContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 80,
    minHeight: 800,
    marginTop: 0, 
    zIndex: 2,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  indicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
  },
  servicesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  serviceItem: {
    alignItems: 'center',
    width: 64,
  },
  serviceIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceIconText: {
    fontSize: 24,
  },
  serviceText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#1F2937',
    textAlign: 'center',
  },
  categoriesList: {
    marginBottom: 24,
  },
  bannersList: {
    marginBottom: 32,
  },
  bannerCard: {
    width: 280,
    height: 140,
    borderRadius: 16,
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
    backgroundColor: Colors.light.primary,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  chevronBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingPromo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF0E5', 
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
  },
  promoIconContainer: {
    marginRight: 12,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoMainText: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  promoSubText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#D70F64', 
  },
  timerBadge: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  timerText: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
    fontSize: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
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
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    backgroundColor: '#FF2E7E',
  },
  activeOrderTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  activeOrderSub: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#FF2E7E',
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
    gap: 12,
  },
  headerIconBtn: {
    padding: 4,
  },
  filterChipsRow: {
    marginBottom: 16,
  },
  filterChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row-reverse',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#FF2E7E',
    borderColor: '#FF2E7E',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  activeFilterNotice: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE4E6',
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
    backgroundColor: '#FF2E7E',
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
});
