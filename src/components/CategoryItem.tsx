import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FoodCategory } from '../constants/dummyData';

interface CategoryItemProps {
  category: FoodCategory;
  isSelected?: boolean;
  onPress?: () => void;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({ category, isSelected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.container, isSelected && styles.containerSelected]} 
      onPress={onPress}
    >
      <View style={[styles.imageContainer, isSelected && styles.imageContainerSelected]}>
        <Image source={{ uri: category.image }} style={styles.image} />
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
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageContainerSelected: {
    borderColor: '#FF5A00',
  },
  image: {
    width: '100%',
    height: '100%',
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
