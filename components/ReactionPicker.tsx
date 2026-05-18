import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableWithoutFeedback, Animated, Dimensions, PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { POST_REACTIONS, PostReactionKey } from '@/services/feedService';

interface Props {
  visible: boolean;
  // Screen coords (px) where the popover should anchor — usually the heart button's measured position.
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  onPick: (reaction: PostReactionKey) => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const ITEM_SIZE = 46;
const GAP = 8;
const PAD = 10;
const COUNT = POST_REACTIONS.length;
const BUBBLE_W = COUNT * ITEM_SIZE + (COUNT - 1) * GAP + PAD * 2;
const BUBBLE_H = ITEM_SIZE + PAD * 2;

// Facebook-style reaction picker:
// - Modern frosted pill (no labels at rest)
// - Drag finger across icons to "hover"; hovered icon scales up + label floats above
// - Release on an icon = pick it; release off = close without picking
export function ReactionPicker({ visible, anchorX, anchorY, onClose, onPick }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const [hoveredKey, setHoveredKey] = useState<PostReactionKey | null>(null);
  // Per-icon scale animations
  const itemScales = useRef(POST_REACTIONS.map(() => new Animated.Value(1))).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  // Cache the bubble's left edge in screen coords so we can compute which icon
  // the finger is over from absolute page-X coordinates.
  const bubbleLeftRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setHoveredKey(null);
      itemScales.forEach(v => v.setValue(1));
      labelOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 13, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 16, stiffness: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
      translateY.setValue(12);
    }
  }, [visible]);

  // Compute which item is under finger pageX. Returns key + index, or null.
  const itemIndexAt = (pageX: number): number | null => {
    const left = bubbleLeftRef.current + PAD;
    const itemPitch = ITEM_SIZE + GAP;
    const offset = pageX - left;
    if (offset < -GAP) return null;
    if (offset > itemPitch * COUNT) return null;
    const idx = Math.max(0, Math.min(COUNT - 1, Math.floor(offset / itemPitch)));
    return idx;
  };

  const setHovered = (key: PostReactionKey | null, idx: number | null) => {
    if (key !== hoveredKey) {
      setHoveredKey(key);
      if (key) Haptics.selectionAsync();
      // Animate all icons: the hovered one scales up, others snap back
      itemScales.forEach((v, i) => {
        Animated.spring(v, {
          toValue: i === idx ? 1.45 : 1,
          damping: 12,
          stiffness: 240,
          useNativeDriver: true,
        }).start();
      });
      Animated.timing(labelOpacity, { toValue: key ? 1 : 0, duration: 120, useNativeDriver: true }).start();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const idx = itemIndexAt(e.nativeEvent.pageX);
        if (idx !== null) setHovered(POST_REACTIONS[idx].key, idx);
      },
      onPanResponderMove: (e) => {
        const idx = itemIndexAt(e.nativeEvent.pageX);
        if (idx === null) {
          setHovered(null, null);
        } else {
          setHovered(POST_REACTIONS[idx].key, idx);
        }
      },
      onPanResponderRelease: (e) => {
        const idx = itemIndexAt(e.nativeEvent.pageX);
        if (idx !== null) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPick(POST_REACTIONS[idx].key);
        }
        onClose();
      },
      onPanResponderTerminate: () => onClose(),
    })
  ).current;

  // Position the bubble centered horizontally on the anchor, above it.
  const left = Math.max(8, Math.min(SCREEN_W - BUBBLE_W - 8, anchorX - BUBBLE_W / 2));
  const top = Math.max(48, anchorY - BUBBLE_H - 14);

  // Hovered label position — above the hovered icon
  const hoveredIdx = hoveredKey ? POST_REACTIONS.findIndex(r => r.key === hoveredKey) : -1;
  const labelLeft = hoveredIdx >= 0
    ? left + PAD + hoveredIdx * (ITEM_SIZE + GAP) + ITEM_SIZE / 2 - 40
    : 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop}>
          {/* Floating label above the hovered icon */}
          {hoveredKey && hoveredIdx >= 0 && (
            <Animated.View
              style={[
                s.tooltip,
                { left: labelLeft, top: top - 40, opacity: labelOpacity, transform: [{ scale }] },
              ]}
              pointerEvents="none"
            >
              <Text style={s.tooltipText}>{POST_REACTIONS[hoveredIdx].label}</Text>
            </Animated.View>
          )}

          <Animated.View
            onLayout={(e) => {
              // Capture the bubble's measured left so we can map page-X → icon idx.
              const layoutX = e.nativeEvent.layout.x;
              if (typeof layoutX === 'number') bubbleLeftRef.current = layoutX;
            }}
            style={[
              s.bubble,
              { left, top, opacity, transform: [{ scale }, { translateY }] },
            ]}
            {...panResponder.panHandlers}
          >
            {POST_REACTIONS.map((r, i) => (
              <Animated.View
                key={r.key}
                style={{ transform: [{ scale: itemScales[i] }, { translateY: itemScales[i].interpolate({ inputRange: [1, 1.45], outputRange: [0, -10] }) }] }}
              >
                <View style={[s.iconBubble, { backgroundColor: r.color }]}>
                  <MaterialCommunityIcons name={r.icon as any} size={26} color="#fff" />
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Compensate for left being captured via onLayout — it's relative to the parent
// View. Since our parent is the absoluteFill backdrop, layout.x IS the screen X.
// Update the bubbleLeftRef setter accordingly in onLayout.

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  bubble: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 28, 0.97)',
    borderRadius: BUBBLE_H / 2,
    paddingHorizontal: PAD,
    paddingVertical: PAD,
    gap: GAP,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  iconBubble: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tooltip: {
    position: 'absolute',
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(20,20,28,0.95)',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
