import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Header } from '../../components/Header';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { categories, restaurants } from '../../constants/dummyData';
import { useCartStore } from '../../store/cartStore';
import { useRouter } from 'expo-router';
import { ChevronRight, X, Clock } from 'lucide-react-native';

const banners = [
  { id: '1', title: 'RM10 off', subtitle: 'code FOX10', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2940&auto=format&fit=crop' },
  { id: '2', title: 'Fresh Brew Series', subtitle: 'From RM9.90', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop' },
];

export default function HomeScreen() {
  const [selectedCategory, setSelectedCategory] = React.useState(categories[0].id);
  const [showPromo, setShowPromo] = React.useState(true);
  const cartItems = useCartStore((state) => state.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Header />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.bodyContainer}>
          
          {/* Services Row */}
          <View style={styles.servicesRow}>
            {['Offers', 'foxmart', "Fox's", 'Health', 'New'].map((item, index) => (
              <TouchableOpacity key={index} style={styles.serviceItem}>
                <View style={styles.serviceIconPlaceholder}>
                  <Text style={styles.serviceIconText}>🦊</Text>
                </View>
                <Text style={styles.serviceText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cuisines Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {categories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                isSelected={selectedCategory === cat.id}
                onPress={() => setSelectedCategory(cat.id)}
              />
            ))}
          </ScrollView>

          {/* Promo Banners */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bannersList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {banners.map((banner) => (
              <View key={banner.id} style={styles.bannerCard}>
                <Image source={{ uri: banner.image }} style={styles.bannerImage} />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>{banner.subtitle}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Section: Popular Restaurants */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Restaurants</Text>
            <TouchableOpacity style={styles.chevronBtn}>
              <ChevronRight size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} horizontal />
            ))}
          </ScrollView>

          {/* Section: Top Shops */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorite local restaurants</Text>
            <TouchableOpacity style={styles.chevronBtn}>
              <ChevronRight size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {restaurants.slice().reverse().map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </View>

        </View>
      </ScrollView>

      {/* Floating Flash Deal */}
      {showPromo && (
        <View style={styles.floatingPromo}>
          <View style={styles.promoIconContainer}>
            <Clock size={24} color="#FF5A00" />
          </View>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoMainText}>Save 25%</Text>
            <Text style={styles.promoSubText}>Flash Deals: limited time offers</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>42 : 20</Text>
          </View>
          <TouchableOpacity onPress={() => setShowPromo(false)} style={styles.closeBtn}>
            <X size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF5A00', // To match Header top
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -16, // Overlaps the header slightly
    minHeight: '100%',
  },
  bodyContainer: {
    paddingTop: 16,
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
  },
  serviceIconText: {
    fontSize: 24,
  },
  serviceText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '900',
    marginBottom: 4,
  },
  bannerBadge: {
    backgroundColor: '#FF5A00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
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
    backgroundColor: '#FFF0E5', // Light orange to match the foodpanda pink promo box
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  promoIconContainer: {
    marginRight: 12,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoMainText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2937',
  },
  promoSubText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D70F64', // Keep a bit of red/dark pink for urgency, or use #B43609
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
    fontWeight: 'bold',
    fontSize: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  }
});
