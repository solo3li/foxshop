import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Plus, Minus, Store, Heart, Flame, UtensilsCrossed } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { FoodItem } from '../types/models';
import { useCartStore } from '../store/cartStore';
import { useFavoriteStore } from '../store/favoriteStore';
import { useTheme } from '../hooks/use-theme';
import { formatCurrency } from '../constants/config';
import { PRICING_UNIT_LABELS } from '../constants/sectors';

interface FoodItemCardProps {
  item: FoodItem;
  containerStyle?: StyleProp<ViewStyle>;
  showRestaurantLink?: boolean;
}

export const FoodItemCard: React.FC<FoodItemCardProps> = ({
  item,
  containerStyle,
  showRestaurantLink = true,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.items);
  const cartRestaurantId = useCartStore((state) => state.restaurantId);
  const cartRestaurantName = useCartStore((state) => state.restaurantName);

  const isFavorite = useFavoriteStore((state) => state.isItemFavorite(item.id));
  const toggleItem = useFavoriteStore((state) => state.toggleItem);

  useEffect(() => {
    setImageError(false);
  }, [item.image]);

  const matchingCartItems = cartItems.filter((i) => i.id === item.id);
  const quantity = matchingCartItems.reduce((sum, i) => sum + i.quantity, 0);

  const hasRequiredModifiers = Boolean(
    item.has_required_modifiers ||
      item.modifier_groups?.some((g) => g.is_required || g.min_selections > 0)
  );

  const navigateToDetail = () => {
    router.push(`/item/${item.id}` as any);
  };

  const handleSafeAddItem = () => {
    if (hasRequiredModifiers) {
      navigateToDetail();
      return;
    }

    const effectiveCartRestaurantId = cartRestaurantId || cartItems[0]?.restaurantId;
    const isDifferentStore = Boolean(
      cartItems.length > 0 &&
        effectiveCartRestaurantId &&
        item.restaurantId &&
        effectiveCartRestaurantId !== item.restaurantId
    );

    if (!isDifferentStore) {
      addItem(item, item.restaurantId, item.restaurantName);
      return;
    }

    const oldStoreLabel = cartRestaurantName || 'متجر آخر';
    const newStoreLabel = item.restaurantName || 'هذا المتجر';
    const message = `سلتك تحتوي حالياً على منتجات من "${oldStoreLabel}". هل تريد إفراغ السلة الحالية وإضافة "${item.name}" من "${newStoreLabel}"؟`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        addItem(item, item.restaurantId, item.restaurantName);
      }
      return;
    }

    Alert.alert('استبدال محتويات السلة؟', message, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'نعم، استبدال السلة',
        style: 'destructive',
        onPress: () => addItem(item, item.restaurantId, item.restaurantName),
      },
    ]);
  };

  const handleToggleFavorite = (e?: any) => {
    e?.stopPropagation?.();
    toggleItem(item);
  };

  const unitLabel =
    item.pricing_unit && PRICING_UNIT_LABELS[item.pricing_unit]
      ? PRICING_UNIT_LABELS[item.pricing_unit]
      : item.pricing_unit
      ? ` / ${item.pricing_unit}`
      : '';

  const isOutOfStock =
    item.is_available === false ||
    (item.is_stock_tracked && item.stock_quantity !== undefined && item.stock_quantity <= 0);

  const isMaxStockReached = Boolean(
    item.is_stock_tracked &&
      item.stock_quantity !== undefined &&
      quantity >= item.stock_quantity
  );

  const showImage = Boolean(item.image && !imageError);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={navigateToDetail}
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          shadowColor: theme.isDark ? '#000' : '#0F172A',
        },
        containerStyle,
      ]}
    >
      <View style={styles.content}>
        {item.is_popular ? (
          <View
            style={[
              styles.popularBadge,
              { backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7' },
            ]}
          >
            <Flame size={11} color="#D97706" fill="#D97706" />
            <Text style={styles.popularBadgeText}>الأكثر طلباً</Text>
          </View>
        ) : null}

        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </Text>

        {showRestaurantLink && item.restaurantName && item.restaurantId ? (
          <TouchableOpacity
            style={[styles.storePill, { backgroundColor: theme.surfaceSecondary }]}
            activeOpacity={0.7}
            onPress={(e) => {
              e?.stopPropagation?.();
              router.push(`/restaurant/${item.restaurantId}` as any);
            }}
          >
            <Store size={11} color={theme.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.storePillText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.restaurantName}
            </Text>
          </TouchableOpacity>
        ) : null}

        {item.description ? (
          <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: theme.text }]}>
            {formatCurrency(item.price)}
            {unitLabel ? <Text style={[styles.unitLabel, { color: theme.textSecondary }]}>{unitLabel}</Text> : null}
          </Text>

          {Boolean(
            item.is_stock_tracked &&
              item.stock_quantity !== undefined &&
              item.stock_quantity > 0 &&
              item.stock_quantity <= 5
          ) && (
            <View
              style={[
                styles.lowStockPill,
                { backgroundColor: theme.isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEE2E2' },
              ]}
            >
              <Text style={styles.lowStockText}>متبقي {item.stock_quantity} فقط</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.mediaColumn}>
        <View
          style={[
            styles.imageFrame,
            {
              backgroundColor: theme.surfaceSecondary,
              borderColor: theme.borderSubtle,
            },
          ]}
        >
          {showImage ? (
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <UtensilsCrossed size={28} color={theme.textMuted} strokeWidth={1.5} />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.favoriteBtn,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(15, 23, 42, 0.8)'
                  : 'rgba(255, 255, 255, 0.92)',
              },
            ]}
            onPress={handleToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Heart
              size={14}
              color={isFavorite ? theme.primary : theme.textSecondary}
              fill={isFavorite ? theme.primary : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {isOutOfStock ? (
          <View
            style={[
              styles.outOfStockBadge,
              {
                backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F3F4F6',
                borderColor: theme.card,
              },
            ]}
          >
            <Text style={[styles.outOfStockText, { color: theme.textSecondary }]}>نفدت الكمية</Text>
          </View>
        ) : quantity > 0 ? (
          <View
            style={[
              styles.quantityControl,
              {
                backgroundColor: theme.card,
                borderColor: theme.borderSubtle,
              },
            ]}
          >
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                const lastVariant = matchingCartItems[matchingCartItems.length - 1];
                removeItem(lastVariant?.cartKey || item.id);
              }}
              style={[styles.btnSmall, { backgroundColor: theme.primaryLight }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.8}
            >
              <Minus size={14} color={theme.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            <Text style={[styles.quantityText, { color: theme.text }]}>{quantity}</Text>

            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                if (!isMaxStockReached) {
                  handleSafeAddItem();
                }
              }}
              disabled={isMaxStockReached}
              style={[
                styles.btnSmall,
                {
                  backgroundColor: isMaxStockReached
                    ? theme.isDark
                      ? '#374151'
                      : '#E5E7EB'
                    : theme.primary,
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.8}
            >
              <Plus size={14} color={isMaxStockReached ? '#9CA3AF' : '#FFFFFF'} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: theme.primary,
                borderColor: theme.card,
              },
            ]}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleSafeAddItem();
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginVertical: 6,
    marginHorizontal: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  content: {
    flex: 1,
    marginEnd: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
    color: '#B45309',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 4,
    textAlign: 'left',
    lineHeight: 21,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
    maxWidth: '100%',
  },
  storePillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  description: {
    fontSize: 12.5,
    fontFamily: 'Tajawal_400Regular',
    marginBottom: 8,
    lineHeight: 18,
    textAlign: 'left',
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  unitLabel: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  lowStockPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lowStockText: {
    fontSize: 10.5,
    fontFamily: 'Tajawal_700Bold',
    color: '#DC2626',
  },
  mediaColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 6,
  },
  imageFrame: {
    width: 104,
    height: 104,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    left: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  quantityControl: {
    position: 'absolute',
    bottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  btnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 13.5,
    fontFamily: 'Tajawal_700Bold',
    marginHorizontal: 9,
    minWidth: 16,
    textAlign: 'center',
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    fontSize: 10.5,
    fontFamily: 'Tajawal_700Bold',
  },
});
