import React from 'react';
import { View, StyleSheet } from 'react-native';

interface CreativeLocationPinProps {
  isMoving?: boolean;
  size?: number;
}

/**
 * Minimalist ultra-thin needle location pin (10px solid filled head, thin 1.5px stem,
 * and a tiny precision dot at the exact map coordinate).
 */
export const CreativeLocationPin: React.FC<CreativeLocationPinProps> = ({
  size = 10,
}) => {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Solid filled circular head */}
      <View
        style={[
          styles.head,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
      {/* Ultra-thin needle stem */}
      <View style={styles.stem} />
      {/* Tiny precision point on the map */}
      <View style={styles.dot} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  head: {
    backgroundColor: '#D70F64',
  },
  stem: {
    width: 1.5,
    height: 14,
    backgroundColor: '#D70F64',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D70F64',
  },
});
