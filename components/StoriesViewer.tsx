import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, Dimensions, Animated, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import { UserStories } from '@/services/storyService';
import { useDeleteStory, useCreateStory } from '@/hooks/useStories';
import { useAuthStore } from '@/store/authStore';
import { useSheet } from '@/components/GlobalActionSheet';

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
  const listRef = useRef<FlatList<UserStories>>(null);
  const [userIndex, setUserIndex] = useState(initialUserIndex);

  // Reset index when the viewer opens
  useEffect(() => {
    if (visible) {
      setUserIndex(initialUserIndex);
      // Jump to the requested user without animation on open
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: initialUserIndex * SW, animated: false });
      }, 0);
    }
  }, [visible, initialUserIndex]);

  const onMomentumScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (i !== userIndex) {
      Haptics.selectionAsync();
      setUserIndex(i);
    }
  };

  const goNextUser = () => {
    if (userIndex < users.length - 1) {
      listRef.current?.scrollToOffset({ offset: (userIndex + 1) * SW, animated: true });
    } else {
      onClose();
    }
  };

  const goPrevUser = () => {
    if (userIndex > 0) {
      listRef.current?.scrollToOffset({ offset: (userIndex - 1) * SW, animated: true });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={s.root}>
        <FlatList
          ref={listRef}
          data={users}
          keyExtractor={u => u.userId}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          bounces={false}
          overScrollMode="never"
          renderItem={({ item, index }) => (
            <UserStoryPage
              user={item}
              isActive={visible && index === userIndex}
              onAllDone={goNextUser}
              onPrevUser={goPrevUser}
              onClose={onClose}
            />
          )}
        />
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
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const story = user.stories[idx];
  const isMine = me?.id === user.userId;

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
    if (!isActive || paused) {
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
  }, [isActive, idx, paused, user.stories.length]);

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
});
