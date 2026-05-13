import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { Colors, Gradients } from '@/constants/colors';
import { useConversations, useGetOrCreateConversation } from '@/hooks/useChat';
import { discoverService } from '@/services/discoverService';
import { useChatStore } from '@/store/chatStore';
import { useDiscoverStore } from '@/store/discoverStore';
import { useMatches, useIncomingLikes } from '@/hooks/useDiscover';
import { useAuthStore } from '@/store/authStore';
import { Conversation, User } from '@/constants/types';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { messageService } from '@/services/messageService';
import { useQueryClient } from '@tanstack/react-query';
import { useSheet } from '@/components/GlobalActionSheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPreview(msg: string): string {
  if (!msg) return 'Start a conversation';
  if (msg.startsWith('http://') || msg.startsWith('https://')) return 'Sent a photo';
  return msg;
}

function isPhotoPreview(msg: string) {
  return msg?.startsWith('http://') || msg?.startsWith('https://');
}

// ─── Conversation Item ────────────────────────────────────────────────────────

function ConversationItem({ conversation, onPress, onLongPress }: {
  conversation: Conversation; onPress: () => void; onLongPress: () => void;
}) {
  const hasUnread = conversation.unreadCount > 0;
  const preview = formatPreview(conversation.lastMessage);
  const isPhoto = isPhotoPreview(conversation.lastMessage);

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        <AvatarWithRing uri={conversation.participant.avatar} size={54} isOnline={conversation.participant.isOnline} />
        {conversation.isPinned && (
          <View style={styles.pinBadge}>
            <Ionicons name="pin" size={9} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.convBody}>
        <View style={styles.convTop}>
          <View style={styles.nameRow}>
            <Text style={[styles.convName, hasUnread && styles.convNameUnread]} numberOfLines={1}>
              {conversation.participant.name}
            </Text>
            {conversation.participant.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
            )}
          </View>
          <Text style={[styles.convTime, hasUnread && styles.convTimeUnread]}>
            {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: false })}
          </Text>
        </View>

        <View style={styles.convBottom}>
          <View style={styles.previewRow}>
            {isPhoto && (
              <Ionicons name="camera-outline" size={13} color={hasUnread ? Colors.textSecondary : Colors.textMuted} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.previewText, hasUnread && styles.previewTextUnread]} numberOfLines={1}>
              {preview}
            </Text>
          </View>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Like Card ────────────────────────────────────────────────────────────────

function LikeCard({ user, onMessage, loading }: { user: User; onMessage: () => void; loading?: boolean }) {
  return (
    <View style={styles.likeCard}>
      <View style={styles.likeAvatarWrap}>
        <Image source={{ uri: fixAvatarUri(user.avatar, user.id) }} style={styles.likeAvatar} contentFit="cover" />
        {user.isOnline && <View style={styles.likeOnlineDot} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.likeName}>{user.name}</Text>
          {user.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />}
        </View>
        <Text style={styles.likeSub} numberOfLines={1}>
          {user.location || 'Philippines'}{user.age ? `, ${user.age}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onMessage} disabled={loading} activeOpacity={0.85}>
        <LinearGradient
          colors={loading ? ['#444', '#333'] : Gradients.primary}
          style={styles.likeBtn}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name="heart" size={14} color="#fff" />
                <Text style={styles.likeBtnText}>Like Back</Text>
              </>
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: conversations, isLoading } = useConversations();
  const { conversations: storeConvs, pinConversation, deleteConversation, markRead, setConversations } = useChatStore();
  const { incomingLikes, removeIncomingLike } = useDiscoverStore();
  const { user: authUser } = useAuthStore();
  const getOrCreateConversation = useGetOrCreateConversation();
  const showSheet = useSheet();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'chats' | 'likes'>('chats');
  const [startingChat, setStartingChat] = useState<string | null>(null);

  useMatches();
  useIncomingLikes();

  const allConvs = storeConvs.length > 0 ? storeConvs : (conversations || []);
  const displayConvs = allConvs.filter(c =>
    !search || c.participant.name.toLowerCase().includes(search.toLowerCase())
  );
  const incomingFiltered = incomingLikes.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = allConvs.reduce((s, c) => s + c.unreadCount, 0);

  const handleLongPress = (conv: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showSheet({
      title: conv.participant.name,
      options: [
        { label: conv.isPinned ? 'Unpin Conversation' : 'Pin Conversation', onPress: () => pinConversation(conv.id) },
        { label: 'Mark as Read', onPress: () => { markRead(conv.id); messageService.markConversationRead(conv.id, authUser?.id || '').then(() => queryClient.invalidateQueries({ queryKey: ['conversations', authUser?.id] })).catch(() => {}); } },
        { label: 'Delete Conversation', style: 'destructive', onPress: () => showSheet({ title: 'Delete Conversation?', message: `Remove conversation with ${conv.participant.name}?`, options: [{ label: 'Delete', destructive: true, onPress: () => deleteConversation(conv.id) }, { label: 'Cancel' }] }) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleAcceptAndMessage = async (likedUser: User) => {
    if (startingChat === likedUser.id || !authUser?.id) return;
    setStartingChat(likedUser.id);
    try {
      await discoverService.swipe(authUser.id, likedUser.id, 'like');
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes('duplicate') && !e.message?.toLowerCase().includes('unique') && !e.message?.toLowerCase().includes('already')) {
        showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
        setStartingChat(null);
        return;
      }
    }
    removeIncomingLike(likedUser.id);
    let convId: string | null = null;
    try { convId = await getOrCreateConversation(likedUser.id); }
    catch (e: any) { showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] }); setStartingChat(null); return; }
    try {
      const convs = await messageService.getConversations(authUser.id);
      setConversations(convs);
      queryClient.setQueryData(['conversations', authUser.id], convs);
      queryClient.invalidateQueries({ queryKey: ['conversations', authUser.id] });
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['incomingLikes', authUser.id] });
    setStartingChat(null);
    setTab('chats');
    router.push({ pathname: '/chat/[id]', params: { id: convId } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="chatbubbles" size={26} color={Colors.primary} />
            <View>
              <Text style={styles.headerTitle}>Messages</Text>
              {totalUnread > 0 && (
                <Text style={styles.headerSub}>{totalUnread} unread</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.push('/(tabs)/discover')}
          >
            <Ionicons name="person-add-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'chats' && styles.tabActive]}
            onPress={() => setTab('chats')}
          >
            <Ionicons
              name={tab === 'chats' ? 'chatbubbles' : 'chatbubbles-outline'}
              size={16}
              color={tab === 'chats' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabText, tab === 'chats' && styles.tabTextActive]}>
              Chats{totalUnread > 0 ? ` (${totalUnread})` : ''}
            </Text>
            {tab === 'chats' && <View style={styles.tabBar} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, tab === 'likes' && styles.tabActive]}
            onPress={() => setTab('likes')}
          >
            <Ionicons
              name={tab === 'likes' ? 'heart' : 'heart-outline'}
              size={16}
              color={tab === 'likes' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabText, tab === 'likes' && styles.tabTextActive]}>
              Likes Me{incomingLikes.length > 0 ? ` (${incomingLikes.length})` : ''}
            </Text>
            {tab === 'likes' && <View style={styles.tabBar} />}
            {incomingLikes.length > 0 && tab !== 'likes' && <View style={styles.tabDot} />}
          </TouchableOpacity>
        </View>

        {/* Chats list */}
        {tab === 'chats' ? (
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={displayConvs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <ConversationItem
                  conversation={item}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
                  onLongPress={() => handleLongPress(item)}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 110 }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="chatbubbles-outline" size={52} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>{search ? 'No results' : 'No conversations yet'}</Text>
                  <Text style={styles.emptySub}>
                    {search ? 'Try a different name' : 'Match someone and say hello!'}
                  </Text>
                  {!search && (
                    <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/(tabs)/discover')}>
                      <LinearGradient colors={Gradients.primary} style={styles.discoverBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="compass-outline" size={16} color="#fff" />
                        <Text style={styles.discoverBtnText}>Discover People</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )
        ) : (
          <FlatList
            data={incomingFiltered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <LikeCard
                user={item}
                onMessage={() => handleAcceptAndMessage(item)}
                loading={startingChat === item.id}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 10 }}
            ListHeaderComponent={
              incomingFiltered.length > 0 ? (
                <View style={styles.likesHeader}>
                  <Ionicons name="heart" size={14} color={Colors.primary} />
                  <Text style={styles.likesHeaderText}>
                    {incomingFiltered.length} {incomingFiltered.length === 1 ? 'person likes' : 'people like'} you
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="heart-outline" size={52} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>{search ? 'No results' : 'No likes yet'}</Text>
                <Text style={styles.emptySub}>
                  {search ? 'Try a different name' : 'People who like your profile appear here'}
                </Text>
                {!search && (
                  <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/(tabs)/discover')}>
                    <LinearGradient colors={Gradients.primary} style={styles.discoverBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="compass-outline" size={16} color="#fff" />
                      <Text style={styles.discoverBtnText}>Discover People</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 11, color: Colors.primaryLight, fontWeight: '500', marginTop: 1 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, height: 44, gap: 8, borderWidth: 1, borderColor: Colors.glassBorder },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  // Tabs
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.separator, marginBottom: 2 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 6, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  tabBar: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2.5, backgroundColor: Colors.primary, borderRadius: 2 },
  tabDot: { position: 'absolute', top: 8, right: '18%', width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },

  // Conversation row
  convItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatarWrap: { position: 'relative' },
  pinBadge: { position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.background },
  convBody: { flex: 1, gap: 5 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  convName: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  convNameUnread: { fontWeight: '700', color: Colors.textPrimary },
  convTime: { fontSize: 11, color: Colors.textMuted },
  convTimeUnread: { color: Colors.primaryLight, fontWeight: '600' },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  previewText: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  previewTextUnread: { color: Colors.textSecondary, fontWeight: '500' },
  badge: { backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: Colors.separator, marginLeft: 82 },

  // Like card
  likeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.glassBorder },
  likeAvatarWrap: { position: 'relative' },
  likeAvatar: { width: 52, height: 52, borderRadius: 26 },
  likeOnlineDot: { position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: Colors.card },
  likeName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  likeSub: { fontSize: 12, color: Colors.textMuted },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  likeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  likesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  likesHeaderText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  // Empty states
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 72, gap: 10, paddingHorizontal: 32 },
  emptyIconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(214,26,78,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  discoverBtn: { marginTop: 8, borderRadius: 24, overflow: 'hidden' },
  discoverBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 24, paddingVertical: 12 },
  discoverBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
