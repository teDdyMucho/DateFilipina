/**
 * GIFT ANIMATIONS REGISTRY
 * ─────────────────────────────────────────────────────────────────────────────
 * How to add a new animation:
 *
 *  1. Create a component below that accepts { onDone: () => void }
 *  2. Add it to the GIFT_ANIMATIONS map with the gift id as the key
 *  3. That's it — it will automatically play when that gift is sent
 *
 * Requirements for your component:
 *  - Call onDone() when the animation finishes so the component unmounts
 *  - Use useNativeDriver: true on all Animated values for smooth playback
 *  - The component renders inside a full-screen absolute View (zIndex 999)
 *    so position your elements relative to the screen center
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const { width: W, height: H } = Dimensions.get('window');

interface GiftAnimProps {
  emoji: string;
  giftName: string;
  senderName: string;
  coins: number;
  onDone: () => void;
}

// ── SHARED HELPER ─────────────────────────────────────────────────────────────

function SenderBanner({ senderName, giftName, coins, delay = 150 }: {
  senderName: string; giftName: string; coins: number; delay?: number;
}) {
  const y = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(y, { toValue: 0, damping: 12, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={[shared.banner, { opacity, transform: [{ translateY: y }] }]}>
      <Text style={shared.sender}>{senderName}</Text>
      <Text style={shared.label}> sent <Text style={shared.name}>{giftName}</Text>
        <Text style={shared.coins}> 💰{coins}</Text>
      </Text>
    </Animated.View>
  );
}

const shared = StyleSheet.create({
  banner: { marginTop: 14, backgroundColor: 'rgba(15,15,22,0.9)', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: W * 0.82, borderWidth: 1.5, borderColor: 'rgba(255,61,110,0.55)' },
  sender: { color: '#fff', fontWeight: '800', fontSize: 15 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  name: { color: '#FF3D6E', fontWeight: '800' },
  coins: { color: '#FFD700', fontWeight: '700' },
});

// ── ANIMATIONS ────────────────────────────────────────────────────────────────

/** 🌹 Rose — floats up with gentle sway */
function RoseAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 7, stiffness: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(sway, { toValue: 12, duration: 500, useNativeDriver: true }),
        Animated.timing(sway, { toValue: -12, duration: 500, useNativeDriver: true }),
      ]), { iterations: 3 }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.Text style={[s.mainEmoji, { opacity, transform: [{ scale }, { translateY }, { translateX: sway }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

/** ❤️ Heart — plays Heart.mp4 video animation full screen */
function HeartAnimation({ giftName, senderName, coins, onDone }: GiftAnimProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Auto-finish after the video duration (~3s)
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.wrap, { opacity }]} pointerEvents="none">
      <Video
        source={require('@/assets/gif/Heart.mp4')}
        style={s.fullVideo}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        isMuted
      />
      <View style={s.bannerOverlay}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </View>
    </Animated.View>
  );
}

/** 💎 Diamond — spins in with sparkle flash */
function DiamondAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 6, stiffness: 300, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(flash, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.7, duration: 150, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2400);
    return () => clearTimeout(t);
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View style={[s.flashRing, { opacity: flash }]} />
      <Animated.Text style={[s.mainEmoji, { opacity, transform: [{ scale }, { rotate: spin }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

/** 👑 Crown — drops from top with bounce */
function CrownAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const translateY = useRef(new Animated.Value(-H * 0.4)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 9, stiffness: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 9, stiffness: 180, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ])).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.View style={[s.crownGlow, { opacity: glow }]} />
      <Animated.Text style={[s.mainEmoji, { opacity, transform: [{ translateY }, { scale }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

/** 🏎️ Car — races in from the left */
function CarAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const slideX = useRef(new Animated.Value(-W)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideX, { toValue: 0, damping: 12, stiffness: 160, useNativeDriver: true }).start(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(shake, { toValue: 4, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -4, duration: 80, useNativeDriver: true }),
      ]), { iterations: 6 }).start();
    });
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideX, { toValue: W, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.Text style={[s.mainEmoji, { fontSize: 90, opacity, transform: [{ translateX: slideX }, { translateY: shake }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

/** 🛥️ Yacht — sails in slowly from right, majestic */
function YachtAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const slideX = useRef(new Animated.Value(W)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 120, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onDone());
    }, 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.Text style={[s.mainEmoji, { fontSize: 100, opacity, transform: [{ translateX: slideX }, { translateY: bob }, { scale }] }]}>
        {emoji}
      </Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

/** Default — simple pop-in for any unregistered gift */
function DefaultAnimation({ emoji, giftName, senderName, coins, onDone }: GiftAnimProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, damping: 7, stiffness: 320, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={s.wrap} pointerEvents="none">
      <Animated.Text style={[s.mainEmoji, { opacity, transform: [{ scale }] }]}>{emoji}</Animated.Text>
      <Animated.View style={{ opacity }}>
        <SenderBanner senderName={senderName} giftName={giftName} coins={coins} />
      </Animated.View>
    </View>
  );
}

// ── REGISTRY — add your gift animations here ──────────────────────────────────
// Key = gift id from constants/index.ts GIFTS array
// Value = your animation component

type GiftAnimComponent = React.FC<GiftAnimProps>;

export const GIFT_ANIMATIONS: Record<string, GiftAnimComponent> = {
  rose:    RoseAnimation,
  heart:   HeartAnimation,
  diamond: DiamondAnimation,
  crown:   CrownAnimation,
  car:     CarAnimation,
  yacht:   YachtAnimation,
  // ↓ Add new gift animations here ↓
  // my_gift: MyGiftAnimation,
};

export function getGiftAnimation(giftId: string): GiftAnimComponent {
  return GIFT_ANIMATIONS[giftId] ?? DefaultAnimation;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  mainEmoji: { fontSize: 110, textAlign: 'center' },
  particle: { position: 'absolute', fontSize: 28 },
  flashRing: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(100,220,255,0.35)' },
  crownGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,215,0,0.2)' },
  fullVideo: { width: W * 0.9, height: W * 0.9, backgroundColor: 'transparent' },
  bannerOverlay: { position: 'absolute', bottom: 120, alignSelf: 'center' },
});
