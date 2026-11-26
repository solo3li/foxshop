import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Star, Heart, Bike, Crown, Tag, MapPin, Clock } from 'lucide-react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Restaurant } from '../types/models';
import { Link } from 'expo-router';
import { useTheme } from '../hooks/use-theme';
import { useFavoriteStore } from '../store/favoriteStore';
import { CURRENCY } from '../constants/config';
import { STORE_TYPE_LABELS } from '../constants/sectors';

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
  const isPro = true; // Mocking PRO status
  const isAd = restaurant.id === 'r1'; // Mocking Ad
  const promoText = `خصم 10 ${CURRENCY} للطلبات فوق 25 ${CURRENCY}: FOX10`;

  const isFavorite = useFavoriteStore((state) => state.isRestaurantFavorite(restaurant.id));
  const toggleRestaurant = useFavoriteStore((state) => state.toggleRestaurant);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sectorLabel = (restaurant.store_type && STORE_TYPE_LABELS[restaurant.store_type]) || '🍔 مطعم';

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

            {isAd && (
              <View style={styles.adBadge}>
                <Text style={styles.adText}>إعلان</Text>
              </View>
            )}

            <View style={styles.badgesContainer}>
              {isPro && (
                <View style={[styles.proBadge, { backgroundColor: theme.primary }]}>
                  <Crown size={12} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.proText}>PRO</Text>
                </View>
              )}
              <View style={[styles.dealBadge, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.dealText, { color: theme.primary }]}>
                  توصيل مجاني عند إنفاق 20 {CURRENCY}
                </Text>
              </View>
            </View>
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
                {restaurant.ratingCount ? (
                  <Text style={[styles.ratingCount, { color: theme.textSecondary }]}>
                    ({restaurant.ratingCount > 999 ? '1k+' : restaurant.ratingCount})
                  </Text>
                ) : (
                  <Text style={[styles.ratingCount, { color: theme.textSecondary }]}>
                    (1k+)
                  </Text>
                )}
              </View>
            </View>

            {/* Prominent Visual Sector Badge Pill */}
            <View style={styles.sectorBadgeRow}>
              <View
                style={[
                  styles.sectorBadgePill,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(215, 15, 100, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectorBadgeText,
                    {
                      color: theme.isDark ? '#F9A8D4' : theme.primary,
                    },
                  ]}
                >
                  {sectorLabel}
                </Text>
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
                  <Text style={[styles.metaDot, { color: theme.borderSubtle }]}>•</Text>
                  <View style={styles.metaItem}>
                    <MapPin size={13} color={theme.textMuted} />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {Number(restaurant.distanceKm).toFixed(1)} كم
                    </Text>
                  </View>
                </>
              )}

              <Text style={[styles.metaDot, { color: theme.borderSubtle }]}>•</Text>
              <View style={styles.metaItem}>
                <Bike size={13} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {deliveryFeeDisplay}
                </Text>
              </View>
            </View>

            {promoText && (
              <View style={styles.promoRow}>
                <Tag size={13} color={theme.primary} />
                <Text style={[styles.promoTextValue, { color: theme.primary }]}>
                  {promoText}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
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
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: 8,
    borderWidth: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  cardHorizontal: {
    width: 270,
    marginRight: 16,
    marginBottom: 0,
  },
  imageContainer: {
    position: 'relative',
    height: 145,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 0,
  },
  adBadge: {
    position: 'absolute',
    bottom: 32,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderTopRightRadius: 10,
    gap: 4,
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
  },
  dealBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    flex: 1,
  },
  dealText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  infoContainer: {
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  sectorBadgeRow: {
    flexDirection: 'row-reverse',
    marginBottom: 6,
  },
  sectorBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  sectorBadgeText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  metaInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
  promoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  promoTextValue: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
