import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LiveBadgeProps {
  viewers?: number;
  size?: 'sm' | 'md';
}

export function LiveBadge({ viewers, size = 'md' }: LiveBadgeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const isSm = size === 'sm';

  return (
    <View style={styles.wrapper}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <LinearGradient colors={['#FF3D6E', '#D61A4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.badge, isSm && styles.badgeSm]}>
          <View style={[styles.dot, isSm && styles.dotSm]} />
          <Text style={[styles.text, isSm && styles.textSm]}>LIVE</Text>
        </LinearGradient>
      </Animated.View>
      {viewers !== undefined && (
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerText}>👁 {viewers >= 1000 ? `${(viewers/1000).toFixed(1)}k` : viewers}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 5 },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  dotSm: { width: 5, height: 5 },
  text: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  textSm: { fontSize: 11 },
  viewerBadge: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  viewerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
