import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { restaurants } from '../../constants/dummyData';
import { FoodItemCard } from '../../components/FoodItemCard';
import { ArrowLeft, Star, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const restaurant = restaurants.find((r) => r.id === id);
  const cartItems = useCartStore((state) => state.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!restaurant) {
    return <Text style={styles.error}>Restaurant not found!</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: restaurant.image }} style={styles.coverImage} />
          <SafeAreaView style={styles.backButtonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft color="#1F2937" size={24} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Star size={16} color="#FFB800" fill="#FFB800" />
              <Text style={styles.statText}>{restaurant.rating}</Text>
            </View>
            <View style={styles.statPill}>
              <Clock size={16} color="#6B7280" />
              <Text style={styles.statText}>{restaurant.deliveryTime}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>Delivery: ${restaurant.deliveryFee}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Menu</Text>
          {restaurant.menu.map((item) => (
            <FoodItemCard key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>

      {totalItems > 0 && (
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push('/carts')}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.checkoutText}>View Cart</Text>
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
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  infoContainer: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 8, borderBottomColor: '#F3F4F6' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  menuContainer: { padding: 16 },
  menuTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  error: { flex: 1, textAlign: 'center', marginTop: 100, fontSize: 18 },
  checkoutBtn: {
    position: 'absolute', bottom: 32, left: 24, right: 24, backgroundColor: '#FF5A00',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 56, borderRadius: 28,
    shadowColor: '#FF5A00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  checkoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  cartBadge: { position: 'absolute', left: 20, backgroundColor: '#FFFFFF', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#FF5A00', fontWeight: 'bold', fontSize: 14 }
});
