import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, KeyboardAvoidingView, Platform,
  TouchableOpacity, FlatList, ActivityIndicator, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { useComments, useAddComment } from '@/hooks/useFeed';
import { useAuthStore } from '@/store/authStore';
import { Colors, Gradients } from '@/constants/colors';
import { fixAvatarUri } from '@/constants/avatarUtils';

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

export function CommentsModal({ visible, postId, onClose }: Props) {
  const [text, setText] = useState('');
  const { data: comments = [], isLoading } = useComments(postId);
  const { mutate: addComment, isPending } = useAddComment(postId);
  const { user } = useAuthStore();
  const listRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!text.trim() || isPending) return;
    addComment(text.trim(), {
      onSuccess: () => {
        setText('');
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={cm.header}>
            <Text style={cm.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={cm.center}><ActivityIndicator color={Colors.primary} /></View>
          ) : comments.length === 0 ? (
            <View style={cm.center}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={cm.emptyText}>No comments yet. Be first!</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16, gap: 14 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={cm.commentRow}>
                  <Image
                    source={{ uri: fixAvatarUri(item.user.avatar, item.user.id) }}
                    style={cm.avatar}
                    contentFit="cover"
                  />
                  <View style={cm.commentBubble}>
                    <Text style={cm.commentName}>{item.user.name}</Text>
                    <Text style={cm.commentText}>{item.content}</Text>
                    <Text style={cm.commentTime}>{formatDistanceToNow(item.createdAt, { addSuffix: true })}</Text>
                  </View>
                </View>
              )}
            />
          )}

          <View style={cm.inputRow}>
            <Image source={{ uri: fixAvatarUri(user?.avatar, user?.id) }} style={cm.inputAvatar} contentFit="cover" />
            <View style={cm.inputBox}>
              <TextInput
                style={cm.input}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
            </View>
            <TouchableOpacity
              style={[cm.sendBtn, (!text.trim() || isPending) && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!text.trim() || isPending}
            >
              <LinearGradient colors={Gradients.primary} style={cm.sendGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="send" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  commentBubble: { flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 12, gap: 3 },
  commentName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  commentText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  commentTime: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.glassBorder, backgroundColor: Colors.background },
  inputAvatar: { width: 36, height: 36, borderRadius: 18 },
  inputBox: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100, borderWidth: 1, borderColor: Colors.glassBorder },
  input: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  sendGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
});
