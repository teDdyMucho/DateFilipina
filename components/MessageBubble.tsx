import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { Message } from '@/constants/types';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
        {message.type === 'image' && (message.imageUrl || message.content) ? (
          <Image source={{ uri: message.imageUrl || message.content }} style={{ width: 200, height: 150, borderRadius: 12 }} contentFit="cover" />
        ) : message.type === 'gift' ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 32 }}>🎁</Text>
            <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText, { fontSize: 13 }]}>{message.content}</Text>
          </View>
        ) : (
          <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>{message.content}</Text>
        )}
      </View>
      <Text style={styles.time}>{format(message.timestamp, 'HH:mm')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 3, maxWidth: '80%' },
  ownContainer: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherContainer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  ownBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: Colors.card, borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted, marginTop: 3, marginHorizontal: 4 },
});
