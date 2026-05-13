import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import {
  AdminPostFilter, useAdminPosts, useAdminPostComments,
  useDeletePostAsAdmin, useUpdatePostCaptionAsAdmin,
  useSetPinned, useSetHidden, useDeleteCommentAsAdmin, useUpdateCommentAsAdmin,
} from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { MediaViewer, MediaItem } from '@/components/MediaViewer';
import { fixAvatarUri } from '@/constants/avatarUtils';

const FILTERS: { key: AdminPostFilter; label: string; icon: any }[] = [
  { key: 'all',    label: 'All',    icon: 'apps-outline' },
  { key: 'photo',  label: 'Photos', icon: 'image-outline' },
  { key: 'video',  label: 'Videos', icon: 'videocam-outline' },
  { key: 'pinned', label: 'Pinned', icon: 'pin-outline' },
  { key: 'hidden', label: 'Hidden', icon: 'eye-off-outline' },
];

export default function AdminPostsScreen() {
  const router = useRouter();
  const showSheet = useSheet();
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filter, setFilter] = useState<AdminPostFilter>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editPost, setEditPost] = useState<{ id: string; caption: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewerItem, setViewerItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(() => ({ search: searchDebounced || undefined, filter }), [searchDebounced, filter]);

  const {
    data, isLoading, isFetchingNextPage, hasNextPage,
    fetchNextPage, refetch, isRefetching,
  } = useAdminPosts(filters);

  const posts = useMemo(() => data?.pages.flatMap(p => p.posts) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const del = useDeletePostAsAdmin();
  const updateCaption = useUpdatePostCaptionAsAdmin();
  const pin = useSetPinned();
  const hide = useSetHidden();

  const toast = (title: string, message?: string) => showSheet({ title, message, options: [{ label: 'OK' }] });

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    const postId = deleteConfirm;
    del.mutate(postId, {
      onSuccess: () => { setDeleteConfirm(null); toast('Post Deleted'); },
      onError: (e: any) => { setDeleteConfirm(null); toast('Error', e.message); },
    });
  };

  const handleSaveCaption = () => {
    if (!editPost) return;
    updateCaption.mutate({ postId: editPost.id, caption: editPost.caption }, {
      onSuccess: () => { setEditPost(null); toast('Caption Updated'); },
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const openActions = (post: any) => {
    Haptics.selectionAsync();
    showSheet({
      title: 'Post Actions',
      options: [
        { label: 'View Comments', onPress: () => setSelectedPostId(post.id) },
        { label: 'Edit Caption', onPress: () => setEditPost({ id: post.id, caption: post.caption || '' }) },
        {
          label: post.is_pinned ? 'Unpin Post' : 'Pin Post',
          onPress: () => pin.mutate({ postId: post.id, pinned: !post.is_pinned }, {
            onSuccess: () => toast(post.is_pinned ? 'Post Unpinned' : 'Post Pinned'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        {
          label: post.is_hidden ? 'Unhide Post' : 'Hide from Feed',
          onPress: () => hide.mutate({ postId: post.id, hidden: !post.is_hidden }, {
            onSuccess: () => toast(post.is_hidden ? 'Post Visible Again' : 'Post Hidden'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        { label: 'View User', onPress: () => router.push({ pathname: '/admin/user/[id]', params: { id: post.user_id } } as any) },
        { label: 'Delete Post', destructive: true, onPress: () => setDeleteConfirm(post.id) },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Posts</Text>
            <Text style={s.subtitle}>{total.toLocaleString()} total</Text>
          </View>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search caption..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterPill, active && s.filterPillActive]}
                onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
                activeOpacity={0.75}
              >
                <Ionicons name={f.icon} size={13} color={active ? '#fff' : Colors.textMuted} />
                <Text style={[s.filterLabel, active && s.filterLabelActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onActions={() => openActions(item)}
              onUser={() => router.push({ pathname: '/admin/user/[id]', params: { id: item.user_id } } as any)}
              onComments={() => { Haptics.selectionAsync(); setSelectedPostId(item.id); }}
              onMedia={() => {
                if (!item.media_urls?.[0]) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewerItem({
                  id: item.id,
                  url: item.media_urls[0],
                  type: item.media_type === 'video' ? 'video' : 'photo',
                });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={52} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No posts match</Text>
              <Text style={s.emptyText}>Try a different filter or search.</Text>
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <View style={{ padding: 20, alignItems: 'center' }}><ActivityIndicator color={Colors.primary} /></View> : null}
        />
      )}

      <CommentsManagerModal
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />

      <Modal visible={!!editPost} transparent animationType="fade" onRequestClose={() => setEditPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.editModal}>
            <Text style={s.editTitle}>Edit Caption</Text>
            <TextInput
              style={s.editInput}
              value={editPost?.caption ?? ''}
              onChangeText={(t) => setEditPost(p => p ? { ...p, caption: t } : null)}
              placeholder="Caption..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setEditPost(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleSaveCaption} disabled={updateCaption.isPending}>
                {updateCaption.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.modalConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={!!deleteConfirm}
        title="Delete Post?"
        message="This permanently removes the post, all its likes, and all its comments. Cannot be undone."
        destructive
        loading={del.isPending}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <MediaViewer
        visible={!!viewerItem}
        items={viewerItem ? [viewerItem] : []}
        initialIndex={0}
        onClose={() => setViewerItem(null)}
      />
    </View>
  );
}

// ─── Post card ───────────────────────────────────────────────────────────────

function PostCard({ post, onActions, onUser, onComments, onMedia }: { post: any; onActions: () => void; onUser: () => void; onComments: () => void; onMedia: () => void }) {
  const profile = post.profiles;
  const mediaUrl = post.media_urls?.[0];
  const isVideo = post.media_type === 'video';

  return (
    <View style={pc.card}>
      <View style={pc.header}>
        <TouchableOpacity onPress={onUser} style={pc.headerLeft} activeOpacity={0.7}>
          <Image source={{ uri: fixAvatarUri(profile?.avatar_url, profile?.id) }} style={pc.avatar} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <View style={pc.nameRow}>
              <Text style={pc.name} numberOfLines={1}>{profile?.name || 'Unknown'}</Text>
              {profile?.is_verified && <Ionicons name="checkmark-circle" size={13} color={Colors.primary} />}
              {profile?.is_banned && (
                <View style={pc.banPill}><Text style={pc.banText}>BANNED</Text></View>
              )}
            </View>
            <Text style={pc.time}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</Text>
          </View>
        </TouchableOpacity>

        <View style={pc.badges}>
          {post.is_pinned && (
            <View style={[pc.tag, { backgroundColor: 'rgba(255,159,10,0.18)', borderColor: 'rgba(255,159,10,0.4)' }]}>
              <Ionicons name="pin" size={10} color="#FF9F0A" />
              <Text style={[pc.tagText, { color: '#FF9F0A' }]}>PINNED</Text>
            </View>
          )}
          {post.is_hidden && (
            <View style={[pc.tag, { backgroundColor: 'rgba(120,120,128,0.20)', borderColor: 'rgba(120,120,128,0.4)' }]}>
              <Ionicons name="eye-off" size={10} color={Colors.textMuted} />
              <Text style={[pc.tagText, { color: Colors.textMuted }]}>HIDDEN</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={pc.moreBtn} onPress={onActions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {post.caption ? <Text style={pc.caption}>{post.caption}</Text> : null}

      {mediaUrl ? (
        <TouchableOpacity style={pc.mediaWrap} activeOpacity={0.85} onPress={onMedia}>
          {isVideo ? (
            <>
              <Video
                source={{ uri: mediaUrl }}
                style={pc.media}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isMuted
                positionMillis={500}
              />
              <View style={pc.playOverlay} pointerEvents="none">
                <View style={pc.playCircle}>
                  <Ionicons name="play" size={26} color="#fff" />
                </View>
              </View>
            </>
          ) : (
            <Image source={{ uri: mediaUrl }} style={pc.media} contentFit="cover" />
          )}
          {isVideo && (
            <View style={pc.videoBadge}>
              <Ionicons name="play" size={11} color="#fff" />
              <Text style={pc.videoBadgeText}>VIDEO</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      <View style={pc.stats}>
        <View style={pc.statGroup}>
          <Ionicons name="heart" size={14} color={Colors.primary} />
          <Text style={pc.statText}>{post.likes_count || 0}</Text>
        </View>
        <TouchableOpacity style={pc.statGroup} onPress={onComments} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={13} color={Colors.textMuted} />
          <Text style={pc.statText}>{post.comments_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Comments manager modal ─────────────────────────────────────────────────

function CommentsManagerModal({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const visible = !!postId;
  const { data: comments = [], isLoading } = useAdminPostComments(postId || undefined);
  const delComment = useDeleteCommentAsAdmin();
  const updateComment = useUpdateCommentAsAdmin();
  const showSheet = useSheet();
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);

  const handleDelete = (commentId: string) => {
    showSheet({
      title: 'Delete Comment?',
      options: [
        {
          label: 'Delete', destructive: true, onPress: () =>
            delComment.mutate(commentId, {
              onError: (e: any) => showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] }),
            }),
        },
        { label: 'Cancel' },
      ],
    });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    updateComment.mutate({ commentId: editing.id, content: editing.content }, {
      onSuccess: () => setEditing(null),
      onError: (e: any) => showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] }),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={cm.container}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={cm.header}>
            <TouchableOpacity onPress={onClose} style={cm.backBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={cm.headerTitle}>Manage Comments</Text>
            <View style={{ width: 40 }} />
          </View>

          {isLoading ? (
            <View style={cm.center}><ActivityIndicator color={Colors.primary} /></View>
          ) : comments.length === 0 ? (
            <View style={cm.center}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={cm.emptyText}>No comments yet</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={c => c.id}
              contentContainerStyle={cm.list}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={cm.row}>
                  <Image source={{ uri: fixAvatarUri(item.profiles?.avatar_url, item.profiles?.id) }} style={cm.avatar} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={cm.name}>{item.profiles?.name || 'Unknown'}</Text>
                    <Text style={cm.text}>{item.content}</Text>
                    <Text style={cm.time}>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</Text>
                  </View>
                  <View style={cm.actions}>
                    <TouchableOpacity style={cm.actionBtn} onPress={() => setEditing({ id: item.id, content: item.content })}>
                      <Ionicons name="create-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={cm.actionBtn} onPress={() => handleDelete(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#FF453A" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={cm.editBackdrop}>
              <View style={cm.editModal}>
                <Text style={cm.editTitle}>Edit Comment</Text>
                <TextInput
                  style={cm.editInput}
                  value={editing?.content ?? ''}
                  onChangeText={(t) => setEditing(e => e ? { ...e, content: t } : null)}
                  placeholder="Comment..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={200}
                  autoFocus
                />
                <View style={cm.editActions}>
                  <TouchableOpacity style={cm.editCancel} onPress={() => setEditing(null)}>
                    <Text style={cm.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cm.editConfirm} onPress={handleSaveEdit} disabled={updateComment.isPending}>
                    {updateComment.isPending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={cm.editConfirmText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  // 5 equal-width filter buttons in a single row
  filterRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingBottom: 10 },
  filterPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterLabelActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },

  // Edit modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  editModal: { width: '100%', backgroundColor: Colors.card, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: Colors.glassBorder },
  editTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  editInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, color: Colors.textPrimary, fontSize: 14, minHeight: 90, maxHeight: 200, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalConfirm: { flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

const pc = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: Colors.glassBorder },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', maxWidth: 130 },
  banPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FF453A' },
  banText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  time: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  moreBtn: { padding: 4 },
  caption: { color: Colors.textPrimary, fontSize: 14, lineHeight: 19, marginTop: 8, marginHorizontal: 4 },
  mediaWrap: { marginTop: 10, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  media: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1a1a1a' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  playCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  videoBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.65)' },
  videoBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, marginHorizontal: 4 },
  statGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  statHint: { color: Colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 },
});

const cm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  name: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  text: { color: Colors.textPrimary, fontSize: 14, lineHeight: 19, marginTop: 2 },
  time: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  delBtn: { padding: 6, marginTop: -2 },
  actions: { flexDirection: 'row', alignItems: 'flex-start', gap: 2, marginTop: -2 },
  actionBtn: { padding: 6 },

  // Edit comment modal (nested inside the manager)
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  editModal: { width: '100%', backgroundColor: Colors.card, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: Colors.glassBorder },
  editTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  editInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, color: Colors.textPrimary, fontSize: 14, minHeight: 80, maxHeight: 160, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  editCancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  editConfirm: { flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  editConfirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
