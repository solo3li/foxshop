import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Ellipse,
  G,
  Filter,
  FeDropShadow,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface CreativeLocationPinProps {
  isMoving?: boolean;
  size?: number;
}

export const CreativeLocationPin: React.FC<CreativeLocationPinProps> = ({
  isMoving = false,
  size = 54,
}) => {
  // Float animation for the pin
  const floatAnim = useSharedValue(0);
  // Pulse animation for the ground radar ring
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    // Gentle continuous float
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Continuous expanding radar wave
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, []);

  const animatedPinStyle = useAnimatedStyle(() => {
    // Float upward by 10px on peak
    const translateY = interpolate(floatAnim.value, [0, 1], [0, -10]);
    return {
      transform: [{ translateY }],
    };
  });

  const animatedShadowStyle = useAnimatedStyle(() => {
    // Shadow shrinks and becomes more transparent as pin floats higher
    const scale = interpolate(floatAnim.value, [0, 1], [1, 0.72]);
    const opacity = interpolate(floatAnim.value, [0, 1], [0.4, 0.2]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const animatedRadarStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [0.6, 2.2]);
    const opacity = interpolate(pulseAnim.value, [0, 0.2, 1], [0.8, 0.6, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const pinWidth = size;
  const pinHeight = size * 1.35; // taller for stylish tapered tip

  return (
    <View style={styles.container} pointerEvents="none">
      {/* 1. Ground Radar Pulse & Precision Target */}
      <View style={styles.groundContainer}>
        {/* Expanding radar pulse wave */}
        <Animated.View style={[styles.radarWave, animatedRadarStyle]} />

        {/* Outer target crosshair ring */}
        <View style={styles.targetRing} />

        {/* Dynamic drop shadow under pin */}
        <Animated.View style={[styles.shadowContainer, animatedShadowStyle]}>
          <Svg width={36} height={14} viewBox="0 0 36 14">
            <Defs>
              <RadialGradient id="shadowGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#000000" stopOpacity="0.6" />
                <Stop offset="60%" stopColor="#1F2937" stopOpacity="0.25" />
                <Stop offset="100%" stopColor="#1F2937" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={18} cy={7} rx={16} ry={6} fill="url(#shadowGrad)" />
          </Svg>
        </Animated.View>

        {/* Center Precision Target Dot */}
        <View style={styles.centerDot}>
          <View style={styles.centerDotCore} />
        </View>
      </View>

      {/* 2. Floating 3D Neon Pin */}
      <Animated.View style={[styles.pinWrapper, animatedPinStyle]}>
        <Svg width={pinWidth} height={pinHeight} viewBox="0 0 60 80">
          <Defs>
            {/* 3D Vibrant Neon Gradient */}
            <LinearGradient id="pinBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF2E7E" />
              <Stop offset="45%" stopColor="#D70F64" />
              <Stop offset="100%" stopColor="#8E043E" />
            </LinearGradient>

            {/* Specular Highlight on upper left */}
            <LinearGradient id="highlightGrad" x1="0%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>

            {/* Core Lens/Badge Gradient */}
            <RadialGradient id="coreGrad" cx="35%" cy="35%" rx="65%" ry="65%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="50%" stopColor="#FFF1F5" />
              <Stop offset="80%" stopColor="#FCE7F3" />
              <Stop offset="100%" stopColor="#FBCFE8" />
            </RadialGradient>

            {/* Inner Ring Glow */}
            <LinearGradient id="ringGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#D70F64" stopOpacity="0.4" />
            </LinearGradient>
          </Defs>

          {/* Pin Outer Drop Shadow Silhouette (subtle border) */}
          <Path
            d="M30 76 C29 76 10 52 10 30 C10 14 19 2 30 2 C41 2 50 14 50 30 C50 52 31 76 30 76 Z"
            fill="none"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth={3}
          />

          {/* Main 3D Neon Teardrop Pin Body */}
          <Path
            d="M30 75 C29.2 75 11 51.5 11 30 C11 14.5 19.5 3 30 3 C40.5 3 49 14.5 49 30 C49 51.5 30.8 75 30 75 Z"
            fill="url(#pinBodyGrad)"
            stroke="#FFFFFF"
            strokeWidth={2}
          />

          {/* Glossy Curved Highlight Reflection (top-left edge) */}
          <Path
            d="M17 17 C20 9 27 6 32 6 C30 9 24 12 20 22 C18 19 17 18 17 17 Z"
            fill="url(#highlightGrad)"
          />

          {/* Inner Glowing Badge / Center Lens */}
          <Circle
            cx={30}
            cy={29}
            r={13}
            fill="url(#coreGrad)"
            stroke="url(#ringGlow)"
            strokeWidth={2.5}
          />

          {/* Fox Shop Inner Emblem / Dot */}
          <Circle cx={30} cy={29} r={5} fill="#D70F64" />
          <Circle cx={28.5} cy={27.5} r={1.5} fill="#FFFFFF" opacity={0.8} />

          {/* Needle Base Sharp Point Highlight */}
          <Circle cx={30} cy={74} r={2} fill="#FFFFFF" opacity={0.9} />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 110,
    position: 'relative',
  },
  groundContainer: {
    position: 'absolute',
    bottom: 8,
    width: 60,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarWave: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D70F64',
    backgroundColor: 'rgba(215, 15, 100, 0.15)',
  },
  targetRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(215, 15, 100, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  shadowContainer: {
    position: 'absolute',
    bottom: -1,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D70F64',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 0 6px rgba(215, 15, 100, 0.8)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 5,
  },
  centerDotCore: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  pinWrapper: {
    position: 'absolute',
    bottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
