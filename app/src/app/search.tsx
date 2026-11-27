import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Search,
  Clock,
  X,
  Star,
  MapPin,
  Store,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  Trash,
  LayoutGrid,
  UtensilsCrossed,
  ShoppingBasket,
  Pill,
  Beef,
  Gift,
  RefreshCw,
  AlertCircle,
  Bike,
  ChevronDown,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../hooks/use-theme';
import { formatCurrency, normalizeArabic } from '../constants/config';
import { SECTORS, SECTOR_KEYS, SectorKey, STORE_TYPE_LABELS } from '../constants/sectors';
import { DynamicSvgIcon } from '../components/DynamicSvgIcon';
import { FoodItemCard } from '../components/FoodItemCard';
import { FoodItem } from '../types/models';
import {
  restaurantService,
  BackendRestaurant,
  mapBackendMenuItemToFoodItem,
  sanitizeImageUrl,
} from '../services/restaurantService';
import { useAddressStore } from '../store/addressStore';
import { MandatoryAddressGate } from '../components/MandatoryAddressGate';
import { AddressSelectorModal } from '../components/AddressSelectorModal';
import { useSearchHistoryStore } from '../store/searchHistoryStore';
import { useCartStore } from '../store/cartStore';
import { SearchBackSvg } from '../components/NavigationIcons';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'store' | 'product' | 'category' | 'query';
  subtitle?: string;
  targetId?: string;
}

type ResultTab = 'ALL' | 'STORES' | 'PRODUCTS';
type SortOption = 'default' | 'nearest' | 'rating' | 'delivery_fee';

const FALLBACK_STORE_IMAGE =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80';

function isValidSectorKey(val: unknown): val is SectorKey {
  return typeof val === 'string' && (SECTOR_KEYS as string[]).includes(val);
}

function renderSectorIcon(key: SectorKey, color: string, size = 15) {
  const props = { size, color, strokeWidth: 1.75 };
  switch (key) {
    case 'ALL':
      return <LayoutGrid {...props} />;
    case 'RESTAURANT':
      return <UtensilsCrossed {...props} />;
    case 'SUPERMARKET':
      return <ShoppingBasket {...props} />;
    case 'PHARMACY':
      return <Pill {...props} />;
    case 'BUTCHERY_VEG':
      return <Beef {...props} />;
    case 'FLOWERS_GIFTS':
      return <Gift {...props} />;
    case 'GENERAL_RETAIL':
      return <ShoppingBag {...props} />;
    default:
      return <Store {...props} />;
  }
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sector?: string }>();
  const theme = useTheme();

  const selectedAddress = useAddressStore((state) => state.selectedAddress);
  const fetchAddresses = useAddressStore((state) => state.fetchAddresses);
  const addressInitialized = useAddressStore((state) => state.isInitialized);

  // Cart Store for floating summary bar
  const cartItems = useCartStore((state) => state.items);
  const cartRestaurantName = useCartStore((state) => state.restaurantName);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const totalCartItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const totalCartPrice = useMemo(() => getTotalPrice(), [cartItems, getTotalPrice]);

  // Search History Store
  const history = useSearchHistoryStore((state) => state.history);
  const loadHistory = useSearchHistoryStore((state) => state.loadHistory);
  const addSearchTerm = useSearchHistoryStore((state) => state.addSearchTerm);
  const removeSearchTerm = useSearchHistoryStore((state) => state.removeSearchTerm);
  const clearHistory = useSearchHistoryStore((state) => state.clearHistory);

  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const initialSector: SectorKey =
    typeof params.sector === 'string' && params.sector.trim()
      ? (params.sector.trim() as SectorKey)
      : 'ALL';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedSector, setSelectedSector] = useState<SectorKey>(initialSector);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Full search results state
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);
  const [matchingStores, setMatchingStores] = useState<BackendRestaurant[]>([]);
  const [matchingProducts, setMatchingProducts] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Result tabs & sorting
  const [resultTab, setResultTab] = useState<ResultTab>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // Real area-scoped discovery state (zero dummy data)
  const [dynamicSectors, setDynamicSectors] = useState<{ code: string; shortTitle: string; searchPlaceholder?: string; iconSvg?: string }[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [areaStores, setAreaStores] = useState<BackendRestaurant[]>([]);
  const [areaProducts, setAreaProducts] = useState<FoodItem[]>([]);
  const [loadingAreaData, setLoadingAreaData] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const hasExecutedSearchRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const areaRequestIdRef = useRef(0);
  const pendingUrlQueryRef = useRef<string | null>(initialQuery.trim() || null);
  const lastSyncedUrlRef = useRef<{ q: string; sector: SectorKey }>({
    q: initialQuery.trim(),
    sector: initialSector,
  });

  const matchedDynamicSector = dynamicSectors.find((s) => s.code === selectedSector);
  const baseSectorDef = SECTORS[selectedSector] || SECTORS.ALL;
  const currentSectorDef = matchedDynamicSector
    ? {
        ...baseSectorDef,
        shortTitle: matchedDynamicSector.shortTitle || baseSectorDef.shortTitle,
        searchPlaceholder: matchedDynamicSector.searchPlaceholder || baseSectorDef.searchPlaceholder,
      }
    : baseSectorDef;

  // Cold-load address initialization
  useEffect(() => {
    if (!addressInitialized) {
      fetchAddresses();
    }
  }, [addressInitialized, fetchAddresses]);

  // Focus input automatically (if no initial query) and load history & dynamic sectors on mount
  useEffect(() => {
    loadHistory();
    restaurantService
      .getSectors()
      .then((res) => {
        if (res.data?.sectors) {
          setDynamicSectors(
            res.data.sectors.map((s) => ({
              code: s.code,
              shortTitle: s.short_title || s.name,
              searchPlaceholder: s.search_placeholder,
              iconSvg: s.icon_svg,
            }))
          );
        }
      })
      .catch(() => {});
    if (!initialQuery.trim()) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loadHistory, initialQuery]);

  // Keep ref in sync
  useEffect(() => {
    hasExecutedSearchRef.current = hasExecutedSearch;
  }, [hasExecutedSearch]);

  const syncUrlParams = useCallback(
    (qVal: string, sectorVal: SectorKey) => {
      const cleanQ = qVal.trim();
      lastSyncedUrlRef.current = { q: cleanQ, sector: sectorVal };
      try {
        router.setParams({
          q: cleanQ ? cleanQ : undefined,
          sector: sectorVal !== 'ALL' ? sectorVal : undefined,
        } as any);
      } catch {
        // Ignore if router params cannot be updated before mount settles
      }
    },
    [router]
  );

  // Sync external param changes (e.g. navigating from Home with ?sector=... or browser back/forward)
  useEffect(() => {
    const paramSector: SectorKey = isValidSectorKey(params.sector) ? params.sector : 'ALL';
    const paramQ = typeof params.q === 'string' ? params.q.trim() : '';

    if (paramSector !== lastSyncedUrlRef.current.sector) {
      lastSyncedUrlRef.current.sector = paramSector;
      setSelectedSector(paramSector);
      if (paramQ) {
        pendingUrlQueryRef.current = paramQ;
        hasExecutedSearchRef.current = false;
        setHasExecutedSearch(false);
      }
    }

    if (paramQ !== lastSyncedUrlRef.current.q) {
      lastSyncedUrlRef.current.q = paramQ;
      if (paramQ) {
        setSearchQuery(paramQ);
        pendingUrlQueryRef.current = paramQ;
        hasExecutedSearchRef.current = false;
        setHasExecutedSearch(false);
      } else {
        activeRequestIdRef.current++;
        pendingUrlQueryRef.current = null;
        setSearchQuery('');
        hasExecutedSearchRef.current = false;
        setHasExecutedSearch(false);
        setSuggestions([]);
        setLoadingSuggestions(false);
        setMatchingStores([]);
        setMatchingProducts([]);
        setSearchError(null);
        setLoading(false);
      }
    }
  }, [params.sector, params.q]);

  // Instant local suggestions from real user search history only (zero dummy data)
  const getLocalSuggestions = useCallback(
    (query: string): SearchSuggestion[] => {
      const normQuery = normalizeArabic(query);
      if (!normQuery) return [];

      const seen = new Set<string>();
      const deduped: SearchSuggestion[] = [];

      for (const h of history) {
        if (!normalizeArabic(h).includes(normQuery)) continue;
        const normKey = normalizeArabic(h);
        if (!seen.has(normKey)) {
          seen.add(normKey);
          deduped.push({
            id: `hist_${h}`,
            text: h,
            type: 'history',
            subtitle: 'بحث سابق',
          });
        }
      }

      return deduped;
    },
    [history]
  );

  // Fetch real deliverable stores & products for the active delivery area
  const fetchAreaDiscovery = useCallback(async () => {
    if (selectedAddress?.latitude === undefined || selectedAddress?.longitude === undefined) {
      setAreaStores([]);
      setAreaProducts([]);
      return;
    }

    const reqId = ++areaRequestIdRef.current;
    setLoadingAreaData(true);
    setAreaError(null);

    try {
      const storeTypeParam = selectedSector !== 'ALL' ? selectedSector : undefined;
      const res = await restaurantService.searchUniversal('', {
        store_type: storeTypeParam,
        lat: selectedAddress.latitude,
        lng: selectedAddress.longitude,
      });

      if (reqId !== areaRequestIdRef.current) return;

      if (res.data) {
        const stores = res.data.stores || [];
        const rawProducts = res.data.products || res.data.items || [];
        const products = rawProducts.map((p) =>
          mapBackendMenuItemToFoodItem(p, p.restaurant_id)
        );
        setAreaStores(stores);
        setAreaProducts(products);
        setAreaError(null);
      } else {
        setAreaStores([]);
        setAreaProducts([]);
        setAreaError(res.error || 'تعذر تحميل متاجر المنطقة.');
      }
    } catch (err: any) {
      if (reqId !== areaRequestIdRef.current) return;
      setAreaStores([]);
      setAreaProducts([]);
      setAreaError(err?.message || 'تعذر الاتصال بالخادم.');
    } finally {
      if (reqId === areaRequestIdRef.current) {
        setLoadingAreaData(false);
      }
    }
  }, [selectedAddress, selectedSector]);

  useEffect(() => {
    fetchAreaDiscovery();
  }, [fetchAreaDiscovery]);

  // Handle typing: resets full results so suggestions appear
  const handleQueryChange = (text: string) => {
    activeRequestIdRef.current++;
    pendingUrlQueryRef.current = null;
    setSearchQuery(text);
    setSearchError(null);
    if (hasExecutedSearchRef.current) {
      hasExecutedSearchRef.current = false;
      setHasExecutedSearch(false);
      setMatchingStores([]);
      setMatchingProducts([]);
    }
  };

  // Immediate local suggestions + 200ms debounced remote suggestions with race-condition guard
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean) {
      activeRequestIdRef.current++;
      setSuggestions([]);
      setLoadingSuggestions(false);
      setMatchingStores([]);
      setMatchingProducts([]);
      setSearchError(null);
      setHasExecutedSearch(false);
      hasExecutedSearchRef.current = false;
      return;
    }

    if (hasExecutedSearchRef.current) {
      return;
    }

    // 1. Instant local matches (0ms delay)
    const local = getLocalSuggestions(clean);
    setSuggestions(local.slice(0, 8));

    // 2. Debounced remote suggestions
    if (selectedAddress?.latitude === undefined || selectedAddress?.longitude === undefined) {
      setLoadingSuggestions(false);
      return;
    }

    const requestId = ++activeRequestIdRef.current;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const storeTypeParam = selectedSector !== 'ALL' ? selectedSector : undefined;
        const res = await restaurantService.searchUniversal(clean, {
          store_type: storeTypeParam,
          lat: selectedAddress?.latitude,
          lng: selectedAddress?.longitude,
        });

        if (
          requestId !== activeRequestIdRef.current ||
          hasExecutedSearchRef.current
        ) {
          return;
        }

        const remoteSuggestions: SearchSuggestion[] = [];
        if (res.data) {
          const stores = res.data.stores || [];
          const products = res.data.products || res.data.items || [];

          stores.forEach((s) => {
            remoteSuggestions.push({
              id: `store_${s.id}`,
              text: s.name,
              type: 'store',
              targetId: s.id,
              subtitle:
                s.store_type && STORE_TYPE_LABELS[s.store_type]
                  ? STORE_TYPE_LABELS[s.store_type]
                  : 'متجر',
            });
          });

          products.forEach((p) => {
            remoteSuggestions.push({
              id: `prod_${p.id}`,
              text: p.name,
              type: 'product',
              subtitle: p.restaurant_name ? `في ${p.restaurant_name}` : 'منتج',
            });
          });
        }

        const combined = [...local.slice(0, 3), ...remoteSuggestions];
        const seen = new Set<string>();
        const deduped: SearchSuggestion[] = [];

        for (const item of combined) {
          const normKey =
            item.type === 'store' && item.targetId
              ? `store:${item.targetId}`
              : normalizeArabic(item.text);
          if (!seen.has(normKey)) {
            seen.add(normKey);
            deduped.push(item);
          }
        }

        setSuggestions(deduped.slice(0, 8));
      } catch (err) {
        console.warn('[Search] Failed to fetch remote suggestions:', err);
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoadingSuggestions(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSector, getLocalSuggestions, selectedAddress]);

  // Full search execution with strict activeRequestIdRef race-condition guard
  const handleExecuteSearch = useCallback(
    async (term: string, sector: SectorKey = selectedSector) => {
      const clean = term.trim();
      if (!clean) return;
      if (selectedAddress?.latitude === undefined || selectedAddress?.longitude === undefined) return;

      const requestId = ++activeRequestIdRef.current;
      Keyboard.dismiss();
      hasExecutedSearchRef.current = true;
      setHasExecutedSearch(true);
      setSearchQuery(clean);
      setSuggestions([]);
      setLoadingSuggestions(false);
      setSearchError(null);
      setResultTab('ALL');
      addSearchTerm(clean);
      syncUrlParams(clean, sector);

      setLoading(true);
      try {
        const storeTypeParam = sector !== 'ALL' ? sector : undefined;
        const res = await restaurantService.searchUniversal(clean, {
          store_type: storeTypeParam,
          lat: selectedAddress?.latitude,
          lng: selectedAddress?.longitude,
        });

        if (requestId !== activeRequestIdRef.current) return;

        if (res.data) {
          const stores = res.data.stores || [];
          const rawProducts = res.data.products || res.data.items || [];
          const products = rawProducts.map((p) =>
            mapBackendMenuItemToFoodItem(p, p.restaurant_id)
          );
          setMatchingStores(stores);
          setMatchingProducts(products);
          setSearchError(null);
        } else {
          const fallbackRes = await restaurantService.getRestaurants({
            q: clean,
            store_type: storeTypeParam,
            lat: selectedAddress?.latitude,
            lng: selectedAddress?.longitude,
          });

          if (requestId !== activeRequestIdRef.current) return;

          if (fallbackRes.data) {
            setMatchingStores(fallbackRes.data);
            setMatchingProducts([]);
            setSearchError(null);
          } else {
            setMatchingStores([]);
            setMatchingProducts([]);
            setSearchError(
              fallbackRes.error || res.error || 'تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى.'
            );
          }
        }
      } catch (err: any) {
        if (requestId !== activeRequestIdRef.current) return;
        console.error('[Search] Failed to fetch search results:', err);
        setMatchingStores([]);
        setMatchingProducts([]);
        setSearchError(err?.message || 'حدث خطأ أثناء جلب نتائج البحث، يرجى المحاولة مرة أخرى.');
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [selectedSector, selectedAddress, addSearchTerm, syncUrlParams]
  );

  // Auto-execute initial/external URL query (?q=...) once address is ready
  useEffect(() => {
    const pendingQ = pendingUrlQueryRef.current;
    if (
      pendingQ &&
      addressInitialized &&
      selectedAddress &&
      !hasExecutedSearchRef.current
    ) {
      pendingUrlQueryRef.current = null;
      handleExecuteSearch(pendingQ, selectedSector);
    }
  }, [addressInitialized, selectedAddress, selectedSector, handleExecuteSearch]);

  // Complete query into search input without executing full search
  const handleFillSuggestion = (text: string) => {
    setSearchQuery(text);
    setSearchError(null);
    hasExecutedSearchRef.current = false;
    setHasExecutedSearch(false);
    inputRef.current?.focus();
  };

  // Handle tapping a suggestion row
  const handleSuggestionPress = (item: SearchSuggestion) => {
    if (item.type === 'store' && item.targetId) {
      Keyboard.dismiss();
      router.push(`/restaurant/${item.targetId}` as any);
      return;
    }
    handleExecuteSearch(item.text);
  };

  // Sector filter change
  const handleSectorSelect = (key: SectorKey) => {
    setSelectedSector(key);
    syncUrlParams(searchQuery, key);
    if (hasExecutedSearch && searchQuery.trim().length > 0) {
      handleExecuteSearch(searchQuery, key);
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    activeRequestIdRef.current++;
    pendingUrlQueryRef.current = null;
    setSearchQuery('');
    hasExecutedSearchRef.current = false;
    setHasExecutedSearch(false);
    setSuggestions([]);
    setLoadingSuggestions(false);
    setMatchingStores([]);
    setMatchingProducts([]);
    setSearchError(null);
    setLoading(false);
    setResultTab('ALL');
    setSortBy('default');
    syncUrlParams('', selectedSector);
    inputRef.current?.focus();
  };

  // Sorted stores based on quick sort bar
  const sortedStores = useMemo(() => {
    if (sortBy === 'default') return matchingStores;
    const list = [...matchingStores];
    if (sortBy === 'nearest') {
      list.sort(
        (a, b) => (a.distance_km ?? Number.MAX_SAFE_INTEGER) - (b.distance_km ?? Number.MAX_SAFE_INTEGER)
      );
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sortBy === 'delivery_fee') {
      list.sort((a, b) => (Number(a.delivery_fee) || 0) - (Number(b.delivery_fee) || 0));
    }
    return list;
  }, [matchingStores, sortBy]);

  const hasAnyResults = matchingStores.length > 0 || matchingProducts.length > 0;
  const isTypingMode = !hasExecutedSearch && searchQuery.trim().length > 0;
  const isZeroState = !hasExecutedSearch && searchQuery.trim().length === 0;

  if (!addressInitialized) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          backgroundColor: Platform.OS === 'web' ? (theme.isDark ? theme.background : '#F3F4F6') : theme.background,
        }}
      >
        <View style={[styles.container, styles.centerLoading, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedAddress) {
    return <MandatoryAddressGate />;
  }

  const showStoresSection =
    !loading && !searchError && sortedStores.length > 0 && (resultTab === 'ALL' || resultTab === 'STORES');
  const showProductsSection =
    !loading && !searchError && matchingProducts.length > 0 && (resultTab === 'ALL' || resultTab === 'PRODUCTS');

  const activeAreaLabel = selectedAddress.title || selectedAddress.street || 'موقعي الحالي';

  const renderStoreRow = (restaurant: BackendRestaurant, idx: number, total: number) => {
    const sectorLabel =
      (restaurant.store_type && STORE_TYPE_LABELS[restaurant.store_type]) || null;
    const storeImg =
      sanitizeImageUrl(restaurant.logo) ||
      sanitizeImageUrl(restaurant.cover_image) ||
      FALLBACK_STORE_IMAGE;
    const deliveryFeeNum = Number(restaurant.delivery_fee) || 0;

    return (
      <Animated.View
        key={restaurant.id || idx}
        entering={FadeInUp.delay(Math.min(idx, 8) * 30)}
      >
        <TouchableOpacity
          style={[
            styles.restaurantCard,
            { backgroundColor: theme.card },
            idx < total - 1 && {
              borderBottomWidth: 0.5,
              borderBottomColor: theme.borderSubtle,
            },
          ]}
          activeOpacity={0.82}
          onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
        >
          <Image source={{ uri: storeImg }} style={styles.restaurantImg} />

          <View style={styles.restaurantInfoCol}>
            <View style={styles.restaurantHeaderRow}>
              <View style={styles.restaurantNameWrap}>
                <Text
                  style={[styles.restaurantName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {restaurant.name}
                </Text>
                {restaurant.is_busy && (
                  <View style={styles.busyBadge}>
                    <Text style={styles.busyBadgeText}>مزدحم</Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingBadge}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.ratingText}>
                  {Number(restaurant.rating || 4.8).toFixed(1)}
                </Text>
                {restaurant.rating_count != null && restaurant.rating_count > 0 && (
                  <Text style={[styles.ratingCountText, { color: theme.textMuted }]}>
                    ({restaurant.rating_count > 999 ? '1k+' : restaurant.rating_count})
                  </Text>
                )}
              </View>
            </View>

            {sectorLabel && (
              <View
                style={[
                  styles.sectorPill,
                  {
                    backgroundColor: theme.isDark
                      ? theme.surfaceSecondary
                      : '#F5F6F8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectorPillText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {sectorLabel}
                </Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={12} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {restaurant.estimated_prep_time_minutes
                    ? `${restaurant.estimated_prep_time_minutes} دقيقة`
                    : '25-35 دقيقة'}
                </Text>
              </View>

              {restaurant.distance_km != null && (
                <>
                  <Text style={[styles.metaDivider, { color: theme.textMuted }]}>
                    •
                  </Text>
                  <View style={styles.metaItem}>
                    <MapPin size={12} color={theme.textMuted} />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {Number(restaurant.distance_km).toFixed(1)} كم
                    </Text>
                  </View>
                </>
              )}

              <Text style={[styles.metaDivider, { color: theme.textMuted }]}>
                •
              </Text>
              <View style={styles.metaItem}>
                <Bike size={12} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {deliveryFeeNum > 0
                    ? `توصيل ${formatCurrency(deliveryFeeNum)}`
                    : 'توصيل مجاني'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: Platform.OS === 'web' ? (theme.isDark ? theme.background : '#F3F4F6') : theme.background,
      }}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* ── Minimalist Sticky Header ── */}
        <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
              activeOpacity={0.75}
              accessibilityLabel="رجوع"
            >
              <SearchBackSvg size={20} color={theme.text} />
            </TouchableOpacity>

            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
              ]}
            >
              <Search size={18} color={theme.primary} strokeWidth={2} />
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: theme.text, outlineStyle: 'none' } as any]}
                placeholder={currentSectorDef.searchPlaceholder}
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={handleQueryChange}
                returnKeyType="search"
                onSubmitEditing={() => handleExecuteSearch(searchQuery)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={[styles.clearBtn, { backgroundColor: theme.surfaceSecondary }]}
                  accessibilityLabel="مسح نص البحث"
                >
                  <X size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Active Delivery Area Tracker Pill ── */}
          <TouchableOpacity
            style={styles.areaBarRow}
            activeOpacity={0.75}
            onPress={() => setShowAddressModal(true)}
            accessibilityLabel="تغيير منطقة التوصيل"
          >
            <View style={styles.areaBarStart}>
              <MapPin size={14} color={theme.primary} strokeWidth={2} />
              <Text style={[styles.areaBarLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                نطاق المتاجر:{' '}
                <Text style={[styles.areaBarValue, { color: theme.text }]}>
                  {activeAreaLabel}
                </Text>
              </Text>
            </View>
            <View style={styles.areaBarAction}>
              <Text style={[styles.areaBarChangeText, { color: theme.primary }]}>تغيير المنطقة</Text>
              <ChevronDown size={13} color={theme.primary} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* ── Clean Sector Filter Strip (Lucide Icons, Zero Border) ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectorBarContent}
            style={styles.sectorBarWrapper}
          >
            {(
              [
                { code: 'ALL', shortTitle: SECTORS.ALL.shortTitle },
                ...dynamicSectors,
              ] as { code: string; shortTitle: string; iconSvg?: string }[]
            ).map((sec) => {
              const key = sec.code as SectorKey;
              const isSelected = selectedSector === key;
              const iconColor = isSelected ? theme.primary : theme.textSecondary;
              return (
                <TouchableOpacity
                  key={sec.code}
                  style={[
                    styles.sectorChip,
                    {
                      backgroundColor: isSelected
                        ? theme.primaryLight
                        : theme.isDark
                        ? theme.surfaceSecondary
                        : '#F5F6F8',
                    },
                  ]}
                  onPress={() => handleSectorSelect(key)}
                  activeOpacity={0.78}
                >
                  <DynamicSvgIcon
                    svg={sec.iconSvg}
                    size={15}
                    color={iconColor}
                    fallback={renderSectorIcon(key, iconColor, 15)}
                  />
                  <Text
                    style={[
                      styles.sectorChipText,
                      { color: isSelected ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    {sec.shortTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Subtle 0.5px Hairline Divider */}
          <View style={[styles.hairlineDivider, { backgroundColor: theme.borderSubtle }]} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            totalCartItems > 0 && styles.scrollContentWithCart,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 1. AUTOCOMPLETE SUGGESTIONS (While typing) ── */}
          {isTypingMode && (
            <Animated.View entering={FadeIn.duration(150)} style={styles.suggestionsContainer}>
              <View style={styles.suggestionsHeader}>
                <View style={styles.sectionTitleRow}>
                  <Sparkles size={15} color={theme.primary} strokeWidth={1.9} />
                  <Text style={[styles.suggestionsHeaderText, { color: theme.textSecondary }]}>
                    اقتراحات البحث السريعة
                  </Text>
                </View>
                {loadingSuggestions && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
              </View>

              <View style={[styles.suggestionsList, { backgroundColor: theme.card }]}>
                {suggestions.map((item, idx) => (
                  <View
                    key={item.id || idx}
                    style={[
                      styles.suggestionRow,
                      idx < suggestions.length - 1 && {
                        borderBottomWidth: 0.5,
                        borderBottomColor: theme.borderSubtle,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.suggestionMainArea}
                      activeOpacity={0.7}
                      onPress={() => handleSuggestionPress(item)}
                    >
                      <View
                        style={[
                          styles.suggestionIconBox,
                          {
                            backgroundColor:
                              item.type === 'store'
                                ? theme.primaryLight
                                : theme.isDark
                                ? theme.surfaceSecondary
                                : '#F8FAFC',
                          },
                        ]}
                      >
                        {item.type === 'history' ? (
                          <Clock size={15} color={theme.textMuted} strokeWidth={1.75} />
                        ) : item.type === 'store' ? (
                          <Store size={15} color={theme.primary} strokeWidth={1.75} />
                        ) : item.type === 'product' ? (
                          <ShoppingBag size={15} color={theme.primary} strokeWidth={1.75} />
                        ) : (
                          <Search size={15} color={theme.textMuted} strokeWidth={1.75} />
                        )}
                      </View>

                      <View style={styles.suggestionTextBox}>
                        <Text
                          style={[styles.suggestionText, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.text}
                        </Text>
                        {item.subtitle && (
                          <Text
                            style={[styles.suggestionSubtitle, { color: theme.textMuted }]}
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.suggestionArrowBtn,
                        { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleFillSuggestion(item.text)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="إكمال الكلمة في حقل البحث"
                    >
                      <ArrowUpRight size={15} color={theme.textSecondary} strokeWidth={1.75} />
                    </TouchableOpacity>
                  </View>
                ))}

                {suggestions.length === 0 && !loadingSuggestions && (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    activeOpacity={0.7}
                    onPress={() => handleExecuteSearch(searchQuery)}
                  >
                    <View style={styles.suggestionMainArea}>
                      <View
                        style={[
                          styles.suggestionIconBox,
                          { backgroundColor: theme.primaryLight },
                        ]}
                      >
                        <Search size={15} color={theme.primary} strokeWidth={2} />
                      </View>
                      <View style={styles.suggestionTextBox}>
                        <Text
                          style={[
                            styles.suggestionText,
                            { color: theme.primary, fontFamily: 'Tajawal_700Bold' },
                          ]}
                          numberOfLines={1}
                        >
                          بحث عن &ldquo;{searchQuery}&rdquo;
                        </Text>
                        <Text style={[styles.suggestionSubtitle, { color: theme.textMuted }]}>
                          اضغط لعرض كافة المتاجر والمنتجات
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.suggestionArrowBtn,
                        { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
                      ]}
                    >
                      <ArrowUpRight size={15} color={theme.textSecondary} strokeWidth={1.75} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}

          {/* ── 2. FULL SEARCH RESULTS ── */}
          {hasExecutedSearch && (
            <View>
              {/* Loading Skeletons */}
              {loading && (
                <View style={styles.skeletonContainer}>
                  <View style={styles.skeletonTabsRow}>
                    <View style={[styles.skeletonPill, { width: 76, backgroundColor: theme.surfaceSecondary }]} />
                    <View style={[styles.skeletonPill, { width: 88, backgroundColor: theme.surfaceSecondary }]} />
                    <View style={[styles.skeletonPill, { width: 92, backgroundColor: theme.surfaceSecondary }]} />
                  </View>
                  {[0, 1, 2].map((idx) => (
                    <View
                      key={`sk-store-${idx}`}
                      style={[
                        styles.skeletonStoreCard,
                        { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
                      ]}
                    >
                      <View style={[styles.skeletonThumb, { backgroundColor: theme.backgroundSelected }]} />
                      <View style={styles.skeletonLines}>
                        <View style={[styles.skeletonLine, { width: '58%', height: 14, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '36%', height: 11, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '74%', height: 11, backgroundColor: theme.backgroundSelected }]} />
                      </View>
                    </View>
                  ))}
                  {[0, 1].map((idx) => (
                    <View
                      key={`sk-prod-${idx}`}
                      style={[
                        styles.skeletonProductCard,
                        { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
                      ]}
                    >
                      <View style={styles.skeletonLines}>
                        <View style={[styles.skeletonLine, { width: '65%', height: 14, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '45%', height: 11, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '28%', height: 14, backgroundColor: theme.backgroundSelected }]} />
                      </View>
                      <View style={[styles.skeletonProdThumb, { backgroundColor: theme.backgroundSelected }]} />
                    </View>
                  ))}
                </View>
              )}

              {/* Network / Server Error State with Retry */}
              {!loading && searchError && (
                <Animated.View entering={FadeIn} style={styles.stateBox}>
                  <View style={[styles.stateIconWrap, { backgroundColor: theme.errorLight }]}>
                    <AlertCircle size={30} color={theme.error} strokeWidth={1.75} />
                  </View>
                  <Text style={[styles.stateTitle, { color: theme.text }]}>
                    تعذر إتمام البحث
                  </Text>
                  <Text style={[styles.stateSub, { color: theme.textSecondary }]}>
                    {searchError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                    activeOpacity={0.85}
                    onPress={() => handleExecuteSearch(searchQuery, selectedSector)}
                  >
                    <RefreshCw size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Result Category Tabs & Mini Quick Sort Bar */}
              {!loading && !searchError && hasAnyResults && (
                <View style={styles.controlsBlock}>
                  {/* Category Tabs */}
                  <View style={styles.resultTabsRow}>
                    {(
                      [
                        {
                          key: 'ALL' as ResultTab,
                          label: `الكل (${matchingStores.length + matchingProducts.length})`,
                        },
                        {
                          key: 'STORES' as ResultTab,
                          label: `المتاجر (${matchingStores.length})`,
                        },
                        {
                          key: 'PRODUCTS' as ResultTab,
                          label: `المنتجات (${matchingProducts.length})`,
                        },
                      ]
                    ).map((tab) => {
                      const active = resultTab === tab.key;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          style={[
                            styles.resultTabPill,
                            {
                              backgroundColor: active
                                ? theme.primary
                                : theme.isDark
                                ? theme.surfaceSecondary
                                : '#F3F4F6',
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setResultTab(tab.key)}
                        >
                          <Text
                            style={[
                              styles.resultTabText,
                              { color: active ? '#FFFFFF' : theme.textSecondary },
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Mini Quick Sort Bar */}
                  {matchingStores.length > 0 && resultTab !== 'PRODUCTS' && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sortBarRow}
                    >
                      {(
                        [
                          { key: 'nearest' as SortOption, label: 'الأقرب' },
                          { key: 'rating' as SortOption, label: 'الأعلى تقييماً' },
                          { key: 'delivery_fee' as SortOption, label: 'الأقل توصيلاً' },
                        ]
                      ).map((opt) => {
                        const active = sortBy === opt.key;
                        return (
                          <TouchableOpacity
                            key={opt.key}
                            style={[
                              styles.sortPill,
                              {
                                backgroundColor: active
                                  ? theme.primaryLight
                                  : theme.isDark
                                  ? theme.surfaceSecondary
                                  : '#F8FAFC',
                              },
                            ]}
                            activeOpacity={0.78}
                            onPress={() => setSortBy(active ? 'default' : opt.key)}
                          >
                            <Text
                              style={[
                                styles.sortPillText,
                                { color: active ? theme.primary : theme.textSecondary },
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Matching Stores Section */}
              {showStoresSection && (
                <View style={styles.resultsSection}>
                  <View style={styles.sectionTitleRow}>
                    <Store size={17} color={theme.primary} strokeWidth={1.9} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      المتاجر والشركاء ({sortedStores.length})
                    </Text>
                  </View>

                  <View style={styles.resultsList}>
                    {sortedStores.map((restaurant, idx) =>
                      renderStoreRow(restaurant, idx, sortedStores.length)
                    )}
                  </View>
                </View>
              )}

              {/* Matching Products Section */}
              {showProductsSection && (
                <View
                  style={[
                    styles.resultsSection,
                    { marginTop: showStoresSection ? 16 : 0 },
                  ]}
                >
                  <View style={styles.sectionTitleRow}>
                    <ShoppingBag size={17} color={theme.primary} strokeWidth={1.9} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      المنتجات والأصناف ({matchingProducts.length})
                    </Text>
                  </View>

                  <View style={styles.productsList}>
                    {matchingProducts.map((product, idx) => (
                      <Animated.View
                        key={product.id || idx}
                        entering={FadeInUp.delay(Math.min(idx, 8) * 30)}
                      >
                        <FoodItemCard
                          item={product}
                          containerStyle={styles.productCardNoMargin}
                          showRestaurantLink={true}
                        />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              )}

              {/* Empty Filtered Tab State */}
              {!loading && !searchError && hasAnyResults && !showStoresSection && !showProductsSection && (
                <View style={styles.stateBox}>
                  <Text style={[styles.stateTitle, { color: theme.text }]}>
                    {resultTab === 'STORES' ? 'لا توجد متاجر مطابقة' : 'لا توجد منتجات مطابقة'}
                  </Text>
                  <Text style={[styles.stateSub, { color: theme.textSecondary }]}>
                    {resultTab === 'STORES'
                      ? 'توجد نتائج في تبويب المنتجات، يمكنك عرضها الآن.'
                      : 'توجد نتائج في تبويب المتاجر، يمكنك عرضها الآن.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setResultTab('ALL')}
                  >
                    <Text style={styles.retryBtnText}>عرض جميع النتائج</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* No Results Found */}
              {!loading && !searchError && !hasAnyResults && searchQuery.trim().length > 0 && (
                <Animated.View entering={FadeIn} style={styles.stateBox}>
                  <View style={[styles.stateIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
                    <Search size={30} color={theme.textMuted} strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.stateTitle, { color: theme.text }]}>
                    لا توجد نتائج مطابقة
                  </Text>
                  <Text style={[styles.stateSub, { color: theme.textSecondary }]}>
                    لم نجد متاجر أو منتجات تطابق &ldquo;{searchQuery}&rdquo; في نطاق {activeAreaLabel}، جرب كلمة أخرى أو استعرض المتاجر المتاحة بالمنطقة.
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                    activeOpacity={0.85}
                    onPress={handleClearSearch}
                  >
                    <Text style={styles.retryBtnText}>استعراض متاجر المنطقة</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          )}

          {/* ── 3. ZERO STATE: RECENT SEARCHES HISTORY ── */}
          {isZeroState && history.length > 0 && (
            <Animated.View entering={FadeInUp.delay(40)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Clock size={16} color={theme.textSecondary} strokeWidth={1.9} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    عمليات البحث الأخيرة
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearHistory}
                  style={styles.clearHistoryBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="مسح سجل البحث كاملاً"
                >
                  <Trash size={13} color={theme.textMuted} />
                  <Text style={[styles.clearHistoryText, { color: theme.textMuted }]}>
                    مسح السجل
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.recentChipsContainer}>
                {history.map((term, index) => (
                  <View
                    key={`${term}-${index}`}
                    style={[
                      styles.recentChip,
                      { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F5F6F8' },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.recentChipMain}
                      activeOpacity={0.75}
                      onPress={() => handleExecuteSearch(term)}
                    >
                      <Clock size={12} color={theme.textMuted} />
                      <Text style={[styles.recentChipText, { color: theme.text }]}>{term}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeSearchTerm(term)}
                      style={styles.removeChipBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`حذف ${term} من السجل`}
                    >
                      <X size={12} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── 4. REAL AREA-SCOPED STORES & PRODUCTS (Zero State, Zero Dummy Data) ── */}
          {isZeroState && (
            <View>
              {history.length > 0 && (
                <View style={[styles.sectionDivider, { backgroundColor: theme.borderSubtle }]} />
              )}

              {loadingAreaData && (
                <View style={styles.skeletonContainer}>
                  {[0, 1, 2].map((idx) => (
                    <View
                      key={`area-sk-${idx}`}
                      style={[
                        styles.skeletonStoreCard,
                        { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F8FAFC' },
                      ]}
                    >
                      <View style={[styles.skeletonThumb, { backgroundColor: theme.backgroundSelected }]} />
                      <View style={styles.skeletonLines}>
                        <View style={[styles.skeletonLine, { width: '58%', height: 14, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '36%', height: 11, backgroundColor: theme.backgroundSelected }]} />
                        <View style={[styles.skeletonLine, { width: '74%', height: 11, backgroundColor: theme.backgroundSelected }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!loadingAreaData && areaError && (
                <View style={styles.stateBox}>
                  <View style={[styles.stateIconWrap, { backgroundColor: theme.errorLight }]}>
                    <AlertCircle size={28} color={theme.error} strokeWidth={1.75} />
                  </View>
                  <Text style={[styles.stateTitle, { color: theme.text }]}>
                    تعذر تحميل متاجر المنطقة
                  </Text>
                  <Text style={[styles.stateSub, { color: theme.textSecondary }]}>
                    {areaError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                    activeOpacity={0.85}
                    onPress={fetchAreaDiscovery}
                  >
                    <RefreshCw size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!loadingAreaData && !areaError && areaStores.length === 0 && areaProducts.length === 0 && (
                <View style={styles.stateBox}>
                  <View style={[styles.stateIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
                    <MapPin size={28} color={theme.textMuted} strokeWidth={1.6} />
                  </View>
                  <Text style={[styles.stateTitle, { color: theme.text }]}>
                    لا توجد متاجر متاحة في هذه المنطقة حالياً
                  </Text>
                  <Text style={[styles.stateSub, { color: theme.textSecondary }]}>
                    لم نجد متاجر تخدم &ldquo;{activeAreaLabel}&rdquo;{selectedSector !== 'ALL' ? ` في قسم ${currentSectorDef.shortTitle}` : ''}. يمكنك تغيير المنطقة أو اختيار قسم آخر.
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                    activeOpacity={0.85}
                    onPress={() => setShowAddressModal(true)}
                  >
                    <MapPin size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.retryBtnText}>تغيير المنطقة</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!loadingAreaData && !areaError && areaStores.length > 0 && (
                <Animated.View entering={FadeInUp.delay(60)} style={styles.resultsSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Store size={17} color={theme.primary} strokeWidth={1.9} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        متاجر تخدم {activeAreaLabel} ({areaStores.length})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.resultsList}>
                    {areaStores.map((restaurant, idx) =>
                      renderStoreRow(restaurant, idx, areaStores.length)
                    )}
                  </View>
                </Animated.View>
              )}

              {!loadingAreaData && !areaError && areaProducts.length > 0 && (
                <Animated.View
                  entering={FadeInUp.delay(100)}
                  style={[styles.resultsSection, { marginTop: areaStores.length > 0 ? 12 : 0 }]}
                >
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <ShoppingBag size={17} color={theme.primary} strokeWidth={1.9} />
                      <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        أصناف متوفرة في منطقتك ({areaProducts.length})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productsList}>
                    {areaProducts.slice(0, 12).map((product, idx) => (
                      <Animated.View
                        key={product.id || idx}
                        entering={FadeInUp.delay(Math.min(idx, 6) * 25)}
                      >
                        <FoodItemCard
                          item={product}
                          containerStyle={styles.productCardNoMargin}
                          showRestaurantLink={true}
                        />
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </View>
          )}
        </ScrollView>

        <AddressSelectorModal
          visible={showAddressModal}
          onClose={() => setShowAddressModal(false)}
        />

        {/* ── Floating Bottom Cart Summary Bar ── */}
        {totalCartItems > 0 && (
          <View style={styles.floatingCartWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.floatingCartBar, { backgroundColor: theme.primary }]}
              activeOpacity={0.9}
              onPress={() => router.push('/(tabs)/carts' as any)}
            >
              <View style={styles.floatingCartStart}>
                <View style={styles.floatingCartBadge}>
                  <Text style={[styles.floatingCartBadgeText, { color: theme.primary }]}>
                    {totalCartItems}
                  </Text>
                </View>
                <View style={styles.floatingCartTextCol}>
                  <Text style={styles.floatingCartTitle}>عرض السلة</Text>
                  {cartRestaurantName ? (
                    <Text style={styles.floatingCartSub} numberOfLines={1}>
                      {cartRestaurantName}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.floatingCartTotal}>{formatCurrency(totalCartPrice)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    position: 'relative',
  },
  centerLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 0,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Tajawal_500Medium',
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active Delivery Area Tracker
  areaBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  areaBarStart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginEnd: 8,
  },
  areaBarLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'right',
    flexShrink: 1,
  },
  areaBarValue: {
    fontFamily: 'Tajawal_700Bold',
  },
  areaBarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  areaBarChangeText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },

  // Clean Sector Filter Strip
  sectorBarWrapper: {
    flexGrow: 0,
  },
  sectorBarContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
  },
  sectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 0,
  },
  sectorChipText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 12,
  },
  hairlineDivider: {
    height: 0.5,
    width: '100%',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  scrollContentWithCart: {
    paddingBottom: 96,
  },

  // ── Autocomplete Suggestions ──
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  suggestionsHeaderText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  suggestionsList: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'space-between',
  },
  suggestionMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  suggestionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextBox: {
    flex: 1,
    alignItems: 'flex-start',
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    textAlign: 'right',
  },
  suggestionSubtitle: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    marginTop: 2,
    textAlign: 'right',
  },
  suggestionArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 6,
  },

  // ── Skeleton Loading ──
  skeletonContainer: {
    gap: 12,
    paddingTop: 4,
  },
  skeletonTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  skeletonPill: {
    height: 34,
    borderRadius: 17,
  },
  skeletonStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    gap: 12,
  },
  skeletonThumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
    alignItems: 'flex-start',
  },
  skeletonLine: {
    borderRadius: 6,
  },
  skeletonProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    gap: 12,
  },
  skeletonProdThumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
  },

  // ── Results Controls (Tabs & Sort) ──
  controlsBlock: {
    marginBottom: 16,
    gap: 10,
  },
  resultTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  resultTabText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  sortBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortPillText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },

  // ── Results ──
  resultsSection: {
    marginBottom: 20,
  },
  resultsList: {
    marginTop: 8,
  },
  productsList: {
    marginTop: 8,
  },
  productCardNoMargin: {
    marginHorizontal: 0,
    marginVertical: 5,
  },
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderWidth: 0,
    gap: 14,
  },
  restaurantImg: {
    width: 68,
    height: 68,
    borderRadius: 16,
  },
  restaurantInfoCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  restaurantHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  restaurantNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restaurantName: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
    flexShrink: 1,
  },
  busyBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  busyBadgeText: {
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
    color: '#DC2626',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#D97706',
  },
  ratingCountText: {
    fontSize: 10,
    fontFamily: 'Tajawal_400Regular',
  },
  sectorPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  sectorPillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  metaDivider: {
    fontSize: 10,
  },

  // ── Empty / Error States ──
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'center',
  },
  stateSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },

  // ── Sections & Zero State Discovery ──
  section: {
    marginBottom: 24,
  },
  sectionDivider: {
    height: 0.5,
    width: '100%',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  clearHistoryText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  recentChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  recentChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentChipText: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13,
  },
  removeChipBtn: {
    padding: 2,
    borderRadius: 10,
  },

  // Floating Bottom Cart Summary Bar
  floatingCartWrap: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  floatingCartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 26,
    height: 54,
    paddingHorizontal: 18,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingCartStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginEnd: 12,
  },
  floatingCartBadge: {
    backgroundColor: '#FFFFFF',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBadgeText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  floatingCartTextCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  floatingCartTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  floatingCartSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
  },
  floatingCartTotal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
});
