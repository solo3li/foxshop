import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Pizza, Hamburger, Fish, Leaf, Coffee, CakeSlice } from 'lucide-react-native';
import { FoodCategory } from '../constants/dummyData';

interface CategoryItemProps {
  category: FoodCategory;
  isSelected?: boolean;
  onPress?: () => void;
}

const getIcon = (name: string, color: string) => {
  const size = 24;
  switch (name) {
    case 'pizza': return <Pizza size={size} color={color} />;
    case 'hamburger': return <Hamburger size={size} color={color} />;
    case 'fish': return <Fish size={size} color={color} />;
    case 'leaf': return <Leaf size={size} color={color} />;
    case 'coffee': return <Coffee size={size} color={color} />;
    case 'cake': return <CakeSlice size={size} color={color} />;
    default: return <Pizza size={size} color={color} />;
  }
};

export const CategoryItem: React.FC<CategoryItemProps> = ({ category, isSelected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.container, isSelected && styles.containerSelected]} 
      onPress={onPress}
    >
      <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
        {getIcon(category.iconName, isSelected ? '#FFFFFF' : '#FF5A00')}
      </View>
      <Text style={[styles.name, isSelected && styles.nameSelected]}>{category.name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 16,
    gap: 8,
  },
  containerSelected: {
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerSelected: {
    backgroundColor: '#FF5A00',
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  nameSelected: {
    color: '#FF5A00',
    fontWeight: '700',
  },
});
