import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, RefreshControl, Animated, Alert, Share, Modal,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFeed, useLikePost, useCreatePost, useDeletePost, useUpdatePost, useComments, useAddComment, useShareToFeed } from '@/hooks/useFeed';
import { useFriendsForStories } from '@/hooks/useProfile';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { useSheet } from '@/components/GlobalActionSheet';
import { messageService } from '@/services/messageService';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { VideoPlayer } from '@/components/VideoPlayer';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { Colors, Gradients } from '@/constants/colors';
import { FeedPost } from '@/constants/types';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { formatDistanceToNow } from 'date-fns';

const { width: SW } = Dimensions.get('window');

// ─── Comments Modal ───────────────────────────────────────────────────────────

function CommentsModal({ visible, postId, onClose }: { visible: boolean; postId: string; onClose: () => void }) {
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
              <Text style={cm.closeText}>✕</Text>
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
                <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

interface MediaPick { uri: string; type: 'photo' | 'video' }

function CreatePostModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [media, setMedia] = useState<MediaPick[]>([]);
  const [caption, setCaption] = useState('');
  const { mutateAsync: createPost, isPending } = useCreatePost();
  const { user } = useAuthStore();
  const showSheet = useSheet();

  const MAX_MEDIA = 10;

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showSheet({ title: 'Permission needed', message: 'Allow camera access in settings.', options: [{ label: 'OK' }] }); return; }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true, quality: 0.85, videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        const item: MediaPick = { uri: a.uri, type: a.type === 'video' ? 'video' : 'photo' };
        setMedia(m => [...m, item].slice(0, MAX_MEDIA));
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showSheet({ title: 'Permission needed', message: 'Allow photo library access in settings.', options: [{ label: 'OK' }] }); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: MAX_MEDIA,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!result.canceled) {
        const additions: MediaPick[] = result.assets.map(a => ({
          uri: a.uri,
          type: a.type === 'video' ? 'video' : 'photo',
        }));
        setMedia(m => [...m, ...additions].slice(0, MAX_MEDIA));
      }
    }
  };

  const handlePickMedia = () => {
    if (media.length >= MAX_MEDIA) {
      showSheet({ title: 'Limit reached', message: `You can attach up to ${MAX_MEDIA} items per post.`, options: [{ label: 'OK' }] });
      return;
    }
    showSheet({
      title: 'Add Media',
      options: [
        { label: 'Camera', onPress: () => pick('camera') },
        { label: 'Photo / Video Library', onPress: () => pick('library') },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleRemove = (idx: number) => {
    setMedia(m => m.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    if (media.length === 0 && !caption.trim()) {
      showSheet({ title: 'Nothing to post', message: 'Please add a photo, video, or write something.', options: [{ label: 'OK' }] });
      return;
    }
    try {
      await createPost({ media, caption: caption.trim() });
      setMedia([]); setCaption('');
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showSheet({ title: 'Post Failed', message: e.message || 'Something went wrong. Please try again.', options: [{ label: 'OK' }] });
    }
  };

  const handleClose = () => {
    if (isPending) return;
    setMedia([]); setCaption('');
    onClose();
  };

  const canPost = !isPending && (media.length > 0 || !!caption.trim());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={pm.header}>
            <TouchableOpacity onPress={handleClose} disabled={isPending}>
              <Text style={pm.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={pm.title}>New Post</Text>
            <TouchableOpacity onPress={handlePost} disabled={!canPost}>
              {isPending
                ? <ActivityIndicator color={Colors.primaryLight} size="small" />
                : <LinearGradient colors={canPost ? Gradients.primary : ['#333', '#222']} style={pm.postBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={pm.postText}>Share</Text>
                  </LinearGradient>
              }
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* User row + caption input */}
            <View style={pm.authorRow}>
              <AvatarWithRing uri={user?.avatar || ''} size={44} />
              <TextInput
                style={pm.captionInput}
                placeholder="What's on your mind?"
                placeholderTextColor={Colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={300}
                autoFocus
              />
            </View>
            <Text style={pm.charCount}>{caption.length}/300</Text>

            {/* Media thumbnail strip (horizontal) — supports multi-item, photos + videos */}
            {media.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pm.thumbStrip}>
                {media.map((m, i) => (
                  <View key={`${m.uri}-${i}`} style={pm.thumbWrap}>
                    {m.type === 'video' ? (
                      <View style={pm.thumb}>
                        <Video source={{ uri: m.uri }} style={pm.thumbImg} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted positionMillis={500} />
                        <View style={pm.thumbVideoOverlay}>
                          <Ionicons name="play" size={20} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image source={{ uri: m.uri }} style={pm.thumbImg} contentFit="cover" />
                    )}
                    <TouchableOpacity style={pm.thumbRemove} onPress={() => handleRemove(i)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                    <View style={pm.thumbIndex}>
                      <Text style={pm.thumbIndexText}>{i + 1}</Text>
                    </View>
                  </View>
                ))}
                {media.length < MAX_MEDIA && (
                  <TouchableOpacity style={pm.thumbAdd} onPress={handlePickMedia}>
                    <Ionicons name="add" size={28} color={Colors.primary} />
                    <Text style={pm.thumbAddText}>Add</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}

            {/* Media pick button — single entry, supports multi-select */}
            <View style={pm.mediaRow}>
              <TouchableOpacity style={pm.mediaBtn} onPress={handlePickMedia}>
                <Ionicons name="images-outline" size={22} color={Colors.primary} />
                <Text style={pm.mediaLabel}>{media.length === 0 ? 'Add Photos / Videos' : `${media.length} added · add more`}</Text>
              </TouchableOpacity>
            </View>

            {isPending && (
              <View style={pm.uploadBanner}>
                <ActivityIndicator color={Colors.primaryLight} size="small" />
                <Text style={pm.uploadText}>Uploading... please wait</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Heart Burst ──────────────────────────────────────────────────────────────

function HeartBurst({ visible }: { visible: boolean }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!visible) return;
    scale.setValue(0); opacity.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.5, damping: 5, stiffness: 180, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Ionicons name="heart" size={90} color={Colors.primary} />
    </Animated.View>
  );
}

// ─── Post Media (image or video) ──────────────────────────────────────────────

// Reuse the proven VideoPlayer for video slides — same behavior as single-video posts.
// Photo slides are lightweight.
const MediaSlide = React.memo(function MediaSlide({ url, type, isActive }: { url: string; type: 'photo' | 'video'; isActive: boolean }) {
  if (type === 'video') {
    return <VideoPlayer uri={url} isVisible={isActive} />;
  }
  return (
    <View style={s.imageWrapper}>
      <Image source={{ uri: url }} style={s.postImage} contentFit="cover" cachePolicy="memory-disk" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)']} style={s.imageGrad} />
    </View>
  );
});

function PostMedia({ post, isVisible = true }: { post: FeedPost & { mediaType?: string; mediaUrls?: string[]; mediaTypes?: Array<'photo' | 'video'> }; isVisible?: boolean }) {
  const urls = (post.mediaUrls && post.mediaUrls.length > 0) ? post.mediaUrls : (post.imageUrl ? [post.imageUrl] : []);
  if (urls.length === 0) return null;
  const types: Array<'photo' | 'video'> = post.mediaTypes && post.mediaTypes.length === urls.length
    ? post.mediaTypes
    : urls.map(() => ((post as any).mediaType === 'video' ? 'video' : 'photo'));

  const [activeIndex, setActiveIndex] = useState(0);

  // Single-item: full-featured player for videos
  if (urls.length === 1) {
    return types[0] === 'video'
      ? <VideoPlayer uri={urls[0]} isVisible={isVisible} />
      : (
        <View style={s.imageWrapper}>
          <Image source={{ uri: urls[0] }} style={s.postImage} contentFit="cover" cachePolicy="memory-disk" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)']} style={s.imageGrad} />
        </View>
      );
  }

  // Multi-item: horizontal swipable pager.
  // Note: do NOT wrap each slide in Animated.View with native-driver transforms —
  // on Android that breaks touch hit-testing, so video play buttons inside
  // can't be tapped. Plain View wrappers keep gestures working.
  const onMomentumScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (i !== activeIndex) {
      Haptics.selectionAsync();
      setActiveIndex(i);
    }
  };

  return (
    <View style={{ width: SW }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
      >
        {urls.map((url, index) => (
          <View key={`${url}-${index}`} style={{ width: SW }}>
            <MediaSlide url={url} type={types[index]} isActive={isVisible && index === activeIndex} />
          </View>
        ))}
      </ScrollView>
      {/* Counter pill */}
      <View style={s.mediaCounter} pointerEvents="none">
        <Text style={s.mediaCounterText}>{activeIndex + 1}/{urls.length}</Text>
      </View>
      {/* Dots indicator */}
      <View style={s.mediaDots} pointerEvents="none">
        {urls.map((_, i) => (
          <View key={i} style={[s.mediaDot, i === activeIndex && s.mediaDotActive]} />
        ))}
      </View>
    </View>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, myId, isVisible = true }: { post: FeedPost; myId: string; isVisible?: boolean }) {
  const { mutate: likePost } = useLikePost();
  const { mutate: deletePost } = useDeletePost();
  const { mutate: updatePost } = useUpdatePost();
  const { mutate: shareToFeed } = useShareToFeed();
  const [showHeart, setShowHeart] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const lastTap = useRef(0);
  const router = useRouter();
  const isOwn = post.user.id === myId;

  const triggerLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    likePost({ postId: post.id, isLiked: liked });
    if (!liked) { setShowHeart(true); setTimeout(() => setShowHeart(false), 800); }
    setLikeCount(c => liked ? c - 1 : c + 1);
    setLiked(l => !l);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) triggerLike();
    }
    lastTap.current = now;
  };

  const showSheet = useSheet();
  const handleShare = () => {
    showSheet({
      title: 'Share Post',
      options: [
        ...(!isOwn ? [{
          label: 'Share to My Feed',
          onPress: () => shareToFeed(
            {
              userId: post.user.id,
              userName: post.user.name,
              userAvatar: post.user.avatar,
              caption: post.caption,
              imageUrl: post.imageUrl,
              mediaType: (post as any).mediaType || 'photo',
            },
            {
              onSuccess: () => showSheet({ title: 'Shared!', message: `${post.user.name}'s post has been added to your feed.`, options: [{ label: 'OK' }] }),
              onError: (e: any) => showSheet({ title: 'Error', message: e.message || 'Could not share post.', options: [{ label: 'OK' }] }),
            }
          ),
        }] : []),
        {
          label: 'Share Externally',
          onPress: () => Share.share({
            message: `Check out ${post.user.name}'s post on Date A Filipina!`,
            url: post.imageUrl || undefined,
          }),
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleStartChat = async () => {
    if (!myId) return;
    try {
      const convId = await messageService.getOrCreateConversation(myId, post.user.id);
      router.push({ pathname: '/chat/[id]', params: { id: convId } } as any);
    } catch {
      showSheet({ title: 'Error', message: 'Could not open chat. Please try again.', options: [{ label: 'OK' }] });
    }
  };

  const postOptions: ActionSheetOption[] = isOwn ? [
    {
      label: 'Edit Caption',
      onPress: () => { setEditCaption(post.caption || ''); setShowEditModal(true); },
    },
    {
      label: 'Delete Post',
      style: 'destructive',
      onPress: () => showSheet({
        title: 'Delete post?',
        message: 'This cannot be undone.',
        options: [
          { label: 'Delete', destructive: true, onPress: () => deletePost(post.id) },
          { label: 'Cancel' },
        ],
      }),
    },
    { label: 'Cancel', style: 'cancel' },
  ] : [
    { label: 'View Profile', onPress: () => router.push({ pathname: '/user/[id]', params: { id: post.user.id } } as any) },
    { label: 'Send Message', onPress: handleStartChat },
    { label: 'Share Post', onPress: handleShare },
    { label: 'Report Post', onPress: () => setShowReport(true) },
    { label: 'Block User', style: 'destructive', onPress: () => showSheet({ title: 'Blocked', message: `${post.user.name} blocked.`, options: [{ label: 'OK' }] }) },
    { label: 'Cancel', style: 'cancel' },
  ];

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowActionSheet(true);
  };

  const fmtCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <View style={s.card}>
      {/* Shared-from banner */}
      {post.sharedFrom && (
        <View style={s.sharedBanner}>
          <Ionicons name="repeat" size={13} color={Colors.textMuted} />
          <Image
            source={{ uri: fixAvatarUri(post.sharedFrom.userAvatar, post.sharedFrom.userId) }}
            style={s.sharedAvatar}
            contentFit="cover"
          />
          <Text style={s.sharedText}>
            <Text style={{ fontWeight: '700', color: Colors.textSecondary }}>{post.user.name}</Text>
            <Text> shared </Text>
            <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{post.sharedFrom.userName}</Text>
            <Text>'s post</Text>
          </Text>
        </View>
      )}

      {/* Header — show original poster when shared */}
      <View style={s.cardHeader}>
        <TouchableOpacity style={s.cardUser} activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.sharedFrom ? post.sharedFrom.userId : post.user.id } } as any)}>
          <AvatarWithRing uri={post.sharedFrom ? fixAvatarUri(post.sharedFrom.userAvatar, post.sharedFrom.userId) : post.user.avatar} size={42} isOnline={post.user.isOnline} />
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={s.cardName}>{post.sharedFrom ? post.sharedFrom.userName : post.user.name}</Text>
              {post.user.isVerified && <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />}
            </View>
            <Text style={s.cardTime}>{formatDistanceToNow(post.timestamp, { addSuffix: true })}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.moreBtn}>
          <Text style={s.moreDots}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Caption above image if text-only */}
      {!!post.caption && !post.imageUrl && (
        <View style={s.textOnlyBox}>
          <Text style={s.textOnlyText}>{post.caption}</Text>
        </View>
      )}

      {/* Media */}
      {!!post.imageUrl && (
        <View style={{ position: 'relative' }}>
          {/* Multi-item posts need raw touch passthrough so the horizontal swipe works.
              Videos handle their own gestures. Single photos get the double-tap-to-like wrapper. */}
          {((post as any).mediaUrls?.length ?? 1) > 1 || (post as any).mediaType === 'video' ? (
            <PostMedia post={post} isVisible={isVisible} />
          ) : (
            <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
              <PostMedia post={post} isVisible={isVisible} />
            </TouchableOpacity>
          )}
          <HeartBurst visible={showHeart} />
        </View>
      )}

      {/* Caption below image */}
      {!!post.caption && !!post.imageUrl && (
        <View style={s.captionRow}>
          <Text style={s.captionName}>{post.user.name.split(' ')[0]} </Text>
          <Text style={s.captionText}>{post.caption}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        <View style={s.actionsLeft}>
          <TouchableOpacity style={s.actionBtn} onPress={triggerLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? Colors.primary : Colors.textSecondary} />
            <Text style={[s.actionCount, liked && { color: Colors.primaryLight }]}>{fmtCount(likeCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
            <Ionicons name="chatbubble-outline" size={21} color={Colors.textSecondary} />
            <Text style={s.actionCount}>{fmtCount(post.comments)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
            <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBookmarked(b => !b); }}>
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={21} color={bookmarked ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <CommentsModal visible={showComments} postId={post.id} onClose={() => setShowComments(false)} />
      <ReportSheet
        visible={showReport}
        targetType="post"
        targetId={post.id}
        targetLabel={`${post.user.name}'s post`}
        onClose={() => setShowReport(false)}
      />

      <ActionSheet
        visible={showActionSheet}
        title={isOwn ? 'Post Options' : post.user.name}
        options={postOptions}
        onClose={() => setShowActionSheet(false)}
      />

      {/* Edit caption modal */}
      <Modal visible={showEditModal} transparent animationType="none" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.editOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)}>
            <TouchableOpacity activeOpacity={1} style={s.editBox}>
              <Text style={s.editTitle}>Edit Caption</Text>
              <TextInput
                style={s.editInput}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                autoFocus
                maxLength={500}
                placeholder="Write a caption..."
                placeholderTextColor={Colors.textMuted}
              />
              <View style={s.editActions}>
                <TouchableOpacity style={s.editCancel} onPress={() => setShowEditModal(false)}>
                  <Text style={s.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.editSave}
                  onPress={() => {
                    updatePost({ postId: post.id, caption: editCaption });
                    setShowEditModal(false);
                  }}
                >
                  <LinearGradient colors={Gradients.primary} style={s.editSaveGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={s.editSaveText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Friends story strip ─────────────────────────────────────────────────────

function FriendsStrip({ onCreatePost }: { onCreatePost: () => void }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: friends = [] } = useFriendsForStories();

  return (
    <View style={fs.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fs.row}
      >
        {/* Self avatar — tap to create a post */}
        <TouchableOpacity
          style={fs.item}
          activeOpacity={0.8}
          onPress={onCreatePost}
        >
          <View style={fs.selfRing}>
            <Image source={{ uri: user?.avatar || '' }} style={fs.avatar} contentFit="cover" />
            <View style={fs.plusBadge}>
              <Ionicons name="add" size={13} color="#fff" />
            </View>
          </View>
          <Text style={fs.label} numberOfLines={1}>You</Text>
        </TouchableOpacity>

        {friends.map((f: any) => (
          <TouchableOpacity
            key={f.id}
            style={fs.item}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.id } } as any)}
          >
            <LinearGradient
              colors={f.isLive
                ? ['#FF3B30', '#FF9F0A']
                : f.isOnline
                  ? ['#FF3D6E', '#BF5AF2', '#5E5CE6']
                  : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              style={fs.ring}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={fs.ringInner}>
                <Image source={{ uri: f.avatar }} style={fs.avatar} contentFit="cover" />
              </View>
            </LinearGradient>
            {f.isLive && (
              <View style={fs.liveBadge}>
                <Text style={fs.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <Text style={fs.label} numberOfLines={1}>{f.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const fs = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, paddingVertical: 10 },
  row: { paddingHorizontal: 12, gap: 12, alignItems: 'center' },
  item: { alignItems: 'center', width: 68, gap: 5 },
  ring: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: '100%', height: '100%', borderRadius: 30, padding: 2, backgroundColor: Colors.background },
  selfRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: '#222' },
  plusBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, borderWidth: 2.5, borderColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  liveBadge: { position: 'absolute', top: 50, left: '50%', transform: [{ translateX: -16 }], backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 2, borderColor: Colors.background },
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  label: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', maxWidth: 64, textAlign: 'center' },
});

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { data: feed, refetch, isLoading } = useFeed();
  const { user } = useAuthStore();
  const { coins } = useWalletStore();
  const router = useRouter();
  const showSheet = useSheet();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const [isFocused, setIsFocused] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);

  // Configure audio so videos play with sound on Android (default routes audio
  // through earpiece / honors silent mode and produces no sound).
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    setVisibleIds(new Set(viewableItems.map((vi: any) => vi.item.id)));
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderPost = useCallback(({ item }: { item: FeedPost }) =>
    <PostCard post={item} myId={user?.id || ''} isVisible={(visibleIds === null || visibleIds.has(item.id)) && isFocused} />, [user?.id, visibleIds, isFocused]);

  const Header = () => (
    <View>
      <LinearGradient colors={[Colors.background, 'transparent']} style={s.topBarGrad}>
        <View style={s.topBarCentered}>
          <Text style={s.brandTitle}>DateFilipina</Text>
          <Text style={s.brandTagline}>Find your match</Text>
        </View>
      </LinearGradient>

      {/* Friends stories row — tap "You" + button to create a post */}
      <FriendsStrip onCreatePost={() => setShowCreate(true)} />

      {isLoading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={s.loadingText}>Loading posts...</Text>
        </View>
      )}
    </View>
  );

  const Empty = () => !isLoading ? (
    <View style={s.emptyBox}>
      <LinearGradient colors={['rgba(214,26,78,0.1)', 'transparent']} style={s.emptyGrad}>
        <Text style={s.emptyEmoji}>📸</Text>
        <Text style={s.emptyTitle}>No posts yet</Text>
        <Text style={s.emptySub}>Be the first to share something!</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <LinearGradient colors={Gradients.primary} style={s.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.emptyBtnText}>Create First Post ✨</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
          ref={listRef}
          data={feed || []}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          ListHeaderComponent={Header}
          ListEmptyComponent={Empty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={8}
          removeClippedSubviews
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          ItemSeparatorComponent={() => <View style={{ height: 8, backgroundColor: Colors.separator }} />}
        />
      </SafeAreaView>
      <CreatePostModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topBarGrad: { paddingBottom: 4 },
  // Centered brand header (no coin/notif buttons)
  topBarCentered: { alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 10, gap: 2 },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 1.2,
    fontStyle: 'italic',
    textShadowColor: 'rgba(214,26,78,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandTagline: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  createBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, gap: 10, backgroundColor: Colors.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: Colors.glassBorder },
  createBarInput: { flex: 1 },
  createBarText: { color: Colors.textMuted, fontSize: 14 },
  createBarIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8, gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: 14 },
  emptyBox: { marginHorizontal: 16, marginTop: 16, borderRadius: 24, overflow: 'hidden' },
  emptyGrad: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 8, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: Colors.background },
  sharedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  sharedAvatar: { width: 18, height: 18, borderRadius: 9 },
  sharedText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  cardUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardTime: { fontSize: 12, color: Colors.textMuted },
  moreBtn: { padding: 6 },
  moreDots: { color: Colors.textMuted, fontSize: 18, letterSpacing: 2 },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  editBox: { backgroundColor: Colors.card, borderRadius: 20, padding: 20, width: '100%', gap: 14, borderWidth: 1, borderColor: Colors.glassBorder },
  editTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  editInput: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, backgroundColor: Colors.background, borderRadius: 12, padding: 12, minHeight: 80, maxHeight: 160, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.glassBorder },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancel: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.glassBorder },
  editCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 15 },
  editSave: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  editSaveGrad: { height: 44, alignItems: 'center', justifyContent: 'center' },
  editSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Multi-media pager indicators
  mediaCounter: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
  mediaCounterText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  mediaDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  mediaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  mediaDotActive: { backgroundColor: '#fff', width: 14 },
  imageWrapper: { position: 'relative' },
  videoPosterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },
  videoPlayCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  videoWrapper: { position: 'relative' },
  postImage: { width: SW, height: SW * 0.75 },
  imageGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  centreBtn: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centreBtnInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  muteBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  videoBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  videoBadgeText: { fontSize: 13 },
  // Video control bar pinned to bottom
  videoBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 8,
  },
  barIcon: { color: '#fff', fontSize: 17, width: 20, textAlign: 'center' },
  barTime: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', minWidth: 34, textAlign: 'center' },
  scrubTrack: { flex: 1, height: 20, justifyContent: 'center' },
  scrubRail: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  scrubFill: { position: 'absolute', left: 0, height: 3, backgroundColor: Colors.primaryLight, borderRadius: 2 },
  scrubThumb: { position: 'absolute', top: 4, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', marginLeft: -6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, elevation: 3 },
  fullscreenIcon: { paddingLeft: 2 },
  textOnlyBox: { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.glassBorder },
  textOnlyText: { fontSize: 17, color: Colors.textPrimary, lineHeight: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  captionName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  captionText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
});

const pm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  cancel: { fontSize: 16, color: Colors.textSecondary },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  postBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  postText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  captionInput: { flex: 1, color: Colors.textPrimary, fontSize: 16, lineHeight: 22, minHeight: 80 },
  charCount: { color: Colors.textMuted, fontSize: 11, textAlign: 'right', paddingRight: 16, marginBottom: 8 },
  previewArea: { width: SW, height: SW * 0.75, position: 'relative' },
  preview: { width: '100%', height: '100%' },
  previewOverlay: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 8 },
  changeBtn: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  changeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  videoBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  // Multi-media thumb strip
  thumbStrip: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexDirection: 'row' },
  thumbWrap: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: Colors.glassBorder },
  thumb: { width: '100%', height: '100%' },
  thumbImg: { width: '100%', height: '100%' },
  thumbVideoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  thumbIndex: { position: 'absolute', bottom: 4, left: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)' },
  thumbIndexText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  thumbAdd: { width: 92, height: 92, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(214,26,78,0.06)' },
  thumbAddText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  mediaRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden' },
  mediaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  mediaDivider: { width: 1, backgroundColor: Colors.glassBorder, marginVertical: 10 },
  mediaIcon: { fontSize: 22 },
  mediaLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  uploadBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, backgroundColor: 'rgba(214,26,78,0.1)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(214,26,78,0.25)' },
  uploadText: { color: Colors.primaryLight, fontSize: 14, fontWeight: '600' },
});

const cm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
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
