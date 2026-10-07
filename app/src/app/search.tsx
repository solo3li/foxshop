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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Clock, TrendingUp, X, Star, MapPin } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInRight, FadeIn } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { restaurantService, BackendRestaurant } from '../services/restaurantService';
import { SearchBackSvg } from '../components/NavigationIcons';

const RECENT_SEARCHES = ['شاورما', 'بيتزا', 'برجر كينج', 'كنتاكي', 'قهوة مختصة', 'حلويات'];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<BackendRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus input automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Debounced search query
  const executeSearch = useCallback(async (query: string) => {
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await restaurantService.getRestaurants({ q: clean });
      if (res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('[Search] Failed to fetch search results:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        executeSearch(searchQuery);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery, executeSearch]);

  const handleChipClick = (term: string) => {
    setSearchQuery(term);
    executeSearch(term);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* ── Search Header ── */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.75}
          accessibilityLabel="رجوع"
        >
          <SearchBackSvg size={22} color="#1F2937" />
        </TouchableOpacity>

        {/* Input Bar */}
        <View style={styles.searchBar}>
          <Search size={19} color="#FF2E7E" />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { outlineStyle: 'none' } as any]}
            placeholder="ابحث عن مطاعم، وجبات، أصناف..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => executeSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setResults([]);
                setSearched(false);
              }}
              style={styles.clearBtn}
            >
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#FF2E7E" />
            <Text style={styles.loadingText}>جارٍ البحث في المطاعم والوجبات...</Text>
          </View>
        )}

        {/* ── Results List ── */}
        {!loading && searched && results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>
              نتائج البحث ({results.length})
            </Text>

            <View style={styles.resultsList}>
              {results.map((restaurant, idx) => (
                <Animated.View
                  key={restaurant.id || idx}
                  entering={FadeInUp.delay(idx * 40)}
                >
                  <TouchableOpacity
                    style={styles.restaurantCard}
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
                        <Text style={styles.restaurantName} numberOfLines={1}>
                          {restaurant.name}
                        </Text>
                        <View style={styles.ratingBadge}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <Text style={styles.ratingText}>
                            {restaurant.rating || '4.8'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.restaurantCategory} numberOfLines={1}>
                        {restaurant.description || 'مطعم ومأكولات مميزة'}
                      </Text>

                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Clock size={12} color="#6B7280" />
                          <Text style={styles.metaText}>
                            {restaurant.estimated_prep_time_minutes ? `${restaurant.estimated_prep_time_minutes} دقيقة` : '25-35 دقيقة'}
                          </Text>
                        </View>
                        <Text style={styles.metaDivider}>•</Text>
                        <View style={styles.metaItem}>
                          <MapPin size={12} color="#6B7280" />
                          <Text style={styles.metaText}>
                            توصيل: {restaurant.delivery_fee ? `${restaurant.delivery_fee} ${restaurant.currency || 'ر.س'}` : 'مجاني'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* ── No Results Found ── */}
        {!loading && searched && results.length === 0 && searchQuery.trim().length > 0 && (
          <Animated.View entering={FadeIn} style={styles.noResultsBox}>
            <Text style={styles.noResultsEmoji}>🔍</Text>
            <Text style={styles.noResultsTitle}>لا توجد نتائج مطابقة</Text>
            <Text style={styles.noResultsSub}>
              لم نجد مطاعم أو وجبات تطابق &ldquo;{searchQuery}&rdquo;، جرب كلمات أخرى أو تصفح الأقسام الشائعة.
            </Text>
          </Animated.View>
        )}

        {/* ── Recent Searches ── */}
        {(!searched || results.length === 0) && (
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>عمليات البحث السابقة 🕒</Text>
            </View>
            <View style={styles.chipsContainer}>
              {RECENT_SEARCHES.map((item, index) => (
                <Animated.View key={index} entering={FadeInRight.delay(index * 30)}>
                  <TouchableOpacity
                    style={styles.chip}
                    activeOpacity={0.75}
                    onPress={() => handleChipClick(item)}
                  >
                    <Clock size={13} color="#9CA3AF" />
                    <Text style={styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Trending Categories ── */}
        {(!searched || results.length === 0) && (
          <Animated.View entering={FadeInUp.delay(180)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الأصناف الأكثر طلباً 🔥</Text>
              <TrendingUp size={18} color="#FF2E7E" />
            </View>
            <View style={styles.trendingGrid}>
              {TRENDING_CATEGORIES.map((category, index) => (
                <Animated.View
                  key={category.id}
                  entering={FadeInUp.delay(180 + index * 40)}
                  style={{ width: '48%' }}
                >
                  <TouchableOpacity
                    style={styles.trendingCard}
                    activeOpacity={0.85}
                    onPress={() => handleChipClick(category.query)}
                  >
                    <Image source={{ uri: category.image }} style={styles.trendingImage} />
                    <Text style={styles.trendingText}>{category.name}</Text>
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Tajawal_500Medium',
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  clearBtn: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
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
    color: '#6B7280',
  },

  // Results
  resultsSection: {
    marginBottom: 20,
  },
  resultsList: {
    gap: 12,
    marginTop: 12,
  },
  restaurantCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    gap: 12,
  },
  restaurantImg: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
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
    color: '#111827',
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
  restaurantCategory: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
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
    color: '#6B7280',
  },
  metaDivider: {
    color: '#D1D5DB',
    fontSize: 10,
  },

  // No Results
  noResultsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noResultsEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noResultsTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  noResultsSub: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  // Sections
  section: {
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  chipsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipText: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13,
    color: '#374151',
  },
  trendingGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  trendingCard: {
    backgroundColor: '#FFF1F5',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  trendingImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  trendingText: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 13,
    color: '#FF2E7E',
  },
});
