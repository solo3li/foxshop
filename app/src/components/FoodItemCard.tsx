import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { FoodItem } from '../types/models';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../hooks/use-theme';
import { formatCurrency } from '../constants/config';
import { PRICING_UNIT_LABELS } from '../constants/sectors';

interface FoodItemCardProps {
  item: FoodItem;
}

export const FoodItemCard: React.FC<FoodItemCardProps> = ({ item }) => {
  const theme = useTheme();
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.items);
  
  const cartItem = cartItems.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;

  const unitLabel = item.pricing_unit && PRICING_UNIT_LABELS[item.pricing_unit]
    ? PRICING_UNIT_LABELS[item.pricing_unit]
    : (item.pricing_unit ? ` / ${item.pricing_unit}` : '');

  const isOutOfStock =
    item.is_available === false ||
    (item.is_stock_tracked && item.stock_quantity !== undefined && item.stock_quantity <= 0);

  const isMaxStockReached =
    Boolean(item.is_stock_tracked &&
    item.stock_quantity !== undefined &&
    quantity >= item.stock_quantity);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: theme.primary }]}>
            {formatCurrency(item.price)}{unitLabel}
          </Text>
          {Boolean(item.is_stock_tracked && item.stock_quantity !== undefined && item.stock_quantity > 0 && item.stock_quantity <= 5) && (
            <Text style={styles.lowStockText}>
              متبقي {item.stock_quantity} فقط!
            </Text>
          )}
        </View>
      </View>
      <View style={styles.rightSection}>
        <Image source={{ uri: item.image }} style={styles.image} />
        {isOutOfStock ? (
          <View style={[styles.outOfStockBadge, { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#F3F4F6' }]}>
            <Text style={[styles.outOfStockText, { color: theme.textSecondary }]}>نفدت الكمية</Text>
          </View>
        ) : quantity > 0 ? (
          <View style={[styles.quantityControl, { backgroundColor: theme.card }]}>
            <TouchableOpacity 
              onPress={() => removeItem(item.id)} 
              style={[styles.btnSmall, { backgroundColor: theme.primaryLight }]}
              activeOpacity={0.8}
            >
              <Minus size={14} color={theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.quantityText, { color: theme.text }]}>{quantity}</Text>
            <TouchableOpacity 
              onPress={() => {
                if (!isMaxStockReached) {
                  addItem(item);
                }
              }} 
              disabled={isMaxStockReached}
              style={[
                styles.btnSmall,
                { backgroundColor: isMaxStockReached ? (theme.isDark ? '#374151' : '#E5E7EB') : theme.primaryLight },
              ]}
              activeOpacity={0.8}
            >
              <Plus size={14} color={isMaxStockReached ? '#9CA3AF' : theme.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: theme.primary }]} 
            onPress={() => addItem(item)}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginVertical: 6,
    marginHorizontal: 16,
    // Zero-Border Fluid Architecture
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  content: {
    flex: 1,
    marginRight: 14,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  price: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  lowStockText: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#DC2626',
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 16,
  },
  addButton: {
    position: 'absolute',
    bottom: -6,
    right: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 0,
  },
  quantityControl: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 0,
  },
  btnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    marginHorizontal: 10,
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: -6,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
});
