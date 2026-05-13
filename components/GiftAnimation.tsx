import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getGiftAnimation } from '@/constants/giftAnimations';

const { width: W } = Dimensions.get('window');

interface GiftAnimationProps {
  gift: { emoji: string; name: string; coins: number; senderName: string };
  onComplete: () => void;
}

// Side banner — slides in from left, shows sender info
export function GiftAnimation({ gift, onComplete }: GiftAnimationProps) {
  const slideX = useRef(new Animated.Value(-W)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -W, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onComplete());
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ translateX: slideX }] }]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,61,110,0.95)', 'rgba(180,20,80,0.95)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.banner}
      >
        <Text style={styles.emoji}>{gift.emoji}</Text>
        <View style={styles.info}>
          <Text style={styles.senderName} numberOfLines={1}>{gift.senderName}</Text>
          <Text style={styles.giftLine}>sent <Text style={styles.giftName}>{gift.name}</Text></Text>
        </View>
        <View style={styles.coinsBadge}>
          <Text style={styles.coinsText}>💰{gift.coins}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// Center gift — delegates to the animation registry
export function CenterGiftAnimation({ gift, onComplete }: GiftAnimationProps) {
  const GiftAnim = getGiftAnimation((gift as any).id ?? '');
  return (
    <GiftAnim
      emoji={gift.emoji}
      giftName={gift.name}
      senderName={gift.senderName}
      coins={gift.coins}
      onDone={onComplete}
    />
  );
}

// Floating heart
const HEART_EMOJIS = ['❤️', '💖', '💗', '💕', '💝', '🧡', '💛', '💚', '💙', '💜'];

export function FloatingHeart({ onComplete }: { onComplete: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  const startX = useRef(14 + Math.random() * 80).current;
  const emoji = useRef(HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)]).current;
  const dist = useRef(300 + Math.random() * 200).current;
  const dur = useRef(1800 + Math.random() * 400).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 6, stiffness: 350, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -dist, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(dur * 0.4),
        Animated.timing(opacity, { toValue: 0, duration: dur * 0.6, useNativeDriver: true }),
      ]),
    ]).start(() => onComplete());
  }, []);

  return (
    <Animated.View
      style={[heartStyles.heart, { right: startX, opacity, transform: [{ translateY }, { scale }] }]}
      pointerEvents="none"
    >
      <Text style={heartStyles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const heartStyles = StyleSheet.create({
  heart: { position: 'absolute', bottom: 100, zIndex: 999, elevation: 999 },
  emoji: { fontSize: 44 },
});

// Animated comment
export function AnimatedComment({ comment, color, index }: { comment: any; color: string; index: number }) {
  const translateX = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 35;
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, damping: 20, stiffness: 260, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.commentRow, { opacity, transform: [{ translateX }] }]}>
      {comment.userAvatar ? (
        <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatarImg} contentFit="cover" />
      ) : (
        <View style={styles.commentAvatar}><Text style={{ fontSize: 12 }}>👤</Text></View>
      )}
      <View style={styles.commentBubble}>
        <Text style={[styles.commentUser, { color }]}>{comment.userName}</Text>
        <Text style={styles.commentText}> {comment.text}</Text>
      </View>
    </Animated.View>
  );
}

// Viewer badge
export function ViewerBadge({ count }: { count: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const display = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

  return (
    <Animated.View style={[styles.viewerBadge, { transform: [{ scale: pulse }] }]}>
      <View style={styles.viewerDot} />
      <Text style={styles.viewerText}>{display}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, bottom: 130, zIndex: 100 },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 40, paddingHorizontal: 14, paddingVertical: 10, gap: 10, maxWidth: W * 0.72, overflow: 'hidden', shadowColor: '#FF3D6E', shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  emoji: { fontSize: 36 },
  info: { flex: 1 },
  senderName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  giftLine: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  giftName: { color: '#FFD700', fontWeight: '700' },
  coinsBadge: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  coinsText: { color: '#FFD700', fontSize: 11, fontWeight: '700' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  commentAvatarImg: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  commentBubble: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: W * 0.6 },
  commentUser: { fontSize: 12, fontWeight: '800' },
  commentText: { color: '#fff', fontSize: 12 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  viewerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF3D6E' },
  viewerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
