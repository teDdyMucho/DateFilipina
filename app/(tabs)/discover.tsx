import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated,
  PanResponder, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useDiscoverProfiles, useSwipe, useMatches, useIncomingLikes } from '@/hooks/useDiscover';
import { useDiscoverStore } from '@/store/discoverStore';
import { MatchModal } from '@/components/MatchModal';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { Colors, Gradients } from '@/constants/colors';
import { User } from '@/constants/types';
import { useRouter } from 'expo-router';
import { useGetOrCreateConversation } from '@/hooks/useChat';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { messageService } from '@/services/messageService';
import { useSheet } from '@/components/GlobalActionSheet';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_WIDTH = SW - 32;
const CARD_HEIGHT = SH * 0.65;
const SWIPE_THRESHOLD = SW * 0.32;

// ─── Swipe Card ───────────────────────────────────────────────────────────────

function SwipeCard({ user, onSwipeLeft, onSwipeRight, onSuperLike, isTop }: {
  user: User; onSwipeLeft: () => void; onSwipeRight: () => void; onSuperLike: () => void; isTop: boolean;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const [photoIndex, setPhotoIndex] = useState(0);

  const rotate = position.x.interpolate({
    inputRange: [-SW / 2, 0, SW / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const superLikeOpacity = position.y.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => isTop,
    onMoveShouldSetPanResponder: () => isTop,
    onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy * 0.35 }),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
        const dir = g.dx > 0 ? 1 : -1;
        Animated.timing(position, {
          toValue: { x: dir * SW * 1.5, y: g.dy },
          duration: 280, useNativeDriver: true,
        }).start(() => { position.setValue({ x: 0, y: 0 }); dir > 0 ? onSwipeRight() : onSwipeLeft(); });
      } else if (g.dy < -SWIPE_THRESHOLD * 0.7) {
        // Swipe up = super like
        Animated.timing(position, {
          toValue: { x: 0, y: -SH },
          duration: 280, useNativeDriver: true,
        }).start(() => { position.setValue({ x: 0, y: 0 }); onSuperLike(); });
      } else {
        Animated.spring(position, { toValue: { x: 0, y: 0 }, damping: 14, stiffness: 180, useNativeDriver: true }).start();
      }
    },
  })).current;

  const photos = [user.avatar, ...(user.photos || [])].filter(Boolean);
  const currentPhoto = photos[photoIndex] || user.avatar;

  const nextPhoto = () => setPhotoIndex(i => Math.min(i + 1, photos.length - 1));
  const prevPhoto = () => setPhotoIndex(i => Math.max(i - 1, 0));

  return (
    <Animated.View
      style={[styles.card, { transform: [...position.getTranslateTransform(), { rotate }] }]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Image source={{ uri: currentPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />

      {/* Photo navigation tap zones */}
      <View style={styles.photoNavRow}>
        <TouchableOpacity style={{ flex: 1, height: '100%' }} onPress={prevPhoto} activeOpacity={1} />
        <TouchableOpacity style={{ flex: 1, height: '100%' }} onPress={nextPhoto} activeOpacity={1} />
      </View>

      {/* Photo tab indicators */}
      {photos.length > 1 && (
        <View style={styles.photoTabs}>
          {photos.slice(0, 6).map((_, i) => (
            <View key={i} style={[styles.photoTab, i === photoIndex && styles.photoTabActive]} />
          ))}
        </View>
      )}

      {/* Stamps */}
      <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={styles.stampText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={styles.stampText}>NOPE</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.superStamp, { opacity: superLikeOpacity }]}>
        <Text style={styles.stampText}>SUPER</Text>
      </Animated.View>

      {/* Info gradient */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={styles.cardGrad}>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName}>{user.name}, {user.age}</Text>
            {user.isVerified && <Ionicons name="checkmark-circle" size={17} color="#30D158" />}
            {user.isOnline && <View style={styles.onlineDot} />}
            {user.isLive && (
              <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>
            )}
          </View>
          {!!user.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.75)" style={{ marginRight: 4 }} />
              <Text style={styles.infoText}>{user.location}</Text>
              {!!user.occupation && <Text style={styles.infoTextMuted}> · {user.occupation}</Text>}
            </View>
          )}
          {!!user.bio && <Text style={styles.bioText} numberOfLines={2}>{user.bio}</Text>}
          {user.interests.length > 0 && (
            <View style={styles.interestRow}>
              {user.interests.slice(0, 4).map(tag => (
                <View key={tag} style={styles.interestTag}>
                  <Text style={styles.interestText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Matches Row ──────────────────────────────────────────────────────────────

function MatchesRow({ matches, onPress }: { matches: User[]; onPress: () => void }) {
  if (matches.length === 0) return null;
  return (
    <TouchableOpacity style={styles.matchesRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.matchAvatars}>
        {matches.slice(0, 4).map((m, i) => (
          <Image
            key={m.id}
            source={{ uri: fixAvatarUri(m.avatar, m.id) }}
            style={[styles.matchAvatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 4 - i }]}
            contentFit="cover"
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="heart" size={13} color={Colors.primaryLight} />
        <Text style={styles.matchText}>{matches.length} {matches.length === 1 ? 'Match' : 'Matches'} — tap to message</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Discover Screen ──────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { isLoading, refetch } = useDiscoverProfiles({});
  useMatches();
  useIncomingLikes();
  const { profiles, currentIndex, matches, passedProfiles, recyclePassedProfiles } = useDiscoverStore();
  const { likeMutation, superLikeMutation, passMutation } = useSwipe();
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [matchConvId, setMatchConvId] = useState<string | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [recycled, setRecycled] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuthStore();
  const { setConversations } = useChatStore();
  const getOrCreateConversation = useGetOrCreateConversation();
  const showSheet = useSheet();

  const currentUser = profiles[currentIndex];
  const hasCards = currentIndex < profiles.length;
  const visibleCards = profiles.slice(currentIndex, currentIndex + 3).reverse();
  const canRecycle = !hasCards && passedProfiles.length > 0;

  const handleSwipeRight = useCallback(async () => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const matched = await likeMutation.mutateAsync(currentUser.id);
      if (matched) {
        // Auto-create conversation so it appears in Messages tab immediately
        try {
          const convId = await getOrCreateConversation(matched.id);
          setMatchConvId(convId);
          // Refresh conversations list + store
          if (authUser?.id) {
            const convs = await messageService.getConversations(authUser.id);
            setConversations(convs);
            queryClient.setQueryData(['conversations', authUser.id], convs);
          }
        } catch {}
        setMatchedUser(matched);
        setShowMatch(true);
      }
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
    }
  }, [currentUser, authUser, getOrCreateConversation, queryClient, setConversations]);

  const handleSwipeLeft = useCallback(() => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    passMutation.mutate(currentUser.id);
  }, [currentUser]);

  const handleSuperLike = useCallback(async () => {
    if (!currentUser) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const matched = await superLikeMutation.mutateAsync(currentUser.id);
      if (matched) {
        try {
          const convId = await getOrCreateConversation(matched.id);
          setMatchConvId(convId);
          if (authUser?.id) {
            const convs = await messageService.getConversations(authUser.id);
            setConversations(convs);
            queryClient.setQueryData(['conversations', authUser.id], convs);
          }
        } catch {}
        setMatchedUser(matched);
        setShowMatch(true);
      }
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
    }
  }, [currentUser, authUser, getOrCreateConversation, queryClient, setConversations]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerSub}>Find your match</Text>
          </View>
        </View>

        {/* Matches row */}
        <MatchesRow matches={matches} onPress={() => router.push('/(tabs)/messages')} />

        {/* Card stack */}
        <View style={styles.cardStack}>
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>Finding profiles...</Text>
            </View>
          ) : hasCards ? (
            visibleCards.map((user, i) => {
              const isTop = i === visibleCards.length - 1;
              const offset = visibleCards.length - 1 - i;
              return (
                <View
                  key={user.id}
                  style={[styles.cardWrapper, {
                    transform: [{ scale: 1 - offset * 0.038 }, { translateY: offset * 12 }],
                    zIndex: i,
                  }]}
                >
                  <SwipeCard
                    user={user}
                    isTop={isTop}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    onSuperLike={handleSuperLike}
                  />
                </View>
              );
            })
          ) : (
            <View style={styles.centerBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={52} color={Colors.primary} style={{ opacity: 0.8 }} />
              </View>
              <Text style={styles.emptyTitle}>You've seen everyone!</Text>
              {canRecycle ? (
                <>
                  <Text style={styles.emptySub}>Show people you passed again — maybe it's a match this time</Text>
                  <TouchableOpacity style={styles.refreshBtn} onPress={() => { recyclePassedProfiles(); setRecycled(true); }}>
                    <LinearGradient colors={Gradients.primary} style={styles.refreshBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="repeat-outline" size={16} color="#fff" />
                      <Text style={styles.refreshBtnText}>Show Again ({passedProfiles.length})</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 8 }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>or load new profiles</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.emptySub}>Check back soon for new profiles</Text>
                  <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRecycled(false); refetch(); }}>
                    <LinearGradient colors={Gradients.primary} style={styles.refreshBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="refresh-outline" size={16} color="#fff" />
                      <Text style={styles.refreshBtnText}>Refresh</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Swipe hint */}
        {hasCards && !isLoading && (
          <View style={styles.hintRow}>
            <Ionicons name="arrow-back" size={13} color={Colors.textMuted} />
            <Text style={styles.hint}>pass</Text>
            <Ionicons name="arrow-up" size={13} color="#FFD700" />
            <Text style={styles.hint}>super</Text>
            <Text style={styles.hint}>like</Text>
            <Ionicons name="arrow-forward" size={13} color={Colors.textMuted} />
          </View>
        )}

        {/* Action buttons */}
        {hasCards && !isLoading && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={handleSwipeLeft}>
              <Ionicons name="close" size={30} color="#FF453A" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.superBtn]} onPress={handleSuperLike}>
              <Ionicons name="star" size={22} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleSwipeRight}>
              <Ionicons name="heart" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <MatchModal
        visible={showMatch}
        matchedUser={matchedUser}
        onClose={() => { setShowMatch(false); setMatchConvId(null); }}
        onMessage={() => {
          setShowMatch(false);
          if (matchConvId) {
            router.push({ pathname: '/chat/[id]', params: { id: matchConvId } });
          } else if (matchedUser) {
            router.push('/(tabs)/messages');
          }
          setMatchConvId(null);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  matchesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 6 },
  matchAvatars: { flexDirection: 'row' },
  matchAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.background },
  matchText: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardWrapper: { position: 'absolute' },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  photoNavRow: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%', flexDirection: 'row', zIndex: 2 },
  photoTabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 12, zIndex: 3 },
  photoTab: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  photoTabActive: { backgroundColor: '#fff' },
  stamp: { position: 'absolute', top: 56, padding: 10, borderRadius: 10, borderWidth: 4, zIndex: 4 },
  likeStamp: { left: 20, borderColor: '#30D158', transform: [{ rotate: '-15deg' }] },
  nopeStamp: { right: 20, borderColor: '#FF453A', transform: [{ rotate: '15deg' }] },
  superStamp: { alignSelf: 'center', left: CARD_WIDTH / 2 - 60, borderColor: '#FFD700', transform: [{ rotate: '-5deg' }] },
  stampText: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  cardGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 100, paddingHorizontal: 18, paddingBottom: 18 },
  cardInfo: { gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 26, fontWeight: '800', color: '#fff' },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  liveBadge: { backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  infoTextMuted: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  bioText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  interestTag: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  interestText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingBottom: 24, paddingTop: 8 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 4 },
  hint: { color: Colors.textMuted, fontSize: 12 },
  actionBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  passBtn: { backgroundColor: Colors.card, borderWidth: 2, borderColor: '#FF453A', shadowColor: '#FF453A' },
  superBtn: { backgroundColor: Colors.card, borderWidth: 2, borderColor: '#FFD700', shadowColor: '#FFD700', width: 52, height: 52, borderRadius: 26 },
  likeBtn: { backgroundColor: Colors.primary, shadowColor: Colors.primary },
  centerBox: { alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(214,26,78,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loadingText: { color: Colors.textMuted, fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  refreshBtn: { marginTop: 12, borderRadius: 24, overflow: 'hidden' },
  refreshBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
  refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

