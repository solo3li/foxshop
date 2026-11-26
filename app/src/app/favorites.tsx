import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Heart,
  UtensilsCrossed,
  ShoppingBag,
  Star,
  Bike,
  Plus,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../hooks/use-theme';
import { CURRENCY, formatCurrency } from '../constants/config';
import { useFavoriteStore } from '../store/favoriteStore';
import { useCartStore } from '../store/cartStore';

export default function FavoritesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'restaurants' | 'items'>('restaurants');
  const [refreshing, setRefreshing] = useState(false);

  const {
    restaurants,
    items,
    loadFavorites,
    removeRestaurant,
    removeItem,
  } = useFavoriteStore();

  const addItemToCart = useCartStore((state) => state.addItem);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites();
    setRefreshing(false);
  };

  const totalCount = restaurants.length + items.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.surfaceSecondary }]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>المفضلة</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {totalCount > 0
              ? `${totalCount} عناصر في قائمتك المفضلة`
              : 'احتفظ بمتاجرك ومنتجاتك المفضلة هنا'}
          </Text>
        </View>
        <View style={styles.badgeWrapper}>
          <View style={[styles.countBadge, { backgroundColor: theme.primaryLight }]}>
            <Heart size={14} color={theme.primary} fill={theme.primary} />
            <Text style={[styles.countBadgeText, { color: theme.primary }]}>{totalCount}</Text>
          </View>
        </View>
      </View>

      {/* Segmented Control Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            { backgroundColor: activeTab === 'restaurants' ? theme.primary : theme.surfaceSecondary },
          ]}
          onPress={() => setActiveTab('restaurants')}
          activeOpacity={0.8}
        >
          <UtensilsCrossed
            size={16}
            color={activeTab === 'restaurants' ? '#FFFFFF' : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'restaurants' ? styles.tabButtonTextActive : { color: theme.textSecondary },
            ]}
          >
            المتاجر ({restaurants.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            { backgroundColor: activeTab === 'items' ? theme.primary : theme.surfaceSecondary },
          ]}
          onPress={() => setActiveTab('items')}
          activeOpacity={0.8}
        >
          <ShoppingBag
            size={16}
            color={activeTab === 'items' ? '#FFFFFF' : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'items' ? styles.tabButtonTextActive : { color: theme.textSecondary },
            ]}
          >
            المنتجات ({items.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* TAB 1: RESTAURANTS */}
        {activeTab === 'restaurants' && (
          <>
            {restaurants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyHeartCircle}>
                  <Heart size={44} color="#D1D5DB" />
                </View>
                <Text style={styles.emptyTitle}>لا توجد متاجر في المفضلة</Text>
                <Text style={styles.emptySubtitle}>
                  اضغط على رمز القلب في بطاقة أي متجر لإضافته إلى قائمتك وتكرار الطلب بسهولة.
                </Text>
                <TouchableOpacity
                  style={[styles.exploreBtn, { backgroundColor: theme.primary }]}
                  onPress={() => router.push('/')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exploreBtnText}>استكشف المتاجر الآن</Text>
                </TouchableOpacity>
              </View>
            ) : (
              restaurants.map((res, index) => (
                <Animated.View
                  key={res.id}
                  entering={FadeInUp.delay(index * 60).springify()}
                  style={[styles.restaurantCard, { backgroundColor: theme.card }]}
                >
                  <TouchableOpacity
                    style={styles.resCardInner}
                    onPress={() => router.push(`/restaurant/${res.id}`)}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: res.image }} style={styles.resImage} />

                    <View style={styles.resInfo}>
                      <View style={styles.resHeaderRow}>
                        <Text style={[styles.resName, { color: theme.text }]} numberOfLines={1}>
                          {res.name}
                        </Text>
                        <TouchableOpacity
                          style={styles.heartActionBtn}
                          onPress={() => removeRestaurant(res.id)}
                          activeOpacity={0.7}
                        >
                          <Heart
                            size={18}
                            color={theme.primary}
                            fill={theme.primary}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.metaRow}>
                        <View style={styles.ratingBadge}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <Text style={[styles.ratingText, { color: theme.text }]}>{res.rating.toFixed(1)}</Text>
                        </View>
                        <Text style={[styles.metaDivider, { color: theme.textMuted }]}>•</Text>
                        <View style={styles.timeBadge}>
                          <Clock size={12} color={theme.textSecondary} />
                          <Text style={[styles.timeText, { color: theme.textSecondary }]}>{res.deliveryTime}</Text>
                        </View>
                      </View>

                      <View style={styles.deliveryFeeRow}>
                        <Bike size={13} color={theme.textSecondary} />
                        <Text style={[styles.deliveryFeeText, { color: theme.textSecondary }]}>
                          التوصيل: {res.deliveryFee > 0 ? `${res.deliveryFee} ${CURRENCY}` : 'مجاني'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </>
        )}

        {/* TAB 2: MEALS */}
        {activeTab === 'items' && (
          <>
            {items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyHeartCircle, { backgroundColor: theme.surfaceSecondary }]}>
                  <Sparkles size={44} color={theme.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>لا توجد منتجات في المفضلة</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  احفظ منتجاتك المفضلة لتتمكن من إضافتها مباشرة إلى سلة التسوق بلمسة واحدة.
                </Text>
                <TouchableOpacity
                  style={[styles.exploreBtn, { backgroundColor: theme.primary }]}
                  onPress={() => router.push('/')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exploreBtnText}>تصفح المتاجر الآن</Text>
                </TouchableOpacity>
              </View>
            ) : (
              items.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInUp.delay(index * 60).springify()}
                  style={[styles.itemCard, { backgroundColor: theme.card }]}
                >
                  <Image source={{ uri: item.image }} style={styles.itemImage} />

                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.heartActionBtn}
                        onPress={() => removeItem(item.id)}
                        activeOpacity={0.7}
                      >
                        <Heart
                          size={18}
                          color={theme.primary}
                          fill={theme.primary}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.itemDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>

                    <View style={styles.itemBottomRow}>
                      <Text style={[styles.itemPrice, { color: theme.primary }]}>{formatCurrency(item.price)}</Text>
                      <TouchableOpacity
                        style={[styles.addToCartBtn, { backgroundColor: theme.primary }]}
                        onPress={() => addItemToCart(item)}
                        activeOpacity={0.8}
                      >
                        <Plus size={14} color="#FFFFFF" />
                        <Text style={styles.addToCartBtnText}>أضف للسلة</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  badgeWrapper: {
    marginLeft: 8,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  countBadgeText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#D70F64',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#D70F64',
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    paddingVertical: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyHeartCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  exploreBtn: {
    backgroundColor: '#D70F64',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  resCardInner: {
    flexDirection: 'row',
    padding: 12,
  },
  resImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  resInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  resHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  heartActionBtn: {
    padding: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  metaDivider: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryFeeText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginVertical: 3,
    textAlign: 'left',
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#D70F64',
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D70F64',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addToCartBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
