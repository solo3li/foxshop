import React, { useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Animated, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryItem } from '../../components/CategoryItem';
import { RestaurantCard } from '../../components/RestaurantCard';
import { categories, restaurants } from '../../constants/dummyData';
import { useCartStore } from '../../store/cartStore';
import { useRouter } from 'expo-router';
import { ChevronLeft, X, Clock, MapPin, Heart, Search, Percent, ShoppingBag, Coffee, Star } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

const banners = [
  { id: '1', title: 'خصم ١٠ ر.م', subtitle: 'كود FOX10', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2940&auto=format&fit=crop' },
  { id: '2', title: 'سلسلة المشروبات', subtitle: 'ابتداءً من ٩.٩٠ ر.م', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2930&auto=format&fit=crop' },
];

const services = [
  { title: 'عروض', image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=200&auto=format&fit=crop' },
  { title: 'فوكس مارت', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop' },
  { title: 'مخبز الثعلب', image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=200&auto=format&fit=crop' },
  { title: 'صحة وجمال', image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=200&auto=format&fit=crop' },
  { title: 'جديد', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200&auto=format&fit=crop' }
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
            <Text style={styles.locationTitle}>الرئيسية - ١٢٣ شارع الثعلب</Text>
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
              placeholder="ابحث عن المتاجر والمطاعم" 
              placeholderTextColor="#6B7280"
              style={[styles.searchInput, { outlineStyle: 'none' } as any]}
              editable={false}
            />
          </View>
        </View>

        {/* 2. Promo Row */}
        <Animated.View style={[styles.promoContainer, { opacity: promoOpacity }]}>
          <Text style={styles.promoTextBold}>
            خصم ٤٠٪ على طلب الاستلام الأول
          </Text>
          <Text style={styles.promoTextBold}>
            الكود: NEWPICKUP
          </Text>
          <TouchableOpacity style={styles.pickupBtn}>
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
            {services.map((item, index) => (
              <TouchableOpacity key={index} style={styles.serviceItem}>
                <View style={styles.serviceIconPlaceholder}>
                  <Image source={{ uri: item.image }} style={styles.serviceImage} />
                </View>
                <Text style={styles.serviceText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cuisines Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {categories.map((cat, index) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                isSelected={selectedCategory === cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                index={index}
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
            <Text style={styles.sectionTitle}>أشهر المطاعم</Text>
            <TouchableOpacity style={styles.chevronBtn}>
              <ChevronLeft size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {restaurants.slice(0, 3).map((restaurant, index) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} horizontal index={index} />
            ))}
          </ScrollView>

          {/* Section: Top Shops */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>مطاعم محلية مفضلة</Text>
            <TouchableOpacity style={styles.chevronBtn}>
              <ChevronLeft size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {restaurants.map((restaurant, index) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
            ))}
          </View>

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
    backgroundColor: Colors.light.primary, // The orange background layer
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
    fontFamily: 'Tajawal_700Bold',
  },
  searchWrapper: {
    backgroundColor: Colors.light.primary, // Keeps background orange when sticky
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
  }
});
