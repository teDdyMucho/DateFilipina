import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { profileService } from '@/services/profileService';
import { messageService } from '@/services/messageService';
import { useFollowStatus, useToggleFollow } from '@/hooks/useProfile';
import { useShareToFeed } from '@/hooks/useFeed';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { Colors, Gradients } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useSheet } from '@/components/GlobalActionSheet';
import { MediaViewer, MediaItem } from '@/components/MediaViewer';
import { CommentsModal } from '@/components/CommentsModal';
import { ReportSheet } from '@/components/ReportSheet';

const { width: W } = Dimensions.get('window');

// ─── Post card (read-only, no edit/delete) ────────────────────────────────────

function PublicPostCard({ post, profile }: { post: any; profile: any }) {
  const isVideo = post.media_type === 'video';
  const mediaUrl = post.media_urls?.[0];
  const [showComments, setShowComments] = useState(false);
  const { mutate: shareToFeed } = useShareToFeed();
  const showSheet = useSheet();

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showSheet({
      title: 'Share Post',
      options: [
        {
          label: 'Share to My Feed',
          onPress: () => shareToFeed(
            {
              userId: profile?.id || '',
              userName: profile?.name || 'Unknown',
              userAvatar: profile?.avatar || '',
              caption: post.caption || '',
              imageUrl: mediaUrl || '',
              mediaType: post.media_type || 'photo',
            },
            {
              onSuccess: () => showSheet({ title: 'Shared!', message: `${profile?.name}'s post has been added to your feed.`, options: [{ label: 'OK' }] }),
              onError: (e: any) => showSheet({ title: 'Error', message: e.message || 'Could not share post.', options: [{ label: 'OK' }] }),
            }
          ),
        },
        {
          label: 'Share Externally',
          onPress: () => Share.share({
            message: `Check out ${profile?.name}'s post on Date A Filipina!${post.caption ? `\n\n"${post.caption}"` : ''}`,
          }).catch(() => {}),
        },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <Text style={s.postTime}>
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </Text>
      </View>

      {post.caption ? <Text style={s.postCaption}>{post.caption}</Text> : null}

      {mediaUrl ? (
        isVideo ? (
          <Video
            source={{ uri: mediaUrl }}
            style={s.postMedia}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            shouldPlay={false}
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={s.postMedia} contentFit="cover" />
        )
      ) : null}

      {/* Actions — matches home feed for consistency */}
      <View style={s.actions}>
        <View style={s.actionsLeft}>
          <View style={s.actionBtn}>
            <Ionicons name="heart-outline" size={22} color={Colors.textSecondary} />
            <Text style={s.actionCount}>{post.likes_count || 0}</Text>
          </View>
          <TouchableOpacity style={s.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowComments(true); }} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={21} color={Colors.textSecondary} />
            <Text style={s.actionCount}>{post.comments_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <CommentsModal visible={showComments} postId={post.id} onClose={() => setShowComments(false)} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type MediaFilter = 'all' | 'photo' | 'video';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [creatingConv, setCreatingConv] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const showSheet = useSheet();

  const myId = me?.id ?? '';
  const targetId = id ?? '';

  const { data: isFollowing = false } = useFollowStatus(myId, targetId);
  const { mutate: toggleFollow, isPending: followPending } = useToggleFollow(myId, targetId);

  const handleMessage = async () => {
    if (!me?.id || !id) return;
    setCreatingConv(true);
    try {
      const convId = await messageService.getOrCreateConversation(me.id, id);
      router.push({ pathname: '/chat/[id]', params: { id: convId } } as any);
    } catch {
      showSheet({ title: 'Error', message: 'Could not open chat. Please try again.', options: [{ label: 'OK' }] });
    } finally {
      setCreatingConv(false);
    }
  };

  const openViewer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIndex(idx);
    setViewerVisible(true);
  };

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => profileService.getProfile(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['userPosts', id],
    queryFn: () => profileService.getUserPosts(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const isOwnProfile = id === me?.id;

  const toggle = (type: 'photo' | 'video') =>
    setFilter(f => (f === type ? 'all' : type));

  const filtered = (posts || []).filter((p: any) => {
    if (filter === 'all') return true;
    if (filter === 'photo') return p.media_type === 'photo' && p.media_urls?.length > 0;
    if (filter === 'video') return p.media_type === 'video' && p.media_urls?.length > 0;
    return true;
  });

  // Gallery items — every post with a media URL, filtered by photo/video
  const mediaPosts = (posts || []).filter((p: any) => {
    if (!p.media_urls?.[0]) return false;
    if (filter === 'photo') return p.media_type === 'photo';
    if (filter === 'video') return p.media_type === 'video';
    return true;
  });

  const galleryItems: MediaItem[] = mediaPosts.map((p: any) => ({
    id: p.id,
    url: p.media_urls[0],
    type: (p.media_type === 'video' ? 'video' : 'photo') as 'video' | 'photo',
  }));

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {profileLoading ? (
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={s.navbar}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.navTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        </SafeAreaView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Cover photo — extends to top of screen, behind status bar */}
          <View style={s.cover}>
            {profile?.cover ? (
              <Image source={{ uri: profile.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={['#5A1530', '#2A0A14', Colors.background]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'transparent']}
              style={s.coverTopFade}
            />
            <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              <View style={s.navbarOverlay}>
                <TouchableOpacity style={s.navBtnDark} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={s.navTitleOverlay} numberOfLines={1}>{profile?.name}</Text>
                {!isOwnProfile ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={s.navBtnDark} onPress={handleMessage} disabled={creatingConv}>
                      {creatingConv
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.navBtnDark}
                      onPress={() => showSheet({
                        title: profile?.name || 'User',
                        options: [
                          { label: 'Report User', destructive: true, onPress: () => setShowReportSheet(true) },
                          { label: 'Cancel' },
                        ],
                      })}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : <View style={{ width: 40 }} />}
              </View>
            </SafeAreaView>
          </View>

          {/* Profile hero — avatar overlaps cover */}
          <View style={s.hero}>
              <View style={s.avatarOverlap}>
                <AvatarWithRing uri={profile?.avatar || ''} size={94} isOnline={profile?.isOnline} />
              </View>

              <View style={s.nameRow}>
                <Text style={s.name}>{profile?.name}</Text>
                {profile?.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                )}
                {profile?.isOnline && (
                  <View style={s.onlineDot} />
                )}
              </View>

              {/* Meta info */}
              <View style={s.metaRow}>
                {!!profile?.age && (
                  <View style={s.metaChip}>
                    <Ionicons name="gift-outline" size={13} color={Colors.textMuted} />
                    <Text style={s.metaText}>{profile.age} yrs</Text>
                  </View>
                )}
                {!!profile?.location && (
                  <View style={s.metaChip}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={s.metaText}>{profile.location}</Text>
                  </View>
                )}
                {!!profile?.occupation && (
                  <View style={s.metaChip}>
                    <Ionicons name="briefcase-outline" size={13} color={Colors.textMuted} />
                    <Text style={s.metaText}>{profile.occupation}</Text>
                  </View>
                )}
              </View>

              {/* Bio */}
              {!!profile?.bio && (
                <Text style={s.bio}>{profile.bio}</Text>
              )}

              {/* Stats */}
              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statValue}>{posts?.length ?? 0}</Text>
                  <Text style={s.statLabel}>Posts</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statBox}>
                  <Text style={s.statValue}>{profile?.followers ?? 0}</Text>
                  <Text style={s.statLabel}>Followers</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statBox}>
                  <Text style={s.statValue}>{profile?.following ?? 0}</Text>
                  <Text style={s.statLabel}>Following</Text>
                </View>
              </View>

              {/* Interests */}
              {(profile?.interests || []).length > 0 && (
                <View style={s.interestWrap}>
                  {profile!.interests.map(i => (
                    <View key={i} style={s.interestChip}>
                      <Text style={s.interestText}>{i}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Message button */}
              {!isOwnProfile && (
                <View style={s.actionBtns}>
                  {/* Follow / Following */}
                  <TouchableOpacity
                    style={[s.followBtn, isFollowing && s.followingBtn]}
                    activeOpacity={0.8}
                    disabled={followPending}
                    onPress={() => toggleFollow(isFollowing)}
                  >
                    {followPending
                      ? <ActivityIndicator size="small" color={isFollowing ? Colors.primary : '#fff'} />
                      : <>
                          <Ionicons
                            name={isFollowing ? 'checkmark' : 'person-add-outline'}
                            size={16}
                            color={isFollowing ? Colors.primary : '#fff'}
                          />
                          <Text style={[s.followBtnText, isFollowing && s.followingBtnText]}>
                            {isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </>
                    }
                  </TouchableOpacity>

                  {/* Message */}
                  <TouchableOpacity
                    style={s.msgBtn}
                    activeOpacity={0.85}
                    onPress={handleMessage}
                    disabled={creatingConv}
                  >
                    <LinearGradient
                      colors={Gradients.primary}
                      style={s.msgBtnInner}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {creatingConv
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                            <Text style={s.msgBtnText}>Message</Text>
                          </>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Media filter */}
            <View style={s.filterRow}>
              <TouchableOpacity
                style={[s.filterBtn, filter === 'photo' && s.filterActive]}
                onPress={() => toggle('photo')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={filter === 'photo' ? 'camera' : 'camera-outline'}
                  size={16}
                  color={filter === 'photo' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[s.filterLabel, filter === 'photo' && s.filterLabelActive]}>Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.filterBtn, filter === 'video' && s.filterActive]}
                onPress={() => toggle('video')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={filter === 'video' ? 'videocam' : 'videocam-outline'}
                  size={16}
                  color={filter === 'video' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[s.filterLabel, filter === 'video' && s.filterLabelActive]}>Videos</Text>
              </TouchableOpacity>
            </View>

            {/* Posts list */}
            {postsLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (filter === 'photo' || filter === 'video') ? (
              galleryItems.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons
                    name={filter === 'video' ? 'videocam-outline' : 'camera-outline'}
                    size={52}
                    color={Colors.textMuted}
                  />
                  <Text style={s.emptyText}>No {filter === 'video' ? 'videos' : 'photos'} yet</Text>
                </View>
              ) : (
              <View style={s.grid}>
                {galleryItems.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.gridCell}
                    activeOpacity={0.75}
                    onPress={() => openViewer(idx)}
                  >
                    {item.type === 'video' ? (
                      <View style={s.videoCell}>
                        <Video
                          source={{ uri: item.url }}
                          style={s.cellImg}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          isMuted
                          positionMillis={500}
                        />
                        <View style={s.videoOverlay} pointerEvents="none">
                          <View style={s.videoIconWrap}>
                            <Ionicons name="play" size={22} color="#fff" />
                          </View>
                        </View>
                        <View style={s.videoCornerTag} pointerEvents="none">
                          <Ionicons name="videocam" size={11} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image source={{ uri: item.url }} style={s.cellImg} contentFit="cover" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              )
            ) : filtered.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="document-text-outline" size={52} color={Colors.textMuted} />
                <Text style={s.emptyText}>No posts yet</Text>
              </View>
            ) : (
              <View style={{ paddingTop: 8 }}>
                {filtered.map((post: any) => (
                  <PublicPostCard key={post.id} post={post} profile={profile} />
                ))}
              </View>
            )}
        </ScrollView>
      )}

      <MediaViewer
        visible={viewerVisible}
        items={galleryItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
      <ReportSheet
        visible={showReportSheet}
        targetType="user"
        targetId={id || ''}
        targetLabel={profile?.name || 'this user'}
        onClose={() => setShowReportSheet(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerMsgBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    height: 200,
    position: 'relative',
  },
  coverTopFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  navbarOverlay: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  navBtnDark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  navTitleOverlay: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  avatarOverlap: { borderWidth: 4, borderColor: Colors.background, borderRadius: 60 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
    marginTop: -52,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  bio: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    width: '100%',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.glassBorder,
  },
  interestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(214,26,78,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(214,26,78,0.3)',
  },
  interestText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  followingBtnText: {
    color: Colors.primary,
  },
  msgBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  msgBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  msgBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.background,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  filterActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(214,26,78,0.12)',
  },
  filterLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: Colors.primary,
  },
  postCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  postHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  postTime: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  postCaption: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  postMedia: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  statGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postStatText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  shareBtn: { padding: 4 },
  // Match home feed actions row
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  actionCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  // Gallery grid (3 columns)
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2, paddingTop: 4 },
  gridCell: { width: '33.333%', aspectRatio: 1, padding: 2 },
  cellImg: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#1a1a1a' },
  videoCell: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#1a1a1a', overflow: 'hidden' },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  videoIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  videoCornerTag: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
});
