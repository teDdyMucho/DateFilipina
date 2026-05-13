import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Modal, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { GradientButton } from '@/components/GradientButton';
import { GlassCard } from '@/components/GlassCard';
import { Colors, Gradients } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useLogout } from '@/hooks/useAuth';
import { useUpdateProfile, useUserPosts } from '@/hooks/useProfile';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useSheet } from '@/components/GlobalActionSheet';
import { useDeletePost, useUpdatePost } from '@/hooks/useFeed';
import { ActionSheet } from '@/components/ActionSheet';
import { CommentsModal } from '@/components/CommentsModal';
import { MediaViewer, MediaItem } from '@/components/MediaViewer';
import { COIN_PACKAGES, GIFTS } from '@/constants';
import { formatDistanceToNow } from 'date-fns';

const { width: W } = Dimensions.get('window');
const POST_SIZE = (W - 4) / 3;

const INTERESTS_OPTIONS = [
  'Travel', 'Music', 'Food', 'Fitness', 'Movies', 'Reading',
  'Gaming', 'Art', 'Dance', 'Cooking', 'Photography', 'Fashion',
  'Sports', 'Nature', 'Coffee', 'Anime',
];

const TABS = [
  { key: 'posts', label: 'Posts', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'info', label: 'Info', icon: 'person-outline', iconActive: 'person' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet-outline', iconActive: 'wallet' },
] as const;

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <View style={tb.row}>
      {TABS.map(t => (
        <TouchableOpacity key={t.key} style={[tb.tab, active === t.key && tb.activeTab]} onPress={() => onChange(t.key)}>
          <Ionicons
            name={active === t.key ? t.iconActive : t.icon}
            size={18}
            color={active === t.key ? Colors.primary : Colors.textMuted}
          />
          <Text style={[tb.label, active === t.key && tb.activeLabel]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const tb = StyleSheet.create({
  row: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.glassBorder, marginTop: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  icon: { fontSize: 14, color: Colors.textMuted },
  activeIcon: { color: Colors.primary },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  activeLabel: { color: Colors.primary },
});

function StatBox({ value, label }: { value: number; label: string }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{display}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MyPostCard({ post, user }: { post: any; user: any }) {
  const { mutate: deletePost } = useDeletePost();
  const { mutate: updatePost } = useUpdatePost();
  const showSheet = useSheet();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const isVideo = post.media_type === 'video';
  const mediaUrl = post.media_urls?.[0];

  const handleOptions = () => setShowActionSheet(true);
  const handleComments = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowComments(true); };

  return (
    <View style={pc.card}>
      {/* Header */}
      <View style={pc.header}>
        <AvatarWithRing uri={user?.avatar} size={38} isOnline={user?.isOnline} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={pc.name}>{user?.name}</Text>
          <Text style={pc.time}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</Text>
        </View>
        <TouchableOpacity onPress={handleOptions} style={pc.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption ? <Text style={pc.caption}>{post.caption}</Text> : null}

      {/* Media */}
      {mediaUrl ? (
        isVideo ? (
          <Video
            source={{ uri: mediaUrl }}
            style={pc.media}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            shouldPlay={false}
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={pc.media} contentFit="cover" />
        )
      ) : null}

      {/* Actions — same UI as home feed for consistency */}
      <View style={pc.actions}>
        <View style={pc.actionsLeft}>
          <View style={pc.actionBtn}>
            <Ionicons name="heart-outline" size={22} color={Colors.textSecondary} />
            <Text style={pc.actionCount}>{post.likes_count || 0}</Text>
          </View>
          <TouchableOpacity style={pc.actionBtn} onPress={handleComments} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={21} color={Colors.textSecondary} />
            <Text style={pc.actionCount}>{post.comments_count || 0}</Text>
          </TouchableOpacity>
          <View style={pc.actionBtn}>
            <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
          </View>
        </View>
      </View>

      <CommentsModal visible={showComments} postId={post.id} onClose={() => setShowComments(false)} />

      <ActionSheet
        visible={showActionSheet}
        title="Post Options"
        options={[
          {
            label: 'Edit Caption',
            onPress: () => { setEditCaption(post.caption || ''); setShowEditModal(true); },
          },
          {
            label: 'Delete Post',
            style: 'destructive',
            onPress: () => showSheet({
              title: 'Delete Post?',
              message: 'This post will be permanently deleted.',
              options: [
                { label: 'Delete', destructive: true, onPress: () => deletePost(post.id) },
                { label: 'Cancel' },
              ],
            }),
          },
          { label: 'Cancel', style: 'cancel' },
        ]}
        onClose={() => setShowActionSheet(false)}
      />

      <Modal visible={showEditModal} transparent animationType="none" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={pc.editOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)}>
            <TouchableOpacity activeOpacity={1} style={pc.editBox}>
              <Text style={pc.editTitle}>Edit Caption</Text>
              <TextInput
                style={pc.editInput}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                autoFocus
                maxLength={500}
                placeholder="Write a caption..."
                placeholderTextColor={Colors.textMuted}
              />
              <View style={pc.editActions}>
                <TouchableOpacity style={pc.editCancel} onPress={() => setShowEditModal(false)}>
                  <Text style={pc.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={pc.editSave}
                  onPress={() => { updatePost({ postId: post.id, caption: editCaption }); setShowEditModal(false); }}
                >
                  <LinearGradient colors={Gradients.primary} style={pc.editSaveGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={pc.editSaveText}>Save</Text>
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

const pc = StyleSheet.create({
  card: { backgroundColor: Colors.card, marginHorizontal: 16, marginBottom: 14, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  name: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  time: { color: Colors.textMuted, fontSize: 12 },
  moreBtn: { padding: 4 },
  caption: { color: Colors.textPrimary, fontSize: 15, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 12 },
  media: { width: '100%', aspectRatio: 4 / 3 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 14 },
  statGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  statHint: { color: Colors.textMuted, fontSize: 11, marginLeft: 4, fontWeight: '500' },
  // Match home feed actions row
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  actionCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
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
});

type MediaFilter = 'all' | 'photo' | 'video';

function PostsGrid({ userId, user }: { userId: string; user: any }) {
  const { data: posts, isLoading } = useUserPosts(userId);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const toggle = (type: 'photo' | 'video') =>
    setFilter(f => (f === type ? 'all' : type));

  const filtered = (posts || []).filter((p: any) => {
    if (filter === 'all') return true;
    if (filter === 'photo') return p.media_type === 'photo' && p.media_urls?.length > 0;
    if (filter === 'video') return p.media_type === 'video' && p.media_urls?.length > 0;
    return true;
  });

  // For the gallery view, build a MediaItem list of just the URLs
  const galleryItems: MediaItem[] = filtered
    .filter((p: any) => p.media_urls?.[0])
    .map((p: any) => ({
      id: p.id,
      url: p.media_urls[0],
      type: (p.media_type === 'video' ? 'video' : 'photo') as 'video' | 'photo',
    }));

  const openViewer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIndex(idx);
    setViewerVisible(true);
  };

  const emptyLabel =
    filter === 'photo' ? 'No photos yet' :
    filter === 'video' ? 'No videos yet' : 'No posts yet';

  const showGallery = filter === 'photo' || filter === 'video';

  return (
    <View>
      {/* Media filter buttons */}
      <View style={mf.row}>
        <TouchableOpacity
          style={[mf.btn, filter === 'photo' && mf.activeBtn]}
          onPress={() => toggle('photo')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={filter === 'photo' ? 'camera' : 'camera-outline'}
            size={17}
            color={filter === 'photo' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[mf.label, filter === 'photo' && mf.activeLabel]}>Photos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[mf.btn, filter === 'video' && mf.activeBtn]}
          onPress={() => toggle('video')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={filter === 'video' ? 'videocam' : 'videocam-outline'}
            size={17}
            color={filter === 'video' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[mf.label, filter === 'video' && mf.activeLabel]}>Videos</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyPosts}>
          <Ionicons
            name={filter === 'video' ? 'videocam-outline' : 'camera-outline'}
            size={52}
            color={Colors.textMuted}
          />
          <Text style={s.emptyTitle}>{emptyLabel}</Text>
          <Text style={s.emptySubtitle}>Share your {filter === 'video' ? 'videos' : 'photos'} to attract more matches</Text>
        </View>
      ) : showGallery ? (
        // 3-column gallery grid — no captions/comments visible. Tap to open fullscreen viewer.
        <View style={mf.grid}>
          {galleryItems.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={mf.cell}
              activeOpacity={0.75}
              onPress={() => openViewer(idx)}
            >
              {item.type === 'video' ? (
                <View style={mf.videoCell}>
                  <Video
                    source={{ uri: item.url }}
                    style={mf.cellImg}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted
                    positionMillis={500}
                  />
                  <View style={mf.videoOverlay} pointerEvents="none">
                    <View style={mf.videoIconWrap}>
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  </View>
                  <View style={mf.videoCornerTag} pointerEvents="none">
                    <Ionicons name="videocam" size={11} color="#fff" />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={mf.cellImg} contentFit="cover" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ paddingTop: 8 }}>
          {filtered.map((post: any) => (
            <MyPostCard key={post.id} post={post} user={user} />
          ))}
        </View>
      )}

      <MediaViewer
        visible={viewerVisible}
        items={galleryItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const mf = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    backgroundColor: Colors.background,
  },
  btn: {
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
  activeBtn: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(214,26,78,0.12)',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  activeLabel: {
    color: Colors.primary,
  },
  // Gallery grid (3-column)
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2, paddingTop: 4 },
  cell: { width: '33.333%', aspectRatio: 1, padding: 2 },
  cellImg: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#1a1a1a' },
  videoCell: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#1a1a1a', overflow: 'hidden' },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  videoIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  videoCornerTag: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
});

function InfoTab({ user }: { user: any }) {
  return (
    <View style={s.tabContent}>
      <GlassCard style={s.infoCard}>
        <View style={s.infoCardInner}>
          <Text style={s.infoTitle}>About Me</Text>
          <Text style={s.infoBody}>{user.bio || 'No bio yet. Tap Edit Profile to add one.'}</Text>
        </View>
      </GlassCard>
      <GlassCard style={s.infoCard}>
        <View style={s.infoCardInner}>
          <Text style={s.infoTitle}>Details</Text>
          <InfoRow icon="location-outline" label="Location" value={user.location || '—'} />
          <InfoRow icon="briefcase-outline" label="Occupation" value={user.occupation || '—'} />
          <InfoRow icon="gift-outline" label="Age" value={`${user.age} years old`} />
        </View>
      </GlassCard>
      {(user.interests || []).length > 0 && (
        <GlassCard style={s.infoCard}>
          <View style={s.infoCardInner}>
            <Text style={s.infoTitle}>Interests</Text>
            <View style={s.chips}>
              {user.interests.map((i: string) => (
                <View key={i} style={s.chip}><Text style={s.chipText}>{i}</Text></View>
              ))}
            </View>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon as any} size={16} color={Colors.primary} style={{ width: 22 }} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function WalletTab({ onBuyCoins }: { onBuyCoins: () => void }) {
  const { coins, addCoins, transactions } = useWalletStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const showSheet = useSheet();

  const handlePurchase = (pkg: typeof COIN_PACKAGES[number]) => {
    showSheet({
      title: 'Confirm Purchase',
      message: `Buy ${pkg.coins.toLocaleString()}${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''} coins for ${pkg.price}?`,
      options: [
        {
          label: 'Buy Now',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setPurchasing(pkg.id);
            await new Promise(r => setTimeout(r, 1200));
            addCoins(pkg.coins + pkg.bonus);
            setPurchasing(null);
            showSheet({
              title: 'Purchase Successful',
              message: `${(pkg.coins + pkg.bonus).toLocaleString()} coins have been added to your wallet.`,
              options: [{ label: 'OK' }],
            });
          },
        },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={s.tabContent}>

      {/* Balance card */}
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.balanceGrad}>
          <Ionicons name="diamond" size={32} color="rgba(255,255,255,0.3)" style={{ marginBottom: 4 }} />
          <Text style={s.balanceLabel}>Your Balance</Text>
          <Text style={s.balanceAmount}>{coins.toLocaleString()}</Text>
          <View style={s.balancePill}>
            <Ionicons name="diamond" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={s.balancePillText}>coins</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Transaction history toggle */}
      <TouchableOpacity style={s.historyToggle} onPress={() => setShowHistory(v => !v)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
          <Text style={s.historyToggleText}>Transaction History</Text>
        </View>
        <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {showHistory && (
        <GlassCard style={s.infoCard}>
          <View style={s.infoCardInner}>
            {transactions.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 6 }}>
                <Ionicons name="receipt-outline" size={28} color={Colors.textMuted} />
                <Text style={s.emptySubtitle}>No transactions yet.</Text>
              </View>
            ) : transactions.slice(0, 10).map(tx => (
              <View key={tx.id} style={s.txRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Ionicons
                    name={tx.amount > 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                    size={18}
                    color={tx.amount > 0 ? Colors.success : Colors.error}
                  />
                  <Text style={s.txDesc}>{tx.description}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="diamond" size={11} color={tx.amount > 0 ? Colors.success : Colors.error} />
                  <Text style={[s.txAmount, { color: tx.amount > 0 ? Colors.success : Colors.error }]}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Buy coins */}
      <View style={s.sectionRow2}>
        <Ionicons name="diamond" size={16} color={Colors.primary} />
        <Text style={s.sectionHeader}>Buy Coins</Text>
      </View>

      {COIN_PACKAGES.map(pkg => (
        <TouchableOpacity
          key={pkg.id}
          style={[s.packageItem, pkg.popular && s.popularItem]}
          onPress={() => handlePurchase(pkg)}
          activeOpacity={0.85}
        >
          {pkg.popular && (
            <View style={s.popularBadge}>
              <Ionicons name="star" size={9} color="#fff" />
              <Text style={s.popularBadgeText}>BEST VALUE</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.pkgIconWrap}>
              <Ionicons name="diamond" size={18} color={pkg.popular ? Colors.primary : Colors.textSecondary} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[s.pkgCoins, pkg.popular && { color: Colors.textPrimary }]}>
                {pkg.coins.toLocaleString()}
              </Text>
              {pkg.bonus > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="gift-outline" size={11} color={Colors.success} />
                  <Text style={s.pkgBonus}>+{pkg.bonus} bonus free</Text>
                </View>
              )}
            </View>
          </View>
          <GradientButton
            title={purchasing === pkg.id ? '...' : pkg.price}
            onPress={() => handlePurchase(pkg)}
            loading={purchasing === pkg.id}
            size="sm"
            style={{ minWidth: 84 }}
          />
        </TouchableOpacity>
      ))}

      {/* Gifts preview */}
      <View style={s.sectionRow2}>
        <Ionicons name="gift-outline" size={16} color={Colors.primary} />
        <Text style={s.sectionHeader}>Send Gifts</Text>
      </View>

      <View style={s.giftsGrid}>
        {GIFTS.map(g => (
          <View key={g.id} style={s.giftItem}>
            <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
            <Text style={s.giftName}>{g.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="diamond" size={10} color={Colors.primaryLight} />
              <Text style={s.giftCoins}>{g.coins}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Edit field ────────────────────────────────────────────────────────────────
function EditField({ label, value, onChangeText, placeholder, keyboardType, multiline }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={em.fieldWrapper}>
      <Text style={em.fieldLabel}>{label}</Text>
      <View style={[em.fieldInput, focused && em.fieldFocused, multiline && { height: 90 }]}>
        <TextInput
          style={[em.fieldText, multiline && { textAlignVertical: 'top', paddingTop: 10 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function EditProfileModal({ visible, user, onClose }: { visible: boolean; user: any; onClose: () => void }) {
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const [form, setForm] = useState({ name: '', bio: '', location: '', occupation: '', age: '' });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const showSheet = useSheet();

  useEffect(() => {
    if (visible && user) {
      setForm({
        name: user.name || '',
        bio: user.bio || '',
        location: user.location || '',
        occupation: user.occupation || '',
        age: String(user.age || ''),
      });
      setSelectedInterests(user.interests || []);
      setAvatarUri(null);
      setCoverUri(null);
    }
  }, [visible, user]);

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSheet({ title: 'Permission needed', message: 'Please allow access to your photo library to change your avatar.', options: [{ label: 'OK' }] });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showSheet({ title: 'Permission needed', message: 'Please allow camera access to take a photo.', options: [{ label: 'OK' }] });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleChangePhoto = () => {
    showSheet({
      title: 'Change Photo',
      message: 'Choose a source',
      options: [
        { label: 'Camera', onPress: takePhoto },
        { label: 'Photo Library', onPress: pickAvatar },
        { label: 'Cancel' },
      ],
    });
  };

  const toggleInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleSave = () => {
    if (!form.name.trim()) { showSheet({ title: 'Name required', message: 'Please enter your name.', options: [{ label: 'OK' }] }); return; }
    const age = parseInt(form.age);
    if (!age || age < 18) { showSheet({ title: 'Invalid age', message: 'Age must be 18 or older.', options: [{ label: 'OK' }] }); return; }

    updateProfile(
      {
        name: form.name.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        occupation: form.occupation.trim(),
        age,
        interests: selectedInterests,
        ...(avatarUri ? { avatar_url: avatarUri } : {}),
        ...(coverUri ? { cover_url: coverUri } : {}),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowSavedToast(true);
          setTimeout(() => { setShowSavedToast(false); onClose(); }, 1400);
        },
        onError: (e: any) => showSheet({
          title: 'Could not save',
          message: e.message,
          options: [{ label: 'OK' }],
        }),
      }
    );
  };

  const currentAvatar = avatarUri || user?.avatar;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={em.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={em.header}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={em.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={em.title}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSave} disabled={isPending} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                {isPending
                  ? <ActivityIndicator color={Colors.primaryLight} size="small" />
                  : <Text style={em.save}>Save</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Cover photo picker */}
            <TouchableOpacity onPress={pickCover} activeOpacity={0.85} style={em.coverSection}>
              {(coverUri || user?.cover) ? (
                <Image source={{ uri: coverUri || user.cover }} style={em.coverImage} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#5A1530', '#2A0A14']} style={em.coverImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              )}
              <View style={em.coverOverlay} />
              <View style={em.coverEditBadge}>
                <Ionicons name="camera-outline" size={14} color="#fff" />
                <Text style={em.coverEditText}>{coverUri || user?.cover ? 'Change cover' : 'Add cover photo'}</Text>
              </View>
              {coverUri && (
                <View style={em.coverNewBadge}>
                  <Text style={em.avatarNewBadgeText}>NEW</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Avatar picker */}
            <View style={em.avatarSection}>
              <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.85}>
                <View style={em.avatarWrapper}>
                  <Image
                    source={{ uri: currentAvatar }}
                    style={em.avatarImage}
                    contentFit="cover"
                  />
                  <View style={em.avatarOverlay}>
                    <Text style={em.cameraIcon}>📷</Text>
                  </View>
                  {avatarUri && (
                    <View style={em.avatarNewBadge}>
                      <Text style={em.avatarNewBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={em.changePhoto} onPress={handleChangePhoto}>
                <Text style={em.changePhotoText}>📷 Change Photo</Text>
              </TouchableOpacity>
              <Text style={em.changePhotoHint}>Tap avatar or button to choose from gallery or camera</Text>
            </View>

            <View style={em.section}>
              <Text style={em.sectionTitle}>BASIC INFO</Text>
              <EditField label="Full Name" value={form.name} onChangeText={(v: string) => setForm(f => ({ ...f, name: v }))} placeholder="Your name" />
              <EditField label="Age" value={form.age} onChangeText={(v: string) => setForm(f => ({ ...f, age: v }))} placeholder="25" keyboardType="number-pad" />
              <EditField label="Location" value={form.location} onChangeText={(v: string) => setForm(f => ({ ...f, location: v }))} placeholder="Manila, Philippines" />
              <EditField label="Occupation" value={form.occupation} onChangeText={(v: string) => setForm(f => ({ ...f, occupation: v }))} placeholder="e.g. Nurse, Teacher..." />
            </View>

            <View style={em.section}>
              <Text style={em.sectionTitle}>ABOUT ME</Text>
              <View style={em.bioWrapper}>
                <TextInput
                  style={em.bioInput}
                  value={form.bio}
                  onChangeText={v => setForm(f => ({ ...f, bio: v }))}
                  placeholder="Write something about yourself..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={300}
                />
                <Text style={em.bioCount}>{form.bio.length}/300</Text>
              </View>
            </View>

            <View style={em.section}>
              <Text style={em.sectionTitle}>INTERESTS ({selectedInterests.length} selected)</Text>
              <View style={em.interestGrid}>
                {INTERESTS_OPTIONS.map(interest => {
                  const selected = selectedInterests.includes(interest);
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[em.interestChip, selected && em.interestChipActive]}
                      onPress={() => toggleInterest(interest)}
                    >
                      <Text style={[em.interestText, selected && em.interestTextActive]}>{interest}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <GradientButton title={isPending ? 'Saving...' : 'Save Changes'} onPress={handleSave} loading={isPending} size="lg" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Saved toast — modern slide-in notification */}
        {showSavedToast && (
          <View style={em.toastWrap} pointerEvents="none">
            <View style={em.toast}>
              <View style={em.toastIconWrap}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={em.toastTitle}>Profile Saved</Text>
                <Text style={em.toastMessage}>Your changes are now live.</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user } = useAuthStore();
  const logout = useLogout();
  const { coins } = useWalletStore();
  const [activeTab, setActiveTab] = useState('posts');
  const [editVisible, setEditVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef as any);
  const showSheet = useSheet();

  // Live counts — updated whenever follows or posts change
  const { data: livePosts } = useUserPosts(user?.id || '');
  const postsCount = livePosts?.length ?? 0;

  const { data: liveProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => profileService.getProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  if (!user) return null;

  const handleLogout = () => {
    showSheet({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      options: [
        { label: 'Sign Out', destructive: true, onPress: logout },
        { label: 'Cancel' },
      ],
    });
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showSheet({
      title: 'Share Profile',
      options: [
        { label: 'Copy Profile Link', onPress: () => showSheet({ title: 'Copied!', message: `dateafilipina.app/u/${user.name.toLowerCase().replace(/\s+/g, '')}`, options: [{ label: 'OK' }] }) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleSettings = () => {
    showSheet({
      title: 'Settings',
      options: [
        { label: 'Privacy Settings', onPress: () => showSheet({ title: 'Privacy', message: 'Control who can see your profile and contact you.', options: [{ label: 'OK' }] }) },
        { label: 'Notification Settings', onPress: () => showSheet({ title: 'Notifications', message: 'Manage your push notification preferences.', options: [{ label: 'OK' }] }) },
        { label: 'Help & Support', onPress: () => showSheet({ title: 'Support', message: 'Email: support@dateafilipina.app', options: [{ label: 'OK' }] }) },
        { label: 'Delete Account', destructive: true, onPress: () => showSheet({ title: 'Delete Account', message: 'This action cannot be undone. Contact support to proceed.', options: [{ label: 'OK' }] }) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={s.cover}>
          {/* Banner — uses cover_url from profile, falls back to gradient */}
          {(liveProfile?.cover || user.cover) ? (
            <Image source={{ uri: liveProfile?.cover || user.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#5A1530', '#2A0A14', Colors.background]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          {/* Subtle dark overlay only at the top for header readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent']}
            style={s.coverTopFade}
          />
          <SafeAreaView edges={['top']}>
            <View style={s.topBar}>
              <Text style={s.topTitle}>My Profile</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.topBtn} onPress={handleSettings}>
                  <Ionicons name="settings-outline" size={19} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.topBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={19} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={s.profileSection}>
          {/* Avatar overlaps cover — sits half on the banner, half on the page below */}
          <View style={s.avatarRow}>
            <TouchableOpacity onPress={() => setEditVisible(true)} activeOpacity={0.85} style={s.avatarOverlap}>
              <AvatarWithRing uri={user.avatar} size={94} isOnline={user.isOnline} />
              <View style={s.editBadge}>
                <Ionicons name="camera" size={11} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={s.statsRow}>
              <StatBox value={postsCount} label="Posts" />
              <StatBox value={liveProfile?.followers ?? user.followers} label="Followers" />
              <StatBox value={liveProfile?.following ?? user.following} label="Following" />
            </View>
          </View>

          <View style={s.nameSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.userName}>{user.name}</Text>
              {user.isVerified && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
            </View>
            {!!user.location && (
              <View style={s.infoLine}>
                <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                <Text style={s.userSub}>{user.location}</Text>
              </View>
            )}
            {!!user.occupation && (
              <View style={s.infoLine}>
                <Ionicons name="briefcase-outline" size={13} color={Colors.textMuted} />
                <Text style={s.userSub}>{user.occupation}</Text>
              </View>
            )}
            {user.bio
              ? <Text style={s.userBio}>{user.bio}</Text>
              : <TouchableOpacity onPress={() => setEditVisible(true)}><Text style={s.addBio}>+ Add a bio</Text></TouchableOpacity>
            }
          </View>

          <TouchableOpacity style={s.coinPill} onPress={() => setActiveTab('wallet')}>
            <LinearGradient colors={['rgba(214,26,78,0.25)', 'rgba(214,26,78,0.08)']} style={s.coinPillInner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="diamond" size={14} color="#FFD700" />
                <Text style={s.coinPillText}>{coins.toLocaleString()} coins</Text>
              </View>
              <Text style={s.coinPillAdd}>Tap to buy +</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <GradientButton title="Edit Profile" onPress={() => setEditVisible(true)} style={{ flex: 1 }} size="sm" />
            <TouchableOpacity style={s.iconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={19} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TabBar active={activeTab} onChange={setActiveTab} />
        </View>

        {activeTab === 'posts' && <PostsGrid userId={user.id} user={user} />}
        {activeTab === 'info' && <InfoTab user={user} />}
        {activeTab === 'wallet' && <WalletTab onBuyCoins={() => {}} />}
      </ScrollView>

      <EditProfileModal visible={editVisible} user={user} onClose={() => setEditVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  cover: { height: 200, position: 'relative' },
  coverTopFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  topTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  topBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  profileSection: { gap: 14, paddingTop: 4, marginTop: -52 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, gap: 20 },
  avatarOverlap: { borderWidth: 4, borderColor: Colors.background, borderRadius: 60, padding: 0, marginBottom: 0 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textMuted },
  nameSection: { paddingHorizontal: 16, gap: 3 },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  userSub: { fontSize: 13, color: Colors.textSecondary },
  userBio: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  addBio: { fontSize: 14, color: Colors.primaryLight, fontWeight: '600', marginTop: 4 },
  coinPill: { marginHorizontal: 16 },
  coinPillInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(214,26,78,0.25)' },
  coinPillText: { color: Colors.primaryLight, fontWeight: '700', fontSize: 15 },
  coinPillAdd: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600', opacity: 0.7 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 },
  textPost: { backgroundColor: Colors.card, padding: 8, justifyContent: 'center' },
  textPostContent: { fontSize: 12, color: Colors.textSecondary },
  emptyPosts: { padding: 60, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  tabContent: { padding: 16, gap: 12 },
  infoCard: { borderRadius: 16 },
  infoCardInner: { padding: 16, gap: 12 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  infoBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: { fontSize: 18, width: 28 },
  infoLabel: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(214,26,78,0.15)', borderWidth: 1, borderColor: 'rgba(214,26,78,0.3)' },
  chipText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
  balanceGrad: { padding: 28, alignItems: 'center', gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, letterSpacing: 0.5, fontWeight: '500' },
  balanceAmount: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  balancePillText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  historyToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  historyToggleText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  txDesc: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  txAmount: { fontSize: 13, fontWeight: '700' },
  sectionRow2: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, marginBottom: -4 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  packageItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.glassBorder, position: 'relative' },
  popularItem: { borderColor: Colors.primary, backgroundColor: 'rgba(214,26,78,0.06)' },
  popularBadge: { position: 'absolute', top: -11, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pkgIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  pkgCoins: { fontSize: 17, fontWeight: '700', color: Colors.textSecondary },
  pkgBonus: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  giftsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  giftItem: { alignItems: 'center', gap: 4, width: (W - 72) / 4, backgroundColor: Colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: Colors.glassBorder },
  giftName: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  giftCoins: { fontSize: 10, color: Colors.primaryLight, fontWeight: '700' },
});

const em = StyleSheet.create({
  scroll: { paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  cancel: { fontSize: 16, color: Colors.textSecondary },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  save: { fontSize: 16, color: Colors.primaryLight, fontWeight: '700' },
  toastWrap: { position: 'absolute', top: 14, left: 14, right: 14, alignItems: 'center', zIndex: 999 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(28,28,34,0.98)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(52,199,89,0.35)', minWidth: '90%', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  toastIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center' },
  toastTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  toastMessage: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  coverSection: { height: 140, marginHorizontal: 12, marginTop: 12, borderRadius: 16, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.30)' },
  coverEditBadge: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  coverEditText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  coverNewBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  avatarSection: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  avatarWrapper: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', position: 'relative' },
  avatarImage: { width: 96, height: 96 },
  avatarOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { fontSize: 16 },
  avatarNewBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  avatarNewBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  changePhoto: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(214,26,78,0.15)', borderWidth: 1, borderColor: 'rgba(214,26,78,0.3)' },
  changePhotoText: { color: Colors.primaryLight, fontSize: 14, fontWeight: '600' },
  changePhotoHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  section: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  fieldWrapper: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  fieldInput: { borderRadius: 12, borderWidth: 1.5, borderColor: Colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14 },
  fieldFocused: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(200,30,80,0.06)' },
  fieldText: { height: 48, fontSize: 15, color: Colors.textPrimary },
  bioWrapper: { borderRadius: 12, borderWidth: 1.5, borderColor: Colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, gap: 8 },
  bioInput: { fontSize: 15, color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  bioCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: Colors.glassBorder },
  interestChipActive: { backgroundColor: 'rgba(214,26,78,0.2)', borderColor: Colors.primary },
  interestText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  interestTextActive: { color: Colors.primaryLight },
});
