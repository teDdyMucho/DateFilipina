import React, { useRef } from 'react';
import { TouchableOpacity, Text, ViewStyle, TextStyle, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Gradients, Colors } from '@/constants/colors';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'ghost';
}

export function GradientButton({
  title, onPress, loading, disabled, style, textStyle, size = 'md', variant = 'primary',
}: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const heights = { sm: 40, md: 52, lg: 60 };
  const fontSizes = { sm: 14, md: 16, lg: 18 };

  if (variant === 'outline') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          style={{ height: heights[size], borderRadius: 14, borderWidth: 1.5, borderColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
          activeOpacity={0.9}
        >
          <Text style={[{ color: Colors.primaryLight, fontSize: fontSizes[size], fontWeight: '600' }, textStyle]}>{title}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }], borderRadius: 14, overflow: 'hidden' }, style]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9} disabled={disabled || loading}>
        <LinearGradient
          colors={disabled ? ['#444', '#333'] : Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: heights[size], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[{ color: '#fff', fontSize: fontSizes[size], fontWeight: '700', letterSpacing: 0.3 }, textStyle]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
