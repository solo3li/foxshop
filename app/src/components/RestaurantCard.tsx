import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Star, Heart, Bike, Crown, Tag } from 'lucide-react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Restaurant } from '../constants/dummyData';
import { Link } from 'expo-router';
import { Colors } from '../constants/theme';

interface RestaurantCardProps {
  restaurant: Restaurant;
  horizontal?: boolean;
}

export const RestaurantCard: React.FC<RestaurantCardProps & { index?: number }> = ({ restaurant, horizontal, index = 0 }) => {
  const isPro = true; // Mocking PRO status
  const isAd = restaurant.id === 'r1'; // Mocking Ad
  const promoText = '🎟️ خصم ١٠ ر.م للطلبات فوق ٢٥ ر.م: fox10';
  
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Link href={`/restaurant/${restaurant.id}`} asChild>
      <Pressable 
        style={StyleSheet.flatten([styles.card, horizontal && styles.cardHorizontal])}
        onPressIn={() => scale.value = withSpring(0.98)}
        onPressOut={() => scale.value = withSpring(1)}
      >
        <Animated.View 
          entering={FadeInUp.delay(index * 150).springify()} 
          style={[styles.container, animatedStyle]}
        >
          <View style={styles.imageContainer}>
            <Image source={{ uri: restaurant.image }} style={styles.image} />
            
            <Pressable style={styles.heartBtn}>
              <Heart size={16} color="#1F2937" />
            </Pressable>
          
          {isAd && (
            <View style={styles.adBadge}>
              <Text style={styles.adText}>إعلان</Text>
            </View>
          )}

          <View style={styles.badgesContainer}>
            {isPro && (
              <View style={styles.proBadge}>
                <Crown size={12} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
            <View style={styles.dealBadge}>
              <Text style={styles.dealText}>توصيل مجاني عند إنفاق ٢٠ ر.م</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
            <View style={styles.ratingContainer}>
              <Star size={14} color={Colors.light.primary} fill={Colors.light.primary} />
              <Text style={styles.rating}>{restaurant.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>(1k+)</Text>
            </View>
          </View>
          
          <Text style={styles.metaText} numberOfLines={1}>
            يبدأ من {restaurant.deliveryTime} • $$ • وجبات سريعة
          </Text>
          
          <View style={styles.deliveryRow}>
            <Bike size={14} color="#6B7280" />
            <Text style={styles.deliveryText}>توصيل: {restaurant.deliveryFee} ر.م</Text>
          </View>

          {promoText && (
            <View style={styles.promoRow}>
              <Tag size={14} color={Colors.light.primary} />
              <Text style={styles.promoTextValue}>{promoText}</Text>
            </View>
          )}
        </View>
        </Animated.View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    width: '100%',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  cardHorizontal: {
    width: 260,
    marginRight: 16,
    marginBottom: 0,
  },
  imageContainer: {
    position: 'relative',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  adBadge: {
    position: 'absolute',
    bottom: 28,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
  },
  badgesContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  proBadge: {
    backgroundColor: Colors.light.primary, 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 8,
    gap: 4,
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
  },
  dealBadge: {
    backgroundColor: Colors.light.primaryLight, 
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    flex: 1,
  },
  dealText: {
    color: Colors.light.primary,
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  infoContainer: {
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  ratingCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  promoTextValue: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
});
