import React from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import { usePostLikers } from '@/hooks/useFeed';

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

// Bottom-sheet style modal listing every user who liked a post.
// Tap a row to jump to that user's profile.
export function LikersModal({ visible, postId, onClose }: Props) {
  const { data: likers = [], isLoading, refetch } = usePostLikers(postId, visible);
  const router = useRouter();

  const goToUser = (userId: string) => {
    onClose();
    setTimeout(() => {
      router.push({ pathname: '/user/[id]', params: { id: userId } } as any);
    }, 80);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Likes</Text>
              {likers.length > 0 && (
                <Text style={s.subtitle}>{likers.length} {likers.length === 1 ? 'person likes this' : 'people like this'}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : likers.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="heart-outline" size={56} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No likes yet</Text>
            <Text style={s.emptySub}>Be the first to react to this post.</Text>
          </View>
        ) : (
          <FlatList
            data={likers}
            keyExtractor={u => u.id}
            onRefresh={refetch}
            refreshing={isLoading}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => goToUser(item.id)}>
                <View style={s.avatarWrap}>
                  <Image source={{ uri: item.avatar }} style={s.avatar} contentFit="cover" />
                  {item.isOnline && <View style={s.onlineDot} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    {item.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />}
                  </View>
                  <Text style={s.time}>{formatDistanceToNow(item.likedAt, { addSuffix: true })}</Text>
                </View>
                <Ionicons name="heart" size={18} color={Colors.primary} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, gap: 12 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 10 },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#222' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.background },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  time: { color: Colors.textMuted, fontSize: 12 },
  separator: { height: 1, backgroundColor: Colors.separator, marginLeft: 74 },
});
