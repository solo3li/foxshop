import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  Clock,
  TrendingUp,
  X,
  Star,
  MapPin,
  Store,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  Trash,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeInRight, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../hooks/use-theme';
import { CURRENCY, normalizeArabic } from '../constants/config';
import { SECTORS, SECTOR_KEYS, SectorKey, STORE_TYPE_LABELS } from '../constants/sectors';
import { FoodItemCard } from '../components/FoodItemCard';
import { FoodItem } from '../types/models';
import {
  restaurantService,
  BackendRestaurant,
  mapBackendMenuItemToFoodItem,
} from '../services/restaurantService';
import { useAddressStore } from '../store/addressStore';
import { useSearchHistoryStore } from '../store/searchHistoryStore';
import { SearchBackSvg } from '../components/NavigationIcons';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'store' | 'product' | 'category' | 'query';
  subtitle?: string;
}

const COMMON_STAPLES = [
  { id: 'staple_1', title: 'حليب', icon: '🥛', query: 'حليب' },
  { id: 'staple_2', title: 'أدوية', icon: '💊', query: 'أدوية' },
  { id: 'staple_3', title: 'بيتزا', icon: '🍕', query: 'بيتزا' },
  { id: 'staple_4', title: 'خضار', icon: '🥦', query: 'خضار' },
];

const TRENDING_CATEGORIES = [
  { id: '1', name: 'وجبات سريعة', query: 'برجر', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop' },
  { id: '2', name: 'بيتزا وفطائر', query: 'بيتزا', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=200&auto=format&fit=crop' },
  { id: '3', name: 'حلويات', query: 'حلى', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=200&auto=format&fit=crop' },
  { id: '4', name: 'مشروبات وقهوة', query: 'قهوة', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=200&auto=format&fit=crop' },
  { id: '5', name: 'مشاوي وشاورما', query: 'شاورما', image: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?q=80&w=200&auto=format&fit=crop' },
  { id: '6', name: 'صحي ودايت', query: 'صحي', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=200&auto=format&fit=crop' },
];

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const selectedAddress = useAddressStore((state) => state.selectedAddress);

  // Search History Store
  const history = useSearchHistoryStore((state) => state.history);
  const loadHistory = useSearchHistoryStore((state) => state.loadHistory);
  const addSearchTerm = useSearchHistoryStore((state) => state.addSearchTerm);
  const removeSearchTerm = useSearchHistoryStore((state) => state.removeSearchTerm);
  const clearHistory = useSearchHistoryStore((state) => state.clearHistory);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<SectorKey>('ALL');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Full search results state (only activated on submit or suggestion click)
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);
  const [matchingStores, setMatchingStores] = useState<BackendRestaurant[]>([]);
  const [matchingProducts, setMatchingProducts] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const hasExecutedSearchRef = useRef(false);
  const activeRequestIdRef = useRef(0);

  // Focus input automatically and load history on mount
  useEffect(() => {
    loadHistory();
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  // Keep ref in sync
  useEffect(() => {
    hasExecutedSearchRef.current = hasExecutedSearch;
  }, [hasExecutedSearch]);

  // Instant local suggestions from history, staples, and categories
  const getLocalSuggestions = useCallback(
    (query: string): SearchSuggestion[] => {
      const normQuery = normalizeArabic(query);
      if (!normQuery) return [];

      const list: SearchSuggestion[] = [];

      // History matches
      history
        .filter((h) => normalizeArabic(h).includes(normQuery))
        .forEach((h) => {
          list.push({
            id: `hist_${h}`,
            text: h,
            type: 'history',
            subtitle: 'بحث سابق',
          });
        });

      // Common staples matches
      COMMON_STAPLES.filter(
        (s) =>
          normalizeArabic(s.title).includes(normQuery) ||
          normalizeArabic(s.query).includes(normQuery)
      ).forEach((s) => {
        list.push({
          id: `staple_${s.id}`,
          text: s.title,
          type: 'category',
          subtitle: 'صنف شائع',
        });
      });

      // Trending categories matches
      TRENDING_CATEGORIES.filter(
        (c) =>
          normalizeArabic(c.name).includes(normQuery) ||
          normalizeArabic(c.query).includes(normQuery)
      ).forEach((c) => {
        list.push({
          id: `trend_${c.id}`,
          text: c.name,
          type: 'category',
          subtitle: 'فئة شائعة',
        });
      });

      // Deduplicate local matches
      const seen = new Set<string>();
      const deduped: SearchSuggestion[] = [];
      for (const item of list) {
        const normKey = normalizeArabic(item.text);
        if (!seen.has(normKey)) {
          seen.add(normKey);
          deduped.push(item);
        }
      }
      return deduped;
    },
    [history]
  );

  // Handle typing: resets full results so suggestions appear
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
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

        // Abort if request is outdated or full search was executed or input changed
        if (
          requestId !== activeRequestIdRef.current ||
          hasExecutedSearchRef.current ||
          searchQuery.trim() !== clean
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

        // Combine local + remote, deduplicating via Arabic normalization
        const combined = [...local, ...remoteSuggestions];
        const seen = new Set<string>();
        const deduped: SearchSuggestion[] = [];

        for (const item of combined) {
          const normKey = normalizeArabic(item.text);
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

  // Full search execution (triggered exclusively on Enter/Submit or direct suggestion click)
  const handleExecuteSearch = useCallback(
    async (term: string, sector: SectorKey = selectedSector) => {
      const clean = term.trim();
      if (!clean) return;

      activeRequestIdRef.current++;
      Keyboard.dismiss();
      hasExecutedSearchRef.current = true;
      setHasExecutedSearch(true);
      setSearchQuery(clean);
      setSuggestions([]);
      setLoadingSuggestions(false);
      addSearchTerm(clean);

      setLoading(true);
      try {
        const storeTypeParam = sector !== 'ALL' ? sector : undefined;
        const res = await restaurantService.searchUniversal(clean, {
          store_type: storeTypeParam,
          lat: selectedAddress?.latitude,
          lng: selectedAddress?.longitude,
        });

        if (res.data) {
          const stores = res.data.stores || [];
          const rawProducts = res.data.products || res.data.items || [];
          const products = rawProducts.map((p) =>
            mapBackendMenuItemToFoodItem(p, p.restaurant_id)
          );
          setMatchingStores(stores);
          setMatchingProducts(products);
        } else {
          const fallbackRes = await restaurantService.getRestaurants({
            q: clean,
            store_type: storeTypeParam,
            lat: selectedAddress?.latitude,
            lng: selectedAddress?.longitude,
          });
          setMatchingStores(fallbackRes.data || []);
          setMatchingProducts([]);
        }
      } catch (err) {
        console.error('[Search] Failed to fetch search results:', err);
        try {
          const fallbackRes = await restaurantService.getRestaurants({
            q: clean,
            store_type: sector !== 'ALL' ? sector : undefined,
            lat: selectedAddress?.latitude,
            lng: selectedAddress?.longitude,
          });
          setMatchingStores(fallbackRes.data || []);
          setMatchingProducts([]);
        } catch {
          setMatchingStores([]);
          setMatchingProducts([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedSector, selectedAddress, addSearchTerm]
  );

  // Complete query into search input without executing full search
  const handleFillSuggestion = (text: string) => {
    setSearchQuery(text);
    hasExecutedSearchRef.current = false;
    setHasExecutedSearch(false);
    inputRef.current?.focus();
  };

  // Sector filter change
  const handleSectorSelect = (key: SectorKey) => {
    setSelectedSector(key);
    if (hasExecutedSearch && searchQuery.trim().length > 0) {
      handleExecuteSearch(searchQuery, key);
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    activeRequestIdRef.current++;
    setSearchQuery('');
    hasExecutedSearchRef.current = false;
    setHasExecutedSearch(false);
    setSuggestions([]);
    setLoadingSuggestions(false);
    setMatchingStores([]);
    setMatchingProducts([]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const hasAnyResults = matchingStores.length > 0 || matchingProducts.length > 0;
  const isTypingMode = !hasExecutedSearch && searchQuery.trim().length > 0;
  const isZeroState = !hasExecutedSearch && searchQuery.trim().length === 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Search Header ── */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          activeOpacity={0.75}
          accessibilityLabel="رجوع"
        >
          <SearchBackSvg size={22} color={theme.text} />
        </TouchableOpacity>

        {/* Input Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
          <Search size={19} color={theme.primary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text, outlineStyle: 'none' } as any]}
            placeholder="ابحث عن المتاجر، المطاعم، المنتجات والوجبات..."
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
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Sector Filter Bar (6 Sectors + All) ── */}
      <View style={styles.sectorBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectorBarContent}
        >
          {SECTOR_KEYS.map((key) => {
            const sec = SECTORS[key];
            const isSelected = selectedSector === key;
            return (
              <TouchableOpacity
                key={sec.id}
                style={[
                  styles.sectorChip,
                  {
                    backgroundColor: isSelected
                      ? theme.primary
                      : theme.isDark
                      ? theme.surfaceSecondary
                      : '#F3F4F6',
                    borderColor: isSelected ? theme.primary : 'transparent',
                  },
                ]}
                onPress={() => handleSectorSelect(key)}
                activeOpacity={0.8}
              >
                <Text style={styles.sectorEmoji}>{sec.emoji}</Text>
                <Text
                  style={[
                    styles.sectorChipText,
                    { color: isSelected ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {sec.shortTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. AUTOCOMPLETE SUGGESTIONS DROPDOWN (While typing) ── */}
        {isTypingMode && (
          <Animated.View entering={FadeIn.duration(150)} style={styles.suggestionsContainer}>
            <View style={styles.suggestionsHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={16} color={theme.primary} strokeWidth={2} />
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
                    {
                      borderBottomColor:
                        idx === suggestions.length - 1
                          ? 'transparent'
                          : theme.isDark
                          ? '#262626'
                          : '#F3F4F6',
                    },
                  ]}
                >
                  {/* Main touchable area -> Executes full search */}
                  <TouchableOpacity
                    style={styles.suggestionMainArea}
                    activeOpacity={0.7}
                    onPress={() => handleExecuteSearch(item.text)}
                  >
                    {/* Right Icon in RTL */}
                    <View
                      style={[
                        styles.suggestionIconBox,
                        { backgroundColor: theme.surfaceSecondary },
                      ]}
                    >
                      {item.type === 'history' ? (
                        <Clock size={16} color={theme.textMuted} />
                      ) : item.type === 'store' ? (
                        <Store size={16} color={theme.primary} />
                      ) : item.type === 'product' ? (
                        <ShoppingBag size={16} color={theme.primary} />
                      ) : (
                        <Search size={16} color={theme.textMuted} />
                      )}
                    </View>

                    {/* Suggestion Text & Subtitle */}
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

                  {/* Diagonal Arrow Icon (Left in RTL) for Query Completion into Search Input */}
                  <TouchableOpacity
                    style={[styles.suggestionArrowBtn, { backgroundColor: theme.surfaceSecondary }]}
                    activeOpacity={0.7}
                    onPress={() => handleFillSuggestion(item.text)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="إكمال الكلمة في حقل البحث"
                  >
                    <ArrowUpRight size={16} color={theme.textSecondary} />
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
                      <Search size={16} color={theme.primary} />
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
                  <View style={[styles.suggestionArrowBtn, { backgroundColor: theme.surfaceSecondary }]}>
                    <ArrowUpRight size={16} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── 2. FULL SEARCH RESULTS (Activated after Submit or Suggestion Click) ── */}
        {hasExecutedSearch && (
          <View>
            {/* Loading Indicator */}
            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  جارٍ جلب نتائج البحث في المتاجر والمنتجات...
                </Text>
              </View>
            )}

            {/* Matching Stores Section */}
            {!loading && matchingStores.length > 0 && (
              <View style={styles.resultsSection}>
                <View style={styles.sectionTitleRow}>
                  <Store size={18} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    المتاجر والشركاء المطابقة ({matchingStores.length})
                  </Text>
                </View>

                <View style={styles.resultsList}>
                  {matchingStores.map((restaurant, idx) => {
                    const sectorLabel =
                      (restaurant.store_type && STORE_TYPE_LABELS[restaurant.store_type]) || null;

                    return (
                      <Animated.View
                        key={restaurant.id || idx}
                        entering={FadeInUp.delay(idx * 35)}
                      >
                        <TouchableOpacity
                          style={[styles.restaurantCard, { backgroundColor: theme.card }]}
                          activeOpacity={0.88}
                          onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
                        >
                          <Image
                            source={{
                              uri:
                                restaurant.logo ||
                                restaurant.cover_image ||
                                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80',
                            }}
                            style={styles.restaurantImg}
                          />

                          <View style={styles.restaurantInfoCol}>
                            <View style={styles.restaurantHeaderRow}>
                              <Text
                                style={[styles.restaurantName, { color: theme.text }]}
                                numberOfLines={1}
                              >
                                {restaurant.name}
                              </Text>
                              <View style={styles.ratingBadge}>
                                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                <Text style={styles.ratingText}>
                                  {restaurant.rating || '4.8'}
                                </Text>
                              </View>
                            </View>

                            {sectorLabel && (
                              <View
                                style={[
                                  styles.sectorPill,
                                  {
                                    backgroundColor: theme.isDark
                                      ? theme.surfaceSecondary
                                      : '#F3F4F6',
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
                                  <Text style={[styles.metaDivider, { color: theme.borderSubtle }]}>
                                    •
                                  </Text>
                                  <View style={styles.metaItem}>
                                    <MapPin size={12} color={theme.textMuted} />
                                    <Text
                                      style={[styles.metaText, { color: theme.textSecondary }]}
                                    >
                                      {Number(restaurant.distance_km).toFixed(1)} كم
                                    </Text>
                                  </View>
                                </>
                              )}
                              <Text style={[styles.metaDivider, { color: theme.borderSubtle }]}>
                                •
                              </Text>
                              <View style={styles.metaItem}>
                                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                                  توصيل:{' '}
                                  {restaurant.delivery_fee
                                    ? `${restaurant.delivery_fee} ${CURRENCY}`
                                    : 'مجاني'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Matching Products Section with +/- Cart Sync */}
            {!loading && matchingProducts.length > 0 && (
              <View
                style={[
                  styles.resultsSection,
                  { marginTop: matchingStores.length > 0 ? 14 : 0 },
                ]}
              >
                <View style={styles.sectionTitleRow}>
                  <ShoppingBag size={18} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    المنتجات والأصناف المطابقة ({matchingProducts.length})
                  </Text>
                </View>

                <View style={styles.productsList}>
                  {matchingProducts.map((product, idx) => (
                    <Animated.View
                      key={product.id || idx}
                      entering={FadeInUp.delay(idx * 35)}
                    >
                      <FoodItemCard item={product} />
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}

            {/* No Results Found */}
            {!loading && !hasAnyResults && searchQuery.trim().length > 0 && (
              <Animated.View entering={FadeIn} style={styles.noResultsBox}>
                <View style={[styles.noResultsIconWrap, { backgroundColor: theme.surfaceSecondary }]}>
                  <Search size={32} color={theme.textMuted} strokeWidth={1.5} />
                </View>
                <Text style={[styles.noResultsTitle, { color: theme.text }]}>
                  لا توجد نتائج مطابقة
                </Text>
                <Text style={[styles.noResultsSub, { color: theme.textSecondary }]}>
                  لم نجد متاجر أو منتجات تطابق &ldquo;{searchQuery}&rdquo; في هذا القسم، جرب كلمات أخرى أو اختر قسماً آخر.
                </Text>
              </Animated.View>
            )}
          </View>
        )}

        {/* ── 3. ZERO STATE: RECENT SEARCHES HISTORY ── */}
        {isZeroState && history.length > 0 && (
          <Animated.View entering={FadeInUp.delay(50)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Clock size={16} color={theme.primary} strokeWidth={2} />
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
                <Animated.View key={`${term}-${index}`} entering={FadeInRight.delay(index * 25)}>
                  <View style={[styles.recentChip, { backgroundColor: theme.surfaceSecondary }]}>
                    <TouchableOpacity
                      style={styles.recentChipMain}
                      activeOpacity={0.75}
                      onPress={() => handleExecuteSearch(term)}
                    >
                      <Clock size={13} color={theme.textMuted} />
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
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── 4. COMMON STAPLES (Zero State OR When No Results) ── */}
        {(isZeroState || (hasExecutedSearch && !hasAnyResults && !loading)) && (
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={16} color={theme.primary} strokeWidth={2} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  أصناف شائعة ومقترحة
                </Text>
              </View>
            </View>
            <View style={styles.chipsContainer}>
              {COMMON_STAPLES.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInRight.delay(index * 30)}>
                  <TouchableOpacity
                    style={[styles.chip, { backgroundColor: theme.surfaceSecondary }]}
                    activeOpacity={0.75}
                    onPress={() => handleExecuteSearch(item.query)}
                  >
                    <Text style={styles.chipEmoji}>{item.icon}</Text>
                    <Text style={[styles.chipText, { color: theme.text }]}>{item.title}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── 5. TRENDING CATEGORIES (Zero State OR When No Results) ── */}
        {(isZeroState || (hasExecutedSearch && !hasAnyResults && !loading)) && (
          <Animated.View entering={FadeInUp.delay(180)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <TrendingUp size={18} color={theme.primary} strokeWidth={2} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  الأصناف الأكثر طلباً
                </Text>
              </View>
            </View>
            <View style={styles.trendingGrid}>
              {TRENDING_CATEGORIES.map((category, index) => (
                <Animated.View
                  key={category.id}
                  entering={FadeInUp.delay(180 + index * 40)}
                  style={{ width: '48%' }}
                >
                  <TouchableOpacity
                    style={[styles.trendingCard, { backgroundColor: theme.primaryLight }]}
                    activeOpacity={0.85}
                    onPress={() => handleExecuteSearch(category.query)}
                  >
                    <Image source={{ uri: category.image }} style={styles.trendingImage} />
                    <Text
                      style={[
                        styles.trendingText,
                        { color: theme.isDark ? '#FCE7F3' : theme.primary },
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 0,
    gap: 12,
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Tajawal_500Medium',
    fontSize: 14,
    textAlign: 'right',
  },
  clearBtn: {
    padding: 4,
    borderRadius: 10,
  },

  // Sector Bar
  sectorBarWrapper: {
    paddingBottom: 10,
    borderBottomWidth: 0,
  },
  sectorBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row-reverse',
  },
  sectorChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  sectorEmoji: {
    fontSize: 14,
  },
  sectorChipText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 12,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  loadingBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },

  // ── Suggestions Dropdown / List ──
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  suggestionsHeaderText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  suggestionsList: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  suggestionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  suggestionMainArea: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  suggestionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextBox: {
    flex: 1,
    alignItems: 'flex-end',
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
    marginRight: 4,
  },

  // ── Results ──
  resultsSection: {
    marginBottom: 24,
  },
  resultsList: {
    gap: 12,
    marginTop: 12,
  },
  productsList: {
    marginTop: 12,
    gap: 10,
  },
  restaurantCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    gap: 12,
  },
  restaurantImg: {
    width: 68,
    height: 68,
    borderRadius: 14,
  },
  restaurantInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  restaurantHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  restaurantName: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    flex: 1,
    textAlign: 'right',
  },
  ratingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#D97706',
  },
  sectorPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sectorPillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row-reverse',
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

  // No Results
  noResultsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noResultsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
  },
  noResultsSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  // ── Sections & History ──
  section: {
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  clearHistoryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearHistoryText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  recentChipsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  recentChipMain: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  recentChipText: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13,
  },
  removeChipBtn: {
    padding: 3,
    borderRadius: 10,
  },

  // Chips & Trending
  chipsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13,
  },
  trendingGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  trendingCard: {
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 10,
    borderWidth: 0,
  },
  trendingImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  trendingText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 13,
  },
});
