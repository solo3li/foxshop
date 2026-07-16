import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, FadeInRight } from 'react-native-reanimated';
import { FoodCategory } from '../constants/dummyData';
import { Colors } from '../constants/theme';

interface CategoryItemProps {
  category: FoodCategory;
  isSelected?: boolean;
  onPress?: () => void;
}

export const CategoryItem: React.FC<CategoryItemProps & { index: number }> = ({ category, isSelected, onPress, index }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
      <Pressable 
        style={[styles.container, isSelected && styles.containerSelected]} 
        onPress={onPress}
        onPressIn={() => scale.value = withSpring(0.95)}
        onPressOut={() => scale.value = withSpring(1)}
      >
        <Animated.View style={[styles.imageContainer, isSelected && styles.imageContainerSelected, animatedStyle]}>
          <Image source={{ uri: category.image }} style={styles.image} />
        </Animated.View>
        <Text style={[styles.name, isSelected && styles.nameSelected]}>{category.name}</Text>
      </Pressable>
    </Animated.View>
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
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageContainerSelected: {
    borderColor: Colors.light.primary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  nameSelected: {
    color: Colors.light.primary,
    fontFamily: 'Tajawal_700Bold',
  },
});
