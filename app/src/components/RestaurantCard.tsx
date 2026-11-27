import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Star, Heart, Bike, MapPin, Clock } from 'lucide-react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Restaurant } from '../types/models';
import { Link } from 'expo-router';
import { useTheme } from '../hooks/use-theme';
import { useFavoriteStore } from '../store/favoriteStore';
import { CURRENCY } from '../constants/config';

interface RestaurantCardProps {
  restaurant: Restaurant;
  horizontal?: boolean;
}

export const RestaurantCard: React.FC<RestaurantCardProps & { index?: number }> = ({
  restaurant,
  horizontal,
  index = 0,
}) => {
  const theme = useTheme();

  const isFavorite = useFavoriteStore((state) => state.isRestaurantFavorite(restaurant.id));
  const toggleRestaurant = useFavoriteStore((state) => state.toggleRestaurant);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const deliveryFeeDisplay =
    Number(restaurant.deliveryFee) === 0
      ? 'توصيل مجاني'
      : `توصيل: ${restaurant.deliveryFee} ${CURRENCY}`;

  return (
    <Link href={`/restaurant/${restaurant.id}`} asChild>
      <Pressable
        style={StyleSheet.flatten([styles.card, horizontal && styles.cardHorizontal])}
        onPressIn={() => (scale.value = withSpring(0.98))}
        onPressOut={() => (scale.value = withSpring(1))}
      >
        <Animated.View entering={FadeInUp.delay(index * 120).springify()}>
          <Animated.View
            style={[styles.container, { backgroundColor: theme.card }, animatedStyle]}
          >
            <View style={styles.imageContainer}>
              <Image source={{ uri: restaurant.image }} style={styles.image} />

              <Pressable
                style={[styles.heartBtn, { backgroundColor: theme.card }]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggleRestaurant(restaurant);
                }}
              >
                <Heart
                  size={16}
                  color={isFavorite ? theme.primary : theme.textSecondary}
                  fill={isFavorite ? theme.primary : 'none'}
                />
              </Pressable>
            </View>

            <View style={styles.infoContainer}>
              {/* Header: Name and Star Rating */}
              <View style={styles.headerRow}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {restaurant.name}
                </Text>
                <View style={styles.ratingContainer}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text style={[styles.rating, { color: theme.text }]}>
                    {restaurant.rating.toFixed(1)}
                  </Text>
                  {restaurant.ratingCount != null && restaurant.ratingCount > 0 && (
                    <Text style={[styles.ratingCount, { color: theme.textSecondary }]}>
                      ({restaurant.ratingCount > 999 ? '1k+' : restaurant.ratingCount})
                    </Text>
                  )}
                </View>
              </View>

              {/* Meta row with Delivery Time, Distance in km, and Delivery Fee */}
              <View style={styles.metaInfoRow}>
                <View style={styles.metaItem}>
                  <Clock size={13} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {restaurant.deliveryTime}
                  </Text>
                </View>

                {restaurant.distanceKm != null && (
                  <>
                    <Text style={[styles.metaDot, { color: theme.textMuted }]}>•</Text>
                    <View style={styles.metaItem}>
                      <MapPin size={13} color={theme.textMuted} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                        {Number(restaurant.distanceKm).toFixed(1)} كم
                      </Text>
                    </View>
                  </>
                )}

                <Text style={[styles.metaDot, { color: theme.textMuted }]}>•</Text>
                <View style={styles.metaItem}>
                  <Bike size={13} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {deliveryFeeDisplay}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
    width: '100%',
  },
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 14,
    borderWidth: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardHorizontal: {
    width: 272,
    marginRight: 16,
    marginBottom: 0,
  },
  imageContainer: {
    position: 'relative',
    height: 152,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 0,
  },
  infoContainer: {
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  ratingContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  ratingCount: {
    fontSize: 12,
  },
  metaInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  metaDot: {
    fontSize: 10,
  },
});
