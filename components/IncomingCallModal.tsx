import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { fixAvatarUri } from '@/constants/avatarUtils';
import * as Haptics from 'expo-haptics';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  callerAvatar: string;
  callType: 'video' | 'audio';
  onAnswer: () => void;
  onDecline: () => void;
}

function PulsingRing({ size = 160 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.7, duration: 1100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, transform: [{ scale }], opacity }]}
    />
  );
}

export function IncomingCallModal({ visible, callerName, callerAvatar, callType, onAnswer, onDecline }: IncomingCallModalProps) {
  useEffect(() => {
    if (!visible) { Vibration.cancel(); return; }
    const pattern = [0, 700, 400, 700, 400];
    const interval = setInterval(() => Vibration.vibrate(pattern), 2200);
    Vibration.vibrate(pattern);
    return () => { clearInterval(interval); Vibration.cancel(); };
  }, [visible]);

  const handleAnswer = () => {
    Vibration.cancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAnswer();
  };

  const handleDecline = () => {
    Vibration.cancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onDecline();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        {callerAvatar ? (
          <Image source={{ uri: fixAvatarUri(callerAvatar) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={55} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.9)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top */}
        <View style={styles.topSection}>
          <Text style={styles.incomingLabel}>
            {callType === 'video' ? 'Incoming Video Call' : 'Incoming Call'}
          </Text>
          <Text style={styles.callerName}>{callerName}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <PulsingRing size={170} />
            <PulsingRing size={130} />
            {callerAvatar ? (
              <Image source={{ uri: fixAvatarUri(callerAvatar) }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={46} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.bottomSection}>
          <View style={styles.btnWrap}>
            <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={handleDecline} activeOpacity={0.8}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Decline</Text>
          </View>

          <View style={styles.btnWrap}>
            <TouchableOpacity style={[styles.btn, styles.answerBtn]} onPress={handleAnswer} activeOpacity={0.8}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Answer</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const AVATAR_SIZE = 110;

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 90 },
  topSection: { alignItems: 'center', gap: 8 },
  incomingLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
  callerName: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: -0.4 },
  avatarSection: { alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  bottomSection: { flexDirection: 'row', justifyContent: 'center', gap: 72 },
  btnWrap: { alignItems: 'center', gap: 10 },
  btn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  declineBtn: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  answerBtn: {
    backgroundColor: '#30D158',
    shadowColor: '#30D158',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
});
