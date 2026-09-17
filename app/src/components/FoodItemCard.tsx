import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { FoodItem } from '../constants/dummyData';
import { useCartStore } from '../store/cartStore';
import { Colors } from '../constants/theme';

interface FoodItemCardProps {
  item: FoodItem;
}

export const FoodItemCard: React.FC<FoodItemCardProps> = ({ item }) => {
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const cartItems = useCartStore((state) => state.items);
  
  const cartItem = cartItems.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.rightSection}>
        <Image source={{ uri: item.image }} style={styles.image} />
        {quantity > 0 ? (
          <View style={styles.quantityControl}>
            <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.btnSmall}>
              <Minus size={16} color={Colors.light.primary} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity onPress={() => addItem(item)} style={styles.btnSmall}>
              <Plus size={16} color={Colors.light.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={() => addItem(item)}>
            <Plus size={20} color="#FFFFFF" />
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  content: {
    flex: 1,
    marginRight: 16,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  price: {
    fontSize: 16,
    fontFamily: 'Tajawal_500Medium',
    color: Colors.light.primary,
  },
  rightSection: {
    alignItems: 'center',
    gap: -16, 
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  addButton: {
    backgroundColor: Colors.light.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  btnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginHorizontal: 12,
  },
});
