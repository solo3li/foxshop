import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, FadeInRight } from 'react-native-reanimated';
import { FoodCategory } from '../types/models';
import { useTheme } from '../hooks/use-theme';

interface CategoryItemProps {
  category: FoodCategory;
  isSelected?: boolean;
  onPress?: () => void;
}

export const CategoryItem: React.FC<CategoryItemProps & { index: number }> = ({ category, isSelected, onPress, index }) => {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View entering={FadeInRight.delay(index * 80).springify()}>
      <Pressable 
        style={styles.container} 
        onPress={onPress}
        onPressIn={() => scale.value = withSpring(0.92)}
        onPressOut={() => scale.value = withSpring(1)}
      >
        <Animated.View 
          style={[
            styles.imageContainer, 
            { backgroundColor: isSelected ? theme.primaryLight : theme.backgroundElement },
            animatedStyle
          ]}
        >
          <Image source={{ uri: category.image }} style={styles.image} />
          {isSelected && <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />}
        </Animated.View>
        <Text 
          style={[
            styles.name, 
            { color: isSelected ? theme.primary : theme.text },
            isSelected && styles.nameSelected
          ]}
        >
          {category.name}
        </Text>
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
  imageContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  activeDot: {
    position: 'absolute',
    bottom: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  nameSelected: {
    fontFamily: 'Tajawal_700Bold',
  },
});
