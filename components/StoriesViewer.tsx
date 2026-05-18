import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated, StatusBar,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import { UserStories, STORY_REACTIONS, StoryReactionKey } from '@/services/storyService';
import { useDeleteStory, useCreateStory, useStoryReactions, useReactToStory } from '@/hooks/useStories';
import { useAuthStore } from '@/store/authStore';
import { useSheet } from '@/components/GlobalActionSheet';
import { messageService } from '@/services/messageService';

const { width: SW, height: SH } = Dimensions.get('window');
const STORY_DURATION_MS = 5000;

interface Props {
  visible: boolean;
  users: UserStories[];
  initialUserIndex: number;
  onClose: () => void;
}

// Fullscreen viewer:
//  - One horizontal page per user (swipe sideways to jump to the next user's story)
//  - Within a user, multiple stories auto-advance every 5s — tap left/right to step.
//  - Top progress bars show position within the active user's stories.
export function StoriesViewer({ visible, users, initialUserIndex, onClose }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [userIndex, setUserIndex] = useState(initialUserIndex);

  // Reset index + jump to the requested page when the viewer opens. Plain
  // ScrollView renders ALL pages eagerly (vs FlatList virtualization), so
  // scrollTo always lands on a real laid-out child — no more black screens
  // from items that haven't been rendered yet.
  useEffect(() => {
    if (visible) {
      const safe = Math.max(0, Math.min(initialUserIndex, users.length - 1));
      setUserIndex(safe);
      // Multiple retries to handle ScrollView layout timing on Android
      const jumps = [0, 50, 150, 300];
      const timers = jumps.map(d => setTimeout(() => {
        scrollRef.current?.scrollTo({ x: safe * SW, y: 0, animated: false });
      }, d));
      return () => { timers.forEach(clearTimeout); };
    }
  }, [visible, initialUserIndex, users.length]);

  const onMomentumScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (i !== userIndex) {
      Haptics.selectionAsync();
      setUserIndex(i);
    }
  };

  const goNextUser = () => {
    if (userIndex < users.length - 1) {
      scrollRef.current?.scrollTo({ x: (userIndex + 1) * SW, y: 0, animated: true });
    } else {
      onClose();
    }
  };

  const goPrevUser = () => {
    if (userIndex > 0) {
      scrollRef.current?.scrollTo({ x: (userIndex - 1) * SW, y: 0, animated: true });
    }
  };

  // Clamp the start index so an out-of-bounds value doesn't push the FlatList
  // off the renderable window (which previously produced a black screen on
  // some opens). Also guard against opening with zero users.
  const safeStartIndex = Math.max(0, Math.min(initialUserIndex, users.length - 1));
  const hasUsers = users.length > 0;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={s.root}>
        {/* Render the FlatList only while visible AND we have data — this
            guarantees a fresh mount on every open so `initialScrollIndex`
            actually lands on the requested user (not stuck at the last
            viewed offset). Without this conditional, the Modal keeps the
            FlatList mounted and the original initialScrollIndex sticks. */}
        {visible && hasUsers && (
          // The key forces a brand-new ScrollView every time the viewer opens
          // at a different start index — eliminating any stale scroll state.
          // `contentOffset` lands the scroll on the right page from the very
          // first frame (before any scrollTo runs in the effect).
          <ScrollView
            key={`storyview-${initialUserIndex}-${users.length}`}
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            bounces={false}
            overScrollMode="never"
            decelerationRate="fast"
            contentOffset={{ x: safeStartIndex * SW, y: 0 }}
          >
            {users.map((u, index) => (
              <UserStoryPage
                key={u.userId}
                user={u}
                isActive={index === userIndex}
                onAllDone={goNextUser}
                onPrevUser={goPrevUser}
                onClose={onClose}
              />
            ))}
          </ScrollView>
        )}
        {/* Close button is rendered separately so it works even if the list
            failed to render any items (no more dead black screen with no way out). */}
        {visible && !hasUsers && (
          <View style={s.emptyClose}>
            <TouchableOpacity onPress={onClose} style={s.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// One vertical full-screen page for a single user's stories.
function UserStoryPage({
  user,
  isActive,
  onAllDone,
  onPrevUser,
  onClose,
}: {
  user: UserStories;
  isActive: boolean;
  onAllDone: () => void;
  onPrevUser: () => void;
  onClose: () => void;
}) {
  const me = useAuthStore(state => state.user);
  const { mutate: deleteStory } = useDeleteStory();
  const { mutate: createStory } = useCreateStory();
  const showSheet = useSheet();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const story = user.stories[idx];
  const isMine = me?.id === user.userId;
  const { data: reactions } = useStoryReactions(isActive ? story?.id : undefined);
  const { mutate: reactToStory } = useReactToStory();

  // Reset index when becoming the active page; stop progress when inactive
  useEffect(() => {
    if (isActive) {
      setIdx(0);
    } else {
      animationRef.current?.stop();
    }
  }, [isActive, user.userId]);

  // Drive the progress bar; advance to next when it hits 1
  useEffect(() => {
    if (!isActive || paused || replyFocused) {
      animationRef.current?.stop();
      return;
    }
    progress.setValue(0);
    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    });
    animationRef.current.start(({ finished }) => {
      if (!finished) return;
      if (idx < user.stories.length - 1) {
        setIdx(i => i + 1);
      } else {
        onAllDone();
      }
    });
    return () => {
      animationRef.current?.stop();
    };
  }, [isActive, idx, paused, replyFocused, user.stories.length]);

  // Clear the reply draft when moving to a different story
  useEffect(() => {
    setReplyText('');
  }, [story?.id]);

  // Per-reaction tap throttle: ignore taps on the same reaction within 600ms
  // of the previous tap. Prevents rapid spam from creating jitter in the
  // optimistic state while in-flight mutations are still resolving.
  const lastTapRef = useRef<Record<string, number>>({});
  const handleReaction = (key: StoryReactionKey) => {
    if (!story?.id || isMine) return;
    const now = Date.now();
    const last = lastTapRef.current[key] || 0;
    if (now - last < 600) return; // throttle
    lastTapRef.current[key] = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactToStory({ storyId: story.id, reaction: key });
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || !me?.id || isMine || replySending) return;
    setReplySending(true);
    try {
      const convId = await messageService.getOrCreateConversation(me.id, user.userId);
      // Pass the story id so the chat bubble can show a thumbnail of what's
      // being replied to (the recipient sees the actual My Day image, not just
      // a "Replied to your My Day" prefix). If the story expires/gets deleted,
      // the bubble silently falls back to plain text.
      await messageService.sendMessage(convId, me.id, text, 'text', story.id);
      setReplyText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      showSheet({ title: 'Send failed', message: e?.message || 'Could not send reply.', options: [{ label: 'OK' }] });
    } finally {
      setReplySending(false);
    }
  };

  const handleTap = (side: 'left' | 'right') => {
    if (side === 'right') {
      if (idx < user.stories.length - 1) setIdx(i => i + 1);
      else onAllDone();
    } else {
      if (idx > 0) setIdx(i => i - 1);
      else onPrevUser();
    }
  };

  const doDelete = () => {
    if (!isMine) return;
    deleteStory(story.id, {
      onSuccess: () => {
        if (user.stories.length <= 1) {
          onClose();
        } else if (idx >= user.stories.length - 1) {
          setIdx(i => Math.max(0, i - 1));
        }
      },
    });
  };

  // "Edit" = replace this story's photo. Delete the current one and upload a
  // new one in one motion. Closes the viewer after a successful replace since
  // the cached list is now stale; the strip will re-render with the new image.
  const doEdit = async () => {
    if (!isMine) return;
    setPaused(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showSheet({ title: 'Permission needed', message: 'Allow photo library access in settings.', options: [{ label: 'OK' }] });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const oldId = story.id;
      createStory({ uri: result.assets[0].uri, type: 'photo' }, {
        onSuccess: () => {
          deleteStory(oldId, { onSuccess: () => onClose() });
        },
        onError: (e: any) => showSheet({ title: 'Upload failed', message: e.message || 'Could not update My Day.', options: [{ label: 'OK' }] }),
      });
    } finally {
      setPaused(false);
    }
  };

  const handleOptions = () => {
    if (!isMine) return;
    setPaused(true);
    showSheet({
      title: 'My Day',
      options: [
        { label: 'Edit', onPress: () => { setPaused(false); doEdit(); } },
        { label: 'Delete', destructive: true, onPress: () => {
          setPaused(false);
          showSheet({
            title: 'Delete this My Day?',
            message: 'This cannot be undone.',
            options: [
              { label: 'Delete', destructive: true, onPress: doDelete },
              { label: 'Cancel', style: 'cancel' },
            ],
          });
        } },
        { label: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
      ],
    });
  };

  return (
    <View style={s.page}>
      <Image
        source={{ uri: story?.mediaUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />

      {/* Tap zones — left/right for prev/next, center long-press to pause */}
      <View style={s.tapRow} pointerEvents="box-none">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => handleTap('left')}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          delayLongPress={150}
        />
        <TouchableOpacity
          style={{ flex: 2 }}
          activeOpacity={1}
          onPress={() => handleTap('right')}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          delayLongPress={150}
        />
      </View>

      {/* Top overlay — progress bars + user info + close */}
      <View style={s.topOverlay} pointerEvents="box-none">
        <View style={s.progressRow}>
          {user.stories.map((_, i) => (
            <View key={i} style={s.progressTrack}>
              <Animated.View
                style={[
                  s.progressFill,
                  {
                    width: i < idx
                      ? '100%'
                      : i > idx
                        ? '0%'
                        : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  } as any,
                ]}
              />
            </View>
          ))}
        </View>
        <View style={s.headerRow}>
          <Image source={{ uri: user.userAvatar }} style={s.headerAvatar} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{user.userName}</Text>
            {story && (
              <Text style={s.headerTime}>
                {formatDistanceToNow(story.createdAt, { addSuffix: true })}
              </Text>
            )}
          </View>
          {isMine && (
            <TouchableOpacity onPress={handleOptions} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={s.headerBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom overlay — reactions row + reply input (others), or reactors list (mine) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.bottomOverlay}
        pointerEvents="box-none"
      >
        {isMine ? (
          <MyReactorsList reactors={reactions?.all ?? []} />
        ) : (
          <View pointerEvents="box-none">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.reactionRow}
            >
              {STORY_REACTIONS.map(r => {
                // mine is an array — multiple reactions can be selected at once
                const selected = (reactions?.mine ?? []).includes(r.key);
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => handleReaction(r.key)}
                    style={s.reactionBtn}
                    activeOpacity={0.5}
                  >
                    <MaterialCommunityIcons
                      name={r.icon as any}
                      size={selected ? 34 : 28}
                      color={selected ? r.color : 'rgba(255,255,255,0.85)'}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={s.replyRow}>
              <TextInput
                style={s.replyInput}
                placeholder={`Reply to ${user.userName}...`}
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                multiline
                maxLength={300}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleSendReply}
              />
              <TouchableOpacity
                onPress={handleSendReply}
                disabled={!replyText.trim() || replySending}
                style={[s.replySendBtn, (!replyText.trim() || replySending) && { opacity: 0.4 }]}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// For the story owner — list of unique reactors, each row showing their
// avatar + name + all reactions they sent (inline icons).
function MyReactorsList({ reactors }: { reactors: Array<{ userId: string; userName: string; userAvatar: string; reaction: StoryReactionKey }> }) {
  if (reactors.length === 0) {
    return (
      <View style={s.noReactorsBox}>
        <Ionicons name="heart-outline" size={16} color="rgba(255,255,255,0.65)" />
        <Text style={s.noReactorsText}>No reactions yet</Text>
      </View>
    );
  }

  // Group reactions by user — one row per reactor, multiple reaction icons inline
  type Grouped = { userId: string; userName: string; userAvatar: string; reactions: StoryReactionKey[] };
  const byUser = new Map<string, Grouped>();
  for (const r of reactors) {
    const existing = byUser.get(r.userId);
    if (existing) {
      if (!existing.reactions.includes(r.reaction)) existing.reactions.push(r.reaction);
    } else {
      byUser.set(r.userId, {
        userId: r.userId, userName: r.userName, userAvatar: r.userAvatar,
        reactions: [r.reaction],
      });
    }
  }
  const grouped = Array.from(byUser.values());
  const reactionMetaFor = (key: StoryReactionKey) => STORY_REACTIONS.find(r => r.key === key);
  const totalReacts = reactors.length;

  return (
    <View style={s.reactorsWrap}>
      <Text style={s.reactorsCount}>
        {grouped.length} {grouped.length === 1 ? 'person' : 'people'} · {totalReacts} reaction{totalReacts === 1 ? '' : 's'}
      </Text>
      <ScrollView style={s.reactorsListScroll} showsVerticalScrollIndicator={false}>
        {grouped.map(g => (
          <View key={g.userId} style={s.reactorRow}>
            <Image source={{ uri: g.userAvatar }} style={s.reactorRowAvatar} contentFit="cover" />
            <Text style={s.reactorRowName} numberOfLines={1}>{g.userName}</Text>
            <View style={s.reactorRowIcons}>
              {g.reactions.map(rk => {
                const meta = reactionMetaFor(rk);
                if (!meta) return null;
                return (
                  <MaterialCommunityIcons
                    key={rk}
                    name={meta.icon as any}
                    size={18}
                    color={meta.color}
                    style={{ marginLeft: 4 }}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  page: { width: SW, height: SH, backgroundColor: '#000' },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: 12 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingVertical: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#333' },
  headerName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  // Bottom overlay — reactions + reply (or reactors list for own story)
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28 },
  // Reaction row: just the icons, no circles or borders — clean modern look
  reactionRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 14, alignItems: 'center' },
  reactionBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 14, paddingTop: 6 },
  replyInput: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 19, minHeight: 42, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  replySendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },

  // Owner-facing reactors list
  noReactorsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 18 },
  noReactorsText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },
  reactorsWrap: { paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  reactorsCount: { color: '#fff', fontSize: 12, fontWeight: '700', paddingLeft: 4 },
  reactorsListScroll: { maxHeight: 160 },
  reactorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, gap: 10 },
  reactorRowAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' },
  reactorRowName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  reactorRowIcons: { flexDirection: 'row', alignItems: 'center' },
  // Fallback close button when there's nothing to show (prevents stuck black screen)
  emptyClose: { position: 'absolute', top: 44, right: 18, zIndex: 10 },
});
