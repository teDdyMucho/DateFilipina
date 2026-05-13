import React, { useRef, useEffect, useState } from 'react';
import { View, ViewStyle, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gradients, Colors } from '@/constants/colors';

interface AvatarWithRingProps {
  uri: string;
  size?: number;
  isLive?: boolean;
  isOnline?: boolean;
  hasStory?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

function safeAvatarUri(uri: string, seed: string): string {
  if (!uri || uri.startsWith('file://') || uri.trim() === '') {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}`;
  }
  if (uri.includes('avataaars/svg')) {
    return uri.replace('avataaars/svg', 'avataaars/png');
  }
  return uri;
}

export function AvatarWithRing({ uri, size = 56, isLive, isOnline, hasStory, onPress, style }: AvatarWithRingProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [imgError, setImgError] = useState(false);
  const seed = uri?.slice(-8) || 'default';
  const resolvedUri = safeAvatarUri(uri, seed);
  const fallbackUri = `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}`;

  useEffect(() => {
    setImgError(false);
  }, [uri]);

  useEffect(() => {
    if (isLive) {
      animRef.current = Animated.loop(
        Animated.timing(rotation, { toValue: 1, duration: 3000, useNativeDriver: true })
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      rotation.setValue(0);
    }
    return () => animRef.current?.stop();
  }, [isLive]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringSize = size + 8;
  const hasRing = hasStory || isLive;
  const displayUri = imgError ? fallbackUri : resolvedUri;

  const content = (
    <View style={[{ width: ringSize, height: ringSize }, style]}>
      {hasRing && (
        <Animated.View style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: ringSize / 2, overflow: 'hidden' },
          isLive && { transform: [{ rotate: spin }] },
        ]}>
          <LinearGradient
            colors={isLive ? ['#FF3D6E', '#FF9F0A', '#FF3D6E'] : Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
      <View style={{
        position: 'absolute', top: 3, left: 3, right: 3, bottom: 3,
        borderRadius: (ringSize - 6) / 2,
        backgroundColor: Colors.background,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {displayUri ? (
          <Image
            source={{ uri: displayUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            onError={() => setImgError(true)}
          />
        ) : (
          <Ionicons name="person" size={size * 0.5} color="rgba(255,255,255,0.4)" />
        )}
      </View>
      {isOnline && !isLive && (
        <View style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: Colors.success,
          borderWidth: 2, borderColor: Colors.background,
        }} />
      )}
    </View>
  );

  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>;
  return content;
}
