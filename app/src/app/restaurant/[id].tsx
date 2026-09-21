import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Restaurant, FoodItem } from '../../types/models';
import { restaurantService, sanitizeImageUrl } from '../../services/restaurantService';
import { FoodItemCard } from '../../components/FoodItemCard';
import { ArrowLeft, Star, Clock, Bike } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { Colors } from '../../constants/theme';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
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
            image: sanitizeImageUrl(r.cover_image) || sanitizeImageUrl(r.logo) || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop',
            isBusy: r.is_busy,
          });
        }

        if (isMounted && menuRes.data) {
          const items: FoodItem[] = [];
          menuRes.data.forEach((cat) => {
            (cat.items || []).forEach((item) => {
              items.push({
                id: item.id,
                name: item.name,
                description: item.description || '',
                price: Number(item.base_price) || 0,
                image: sanitizeImageUrl(item.image) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop',
              });
            });
          });
          setMenuItems(items);
        }
      } catch {
        // leave restaurant null → error screen will show
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

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
        {/* Cover Image & Back Button */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: restaurant?.image || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=600&auto=format&fit=crop' }}
            style={styles.coverImage}
          />
          <SafeAreaView style={styles.backButtonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft color="#1F2937" size={24} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
        
        {/* Restaurant Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{restaurant?.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Star size={16} color="#FFB800" fill="#FFB800" />
              <Text style={styles.statText}>{restaurant?.rating?.toFixed(1) || '4.8'}</Text>
            </View>
            <View style={styles.statPill}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.statText}>{restaurant?.deliveryTime || '٢٥ دقيقة'}</Text>
            </View>
            <View style={styles.statPill}>
              <Bike size={16} color="#6B7280" />
              <Text style={styles.statText}>توصيل: {restaurant?.deliveryFee || 12} ر.س</Text>
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>قائمة الطعام</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} />
          ) : menuItems.length > 0 ? (
            menuItems.map((item) => (
              <FoodItemCard key={item.id} item={item} />
            ))
          ) : (
            <Text style={styles.emptyMenuText}>لا توجد وجبات متاحة في القائمة حالياً.</Text>
          )}
        </View>
      </ScrollView>

      {/* Floating Checkout Button */}
      {totalItems > 0 && (
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push('/(tabs)/carts')} activeOpacity={0.9}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.checkoutText}>عرض السلة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 100 },
  imageContainer: { position: 'relative' },
  coverImage: { width: '100%', height: 250 },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 8, borderBottomColor: '#F3F4F6' },
  name: { fontSize: 24, fontFamily: 'Tajawal_700Bold', color: '#1F2937', marginBottom: 12, textAlign: 'left' },
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statText: { fontSize: 13, fontFamily: 'Tajawal_500Medium', color: '#4B5563' },
  menuContainer: { padding: 16 },
  menuTitle: { fontSize: 20, fontFamily: 'Tajawal_700Bold', color: '#1F2937', marginBottom: 16, textAlign: 'left' },
  emptyMenuText: { fontSize: 14, fontFamily: 'Tajawal_400Regular', color: '#9CA3AF', textAlign: 'center', marginVertical: 20 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  error: { fontSize: 16, fontFamily: 'Tajawal_700Bold', color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  backHomeBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  backHomeText: { color: '#FFFFFF', fontFamily: 'Tajawal_700Bold', fontSize: 14 },
  checkoutBtn: {
    position: 'absolute', bottom: 32, left: 24, right: 24, backgroundColor: Colors.light.primary,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 56, borderRadius: 28,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  checkoutText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Tajawal_700Bold' },
  cartBadge: { position: 'absolute', left: 20, backgroundColor: '#FFFFFF', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: Colors.light.primary, fontFamily: 'Tajawal_700Bold', fontSize: 14 }
});
