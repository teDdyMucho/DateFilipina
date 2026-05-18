import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Message } from '@/constants/types';
import { format } from 'date-fns';
import { storyService } from '@/services/storyService';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

// When a message has replyToStoryId, fetch that story so the bubble can show
// a thumbnail of what's being replied to. The cache TTL is short because the
// story may expire (24h from creation) while the chat stays open.
function useStoryPreview(storyId: string | undefined) {
  return useQuery({
    queryKey: ['storyPreview', storyId],
    queryFn: () => storyService.getStory(storyId!),
    enabled: !!storyId,
    staleTime: 60_000,
  });
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const { data: storyPreview } = useStoryPreview(message.replyToStoryId);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const isStoryReply = !!message.replyToStoryId;

  return (
    <Animated.View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer, { opacity, transform: [{ translateY }] }]}>
      {/* Story preview attached on top — minimal Instagram-style preview:
          thumbnail + thin label. Shows only when the story is still active. */}
      {isStoryReply && storyPreview && (
        <TouchableOpacity activeOpacity={0.85} style={[styles.storyPreview, isOwn ? styles.storyPreviewOwn : styles.storyPreviewOther]}>
          <Image source={{ uri: storyPreview.mediaUrl }} style={styles.storyThumb} contentFit="cover" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.storyPreviewLabel, { color: isOwn ? 'rgba(255,255,255,0.85)' : Colors.textMuted }]} numberOfLines={1}>
              {isOwn ? `Replied to ${storyPreview.userName}'s story` : 'Replied to your story'}
            </Text>
            <Text style={[styles.storyPreviewName, { color: isOwn ? '#fff' : Colors.textPrimary }]} numberOfLines={1}>
              {storyPreview.userName}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble, isStoryReply && storyPreview ? styles.bubbleAttached : null]}>
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
  bubbleAttached: { marginTop: -2, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  ownBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: Colors.card, borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted, marginTop: 3, marginHorizontal: 4 },
  // My Day preview attached above the reply bubble
  storyPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 14, maxWidth: 240, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  storyPreviewOwn: { backgroundColor: 'rgba(214,26,78,0.55)', alignSelf: 'flex-end' },
  storyPreviewOther: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  storyThumb: { width: 36, height: 50, borderRadius: 8, backgroundColor: '#222' },
  storyPreviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  storyPreviewName: { fontSize: 13, fontWeight: '700' },
});
