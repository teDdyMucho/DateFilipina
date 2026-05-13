import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from './GradientButton';
import { Colors, Gradients } from '@/constants/colors';
import { User } from '@/constants/types';
import { useAuthStore } from '@/store/authStore';
import { fixAvatarUri } from '@/constants/avatarUtils';

interface MatchModalProps {
  visible: boolean;
  matchedUser: User | null;
  onClose: () => void;
  onMessage: () => void;
}

export function MatchModal({ visible, matchedUser, onClose, onMessage }: MatchModalProps) {
  const { user: authUser } = useAuthStore();
  const scale1 = useRef(new Animated.Value(0)).current;
  const scale2 = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale1.setValue(0); scale2.setValue(0); textOpacity.setValue(0); buttonOpacity.setValue(0);
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(scale1, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(scale2, { toValue: 1, damping: 8, stiffness: 150, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!matchedUser) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient colors={['rgba(90,10,30,0.97)', 'rgba(15,15,20,0.97)']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.content, { opacity: textOpacity }]}>
          <Text style={styles.title}>It's a Match! 💕</Text>
          <Text style={styles.subtitle}>You and {matchedUser.name} liked each other</Text>
        </Animated.View>
        <View style={styles.avatars}>
          <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: scale1 }] }]}>
            <LinearGradient colors={Gradients.primary} style={styles.ring}>
              <Image source={{ uri: fixAvatarUri(authUser?.avatar, authUser?.id) }} style={styles.avatar} contentFit="cover" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.heartEmoji}>❤️</Text>
          <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: scale2 }] }]}>
            <LinearGradient colors={Gradients.primaryReverse} style={styles.ring}>
              <Image source={{ uri: matchedUser.avatar }} style={styles.avatar} contentFit="cover" />
            </LinearGradient>
          </Animated.View>
        </View>
        <Animated.View style={[styles.buttons, { opacity: buttonOpacity }]}>
          <GradientButton title="Send Message 💬" onPress={onMessage} style={{ flex: 1 }} />
          <GradientButton title="Keep Swiping" onPress={onClose} variant="outline" style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 32 },
  content: { alignItems: 'center', gap: 8 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrapper: {},
  ring: { width: 120, height: 120, borderRadius: 60, padding: 4 },
  avatar: { width: '100%', height: '100%', borderRadius: 56 },
  heartEmoji: { fontSize: 40 },
  buttons: { width: '100%', flexDirection: 'column', gap: 12 },
});
