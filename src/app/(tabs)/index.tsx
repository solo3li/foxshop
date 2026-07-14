import React, { useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Animated, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { categories, restaurants } from '../../constants/dummyData';
import { useCartStore } from '../../store/cartStore';
import { useRouter } from 'expo-router';
import { ChevronRight, X, Clock, MapPin, Heart, Search, Percent, ShoppingBag, Coffee, Star } from 'lucide-react-native';

const banners = [
  { id: '1', title: 'RM10 off', subtitle: 'code FOX10', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2940&auto=format&fit=crop' },
  { id: '2', title: 'Fresh Brew Series', subtitle: 'From RM9.90', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = React.useState(categories[0].id);
  const [showPromo, setShowPromo] = React.useState(true);
  
  // Animation value for scrolling
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animate opacity of promo text and location based on scroll position
  const promoOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      
      {/* Orange Background Layer (Static behind the scroll) */}
      <View style={[styles.absoluteHeader, { height: 260 + insets.top }]} />

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
        <Animated.View style={[styles.locationRow, { paddingTop: insets.top + 10, opacity: promoOpacity }]}>
          <TouchableOpacity style={styles.locationContainer}>
            <MapPin size={24} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.locationTitle}>Home - 123 Fox Street</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Heart size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* 1. Sticky Search Bar Container */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput 
              placeholder="Search for shops & restaurants" 
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
              editable={false}
            />
          </View>
        </View>

        {/* 2. Promo Row */}
        <Animated.View style={[styles.promoContainer, { opacity: promoOpacity }]}>
          <Text style={styles.promoTextBold}>
            40% off your 1st pickup order
          </Text>
          <Text style={styles.promoTextBold}>
            code: NEWPICKUP
          </Text>
          <TouchableOpacity style={styles.pickupBtn}>
            <Text style={styles.pickupText}>Pick up now</Text>
            <ChevronRight size={16} color="#FFFFFF" />
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
      </Animated.ScrollView>

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
    backgroundColor: '#FFFFFF', 
  },
  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF5A00', // The orange background layer
    zIndex: 0,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchWrapper: {
    backgroundColor: '#FF5A00', // Keeps background orange when sticky
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  promoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    zIndex: 1,
  },
  promoTextBold: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
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
    fontWeight: '600',
  },
  bodyContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 80,
    minHeight: 800,
    marginTop: -20, // Negative margin to overlap the orange area slightly
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
    fontWeight: '900',
    color: '#1F2937',
  },
  promoSubText: {
    fontSize: 12,
    fontWeight: '700',
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
