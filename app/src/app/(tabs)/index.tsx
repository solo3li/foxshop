import React, { useRef, useState, useMemo } from 'react'; 
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Animated, TextInput, ActivityIndicator, Platform, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { FoodItemCard } from '../../components/FoodItemCard';
import { restaurantService, mapBackendRestaurantToModel } from '../../services/restaurantService';
import { useCartStore } from '../../store/cartStore';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, X, Clock, MapPin, Heart, Search, RotateCcw, Ticket, Copy, Check, Tag, Sparkles, Bike } from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { CURRENCY } from '../../constants/config';
import { Restaurant, FoodCategory } from '../../types/models';
import { SECTORS, SECTOR_KEYS, SectorKey } from '../../constants/sectors';
import { useAuthStore } from '../../store/authStore';
import { useAddressStore } from '../../store/addressStore';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';
import { orderService, OrderResponse } from '../../services/orderService';
import { promotionService, CouponItem } from '../../services/promotionService';
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
  { id: '1', title: `خصم 10 ${CURRENCY}`, subtitle: 'كود FOX10', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2940&auto=format&fit=crop' },
  { id: '2', title: 'سلسلة المشروبات', subtitle: `ابتداءً من 10 ${CURRENCY}`, image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop' },
];

const services = [
  { id: 'offers', title: 'عروض', image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=200&auto=format&fit=crop' },
  { id: 'mart', title: 'فوكس مارت', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop' },
  { id: 'bakery', title: 'مخبز الثعلب', image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=200&auto=format&fit=crop' },
  { id: 'healthy', title: 'صحة وجمال', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=200&auto=format&fit=crop' },
  { id: 'new', title: 'جديد', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200&auto=format&fit=crop' }
];

import { notificationService } from '../../services/notificationService';

export type DiscoveryFilterType = 'all' | 'top_rated' | 'fast_delivery' | 'free_delivery' | 'open_now';

interface SectorSpringButtonProps {
  sec: (typeof SECTORS)[SectorKey];
  isSelected: boolean;
  theme: any;
  onPress: () => void;
}

function SectorSpringButton({ sec, isSelected, theme, onPress }: SectorSpringButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ marginHorizontal: 2 }}
    >
      <Animated.View
        style={[
          styles.sectorButton,
          {
            backgroundColor: isSelected
              ? theme.primary
              : theme.isDark
              ? theme.surfaceSecondary
              : '#F3F4F6',
            borderColor: isSelected ? theme.primary : 'transparent',
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={styles.sectorEmoji}>{sec.emoji}</Text>
        <Text
          style={[
            styles.sectorButtonText,
            { color: isSelected ? '#FFFFFF' : theme.text },
          ]}
        >
          {sec.shortTitle}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [selectedSector, setSelectedSector] = useState<SectorKey>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<DiscoveryFilterType>('all');
  const [showPromo, setShowPromo] = useState(true);
  const [restaurantList, setRestaurantList] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<CouponItem[]>([]);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);

  const currentSectorDef = SECTORS[selectedSector];

  const { isAuthenticated } = useAuthStore();
  const { selectedAddress, fetchAddresses } = useAddressStore();

  const handleCopyCouponCode = async (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCouponCode(code);
      setTimeout(() => setCopiedCouponCode(null), 2500);
    } catch {}
  };

  React.useEffect(() => {
    // Fetch live active coupons for home screen
    promotionService.getCoupons().then((res) => {
      if (res.data && res.data.length > 0) {
        setActiveCoupons(res.data);
      }
    }).catch(() => {});

    // Safely load saved address (guest local or user backend)
    fetchAddresses();

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
      setIsLoading(true);
      try {
        const params: {
          store_type?: string;
          latitude?: number;
          longitude?: number;
          lat?: number;
          lng?: number;
        } = {};

        if (selectedSector !== 'ALL') {
          params.store_type = selectedSector;
        }

        if (selectedAddress?.latitude !== undefined && selectedAddress?.longitude !== undefined) {
          params.latitude = selectedAddress.latitude;
          params.longitude = selectedAddress.longitude;
          params.lat = selectedAddress.latitude;
          params.lng = selectedAddress.longitude;
        }

        const res = await restaurantService.getRestaurants(params);
        if (isMounted && res.data) {
          const mapped: Restaurant[] = res.data.map(mapBackendRestaurantToModel);
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
  }, [selectedSector, selectedAddress?.latitude, selectedAddress?.longitude]);

  // Filtered restaurants computation
  const filteredRestaurants = useMemo(() => {
    let list = [...restaurantList];

    // Filter by store_type (client-side safety check alongside backend query)
    if (selectedSector !== 'ALL') {
      list = list.filter((r) => (r.store_type || 'RESTAURANT') === selectedSector);
    }

    // Filter by selected subcategory
    if (selectedCategory) {
      const catObj = currentSectorDef.subcategories.find((c) => c.id === selectedCategory);
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
  }, [restaurantList, selectedSector, currentSectorDef, selectedCategory, activeFilter]);

  const hasActiveFilters = selectedCategory !== null || activeFilter !== 'all' || selectedSector !== 'ALL';

  const resetAllFilters = () => {
    setSelectedCategory(null);
    setActiveFilter('all');
    setSelectedSector('ALL');
  };

  const handleServicePress = (serviceId: string) => {
    switch (serviceId) {
      case 'offers':
        router.push('/vouchers');
        break;
      case 'mart':
        setSelectedSector('SUPERMARKET');
        setSelectedCategory(null);
        break;
      case 'bakery':
        setSelectedSector('SUPERMARKET');
        setSelectedCategory('sup_4'); // مخبوزات
        break;
      case 'healthy':
        setSelectedSector('PHARMACY');
        setSelectedCategory(null);
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
                onPress={() => setShowNotificationCenter(true)}
                activeOpacity={0.7}
                style={[
                  styles.headerIconBtn,
                  { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F9FAFB' },
                ]}
              >
                <NotificationBellSvg size={20} color={theme.text} hasUnread={unreadNotificationsCount > 0} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/favorites')}
                activeOpacity={0.7}
                style={[
                  styles.headerIconBtn,
                  { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F9FAFB' },
                ]}
              >
                <Heart size={20} color={theme.text} strokeWidth={2} />
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
                backgroundColor: theme.isDark ? theme.surfaceSecondary : '#FFFFFF',
                borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              },
            ]}
            onPress={() => router.push('/search')}
            activeOpacity={0.88}
          >
            <Search size={20} color={theme.primary} style={styles.searchIcon} strokeWidth={2} />
            <Text style={[styles.searchPlaceholderText, { color: theme.textSecondary }]}>
              {currentSectorDef.searchPlaceholder}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Fluid Body Content */}
        <View style={[styles.bodyContainer, { backgroundColor: theme.background }]}>
          
          {/* 0. Top Category / Sector Selector Bar (6 Sectors + All) */}
          <View style={styles.sectorSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectorSelectorContent}
            >
              {SECTOR_KEYS.map((key) => {
                const sec = SECTORS[key];
                const isSelected = selectedSector === key;
                return (
                  <SectorSpringButton
                    key={sec.id}
                    sec={sec}
                    isSelected={isSelected}
                    theme={theme}
                    onPress={() => {
                      setSelectedSector(key);
                      setSelectedCategory(null);
                    }}
                  />
                );
              })}
            </ScrollView>
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

          {/* Dynamic Sector Subcategories Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {currentSectorDef.subcategories.map((cat, index) => (
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
                تم العثور على ({filteredRestaurants.length}) {currentSectorDef.storeUnit}
              </Text>
            </View>
          )}

          {/* Promo Banners */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bannersList}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / 296);
              if (index >= 0 && index < banners.length && index !== activeBannerIndex) {
                setActiveBannerIndex(index);
              }
            }}
            scrollEventThrottle={16}
          >
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

          {/* Banner Carousel Pagination Dots */}
          <View style={styles.bannerDotsRow}>
            {banners.map((_, idx) => (
              <View
                key={`b-dot-${idx}`}
                style={[
                  styles.bannerDot,
                  activeBannerIndex === idx
                    ? [styles.bannerDotActive, { backgroundColor: theme.primary }]
                    : [styles.bannerDotInactive, { backgroundColor: theme.isDark ? '#4B5563' : '#D1D5DB' }],
                ]}
              />
            ))}
          </View>

          {/* Flash Deal Soft Promo Banner */}
          {showPromo && (
            <View style={[styles.floatingPromo, { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#FFF1F5' }]}>
              <View style={styles.promoIconContainer}>
                <Clock size={22} color={theme.primary} />
              </View>
              <View style={styles.promoTextContainer}>
                <Text style={[styles.promoMainText, { color: theme.text }]}>وفر ٢٥٪</Text>
                <Text style={[styles.promoSubText, { color: theme.primary }]}>عروض سريعة: لفترة محدودة</Text>
              </View>
              <View style={[styles.timerBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.timerText}>٤٢ : ٢٠</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPromo(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Section: Exclusive Coupons & Discounts */}
          {activeCoupons.length > 0 && (
            <View style={styles.couponsSectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWithIcon}>
                  <Tag size={20} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>عروض وكوبونات فوكس شوب</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewAllCouponsBtn}
                  onPress={() => router.push('/vouchers')}
                >
                  <Text style={[styles.viewAllCouponsText, { color: theme.primary }]}>عرض الكل ({activeCoupons.length})</Text>
                  <ChevronLeft size={16} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              >
                {activeCoupons.map((coupon) => (
                  <TouchableOpacity
                    key={coupon.id}
                    style={[styles.homeCouponCard, { backgroundColor: theme.card }]}
                    onPress={() => handleCopyCouponCode(coupon.code)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.couponTopRow}>
                      <View style={[styles.couponCodePill, { backgroundColor: theme.primaryLight }]}>
                        <Text style={[styles.couponCodeText, { color: theme.primary }]}>{coupon.code}</Text>
                      </View>
                      <View style={styles.copyPill}>
                        {copiedCouponCode === coupon.code ? (
                          <>
                            <Check size={13} color="#15803D" />
                            <Text style={styles.copiedPillText}>تم النسخ!</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={13} color={theme.primary} />
                            <Text style={[styles.copyPillText, { color: theme.primary }]}>نسخ</Text>
                          </>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.homeCouponDiscountText, { color: theme.text }]}>
                      {coupon.discount_type === 'PERCENT'
                        ? `خصم ${parseFloat(String(coupon.discount_value))}%`
                        : coupon.discount_type === 'FREE_DELIVERY'
                        ? 'توصيل مجاني'
                        : `خصم ${parseFloat(String(coupon.discount_value))} ${CURRENCY}`}
                    </Text>

                    <Text style={[styles.homeCouponSubtext, { color: theme.textSecondary }]}>
                      {coupon.first_order_only ? 'للطلب الأول فقط' : `للطلبات من ${parseFloat(String(coupon.min_order_amount))} ${CURRENCY}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick Add-To-Cart Grocery / Retail Section */}
          {currentSectorDef.quickItems && currentSectorDef.quickItems.length > 0 && (
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
                      : 'منتجات ومقاضي سريعة الإضافة'}
                  </Text>
                </View>
              </View>
              <View style={{ marginBottom: 14 }}>
                {currentSectorDef.quickItems.map((item) => (
                  <FoodItemCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          )}

          {/* Section: Popular Stores */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{currentSectorDef.popularTitle}</Text>
            <TouchableOpacity style={styles.chevronBtn} onPress={() => setActiveFilter('top_rated')}>
              <ChevronLeft size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : filteredRestaurants.length === 0 ? (
            <View style={styles.noFilterResultsBox}>
              <Text style={styles.emptyText}>{currentSectorDef.emptyMessage}</Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.resetFilterPill} onPress={resetAllFilters}>
                  <Text style={styles.resetFilterPillText}>
                    عرض جميع {currentSectorDef.storeUnit === 'مطعم' ? 'المطاعم' : 'المتاجر'}
                  </Text>
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

        </View>
      </Animated.ScrollView>
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
        onUnreadCountChange={setUnreadNotificationsCount}
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
    paddingTop: 6,
    paddingBottom: 14,
    zIndex: 10, // Ensure sticky header stays above body
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
  bodyContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 80,
    minHeight: 800,
    marginTop: 0, 
    zIndex: 2,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  couponsSectionContainer: {
    marginBottom: 28,
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
    width: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  couponCodePill: {
    backgroundColor: '#FCE7F3',
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 8,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
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
  floatingPromo: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFF1F5', 
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 0,
    position: 'relative',
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
    top: 10,
    right: 10,
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
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFF1F5',
    borderWidth: 0,
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
    backgroundColor: '#F3F4F6',
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#D70F64',
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
  sectorSelectorContainer: {
    marginBottom: 16,
  },
  sectorSelectorContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row-reverse',
  },
  sectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  sectorEmoji: {
    fontSize: 16,
  },
  sectorButtonText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  quickAddSection: {
    marginBottom: 16,
  },
  bannerDotsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
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
