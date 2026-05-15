import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, RefreshControl, Animated, StatusBar,
  PermissionsAndroid,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
  VideoSourceType,
} from 'react-native-agora';
import { LiveBadge } from '@/components/LiveBadge';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { GiftAnimation, CenterGiftAnimation, FloatingHeart, AnimatedComment, ViewerBadge } from '@/components/GiftAnimation';
import { Colors, Gradients } from '@/constants/colors';
import { liveService, LiveStream, LiveComment } from '@/services/liveService';
import { GIFTS } from '@/constants';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { AGORA_APP_ID, AGORA_TEST_CHANNEL, getAgoraToken } from '@/services/agoraService';
import { useSheet } from '@/components/GlobalActionSheet';
import { ReportSheet } from '@/components/ReportSheet';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 44) / 2;
const CATEGORIES = ['All', 'Dancing', 'Cooking', 'Chat', 'Music', 'Gaming'] as const;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const CATEGORY_ICONS: Record<string, IoniconName> = {
  All:     'flame-outline',
  Dancing: 'body-outline',
  Cooking: 'restaurant-outline',
  Chat:    'chatbubble-outline',
  Music:   'headset-outline',
  Gaming:  'game-controller-outline',
};

// ── Live Card ─────────────────────────────────────────────────────────────────

function LiveCard({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity style={styles.card} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.9}>
      <Image source={{ uri: stream.hostAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* Top gradient for badge readability */}
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={styles.cardTopGrad} pointerEvents="none" />

      {/* Top row: LIVE badge + viewer count */}
      <View style={styles.cardTopRow}>
        <View style={styles.liveBadgeNew}>
          <Animated.View style={[styles.liveDotNew, { transform: [{ scale: pulse }] }]} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <View style={styles.viewerPill}>
          <Ionicons name="eye" size={11} color="#fff" />
          <Text style={styles.viewerPillText}>
            {stream.viewerCount >= 1000 ? `${(stream.viewerCount / 1000).toFixed(1)}k` : stream.viewerCount}
          </Text>
        </View>
      </View>

      {/* Bottom info with stronger gradient */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.96)']} style={styles.cardGrad}>
        {stream.category && (
          <View style={styles.cardCategoryChip}>
            <Ionicons name={CATEGORY_ICONS[stream.category] ?? 'flame-outline'} size={10} color="#fff" />
            <Text style={styles.cardCategoryText}>{stream.category}</Text>
          </View>
        )}
        <Text style={styles.cardTitle} numberOfLines={2}>{stream.title}</Text>
        <View style={styles.cardBottom}>
          <AvatarWithRing uri={stream.hostAvatar} size={28} isLive />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardHost} numberOfLines={1}>{stream.hostName}</Text>
            {stream.giftTotal > 0 && (
              <Text style={styles.cardGifts}>💎 {stream.giftTotal >= 1000 ? `${(stream.giftTotal / 1000).toFixed(1)}k` : stream.giftTotal} earned</Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Fullscreen Live Viewer ────────────────────────────────────────────────────

const COMMENT_COLORS = ['#FF3D6E', '#30D158', '#FF9F0A', '#0A84FF', '#BF5AF2', '#FF6B35'];

function FullscreenLive({ stream, isHost, onClose }: { stream: LiveStream; isHost: boolean; onClose: () => void }) {
  const { user } = useAuthStore();
  const { coins, spendCoins } = useWalletStore();
  const showSheet = useSheet();
  const [comments, setComments] = useState<(LiveComment & { key: string })[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [hearts, setHearts] = useState<string[]>([]);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [chatText, setChatText] = useState('');
  const [viewerCount, setViewerCount] = useState(stream.viewerCount);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [engineReady, setEngineReady] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [forceEndReason, setForceEndReason] = useState<string | null>(null);
  const engineRef = useRef<IRtcEngine | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const viewerChannelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set<string>());

  const spawnHeart = () => {
    const id = `${Date.now()}-${Math.random()}`;
    setHearts(h => [...h, id]);
    setTimeout(() => setHearts(h => h.filter(x => x !== id)), 3000);
  };

  useEffect(() => {
    if (!user?.id) return;
    setupAgora();
    if (!isHost) liveService.joinStream(stream.id).catch(() => {});
    liveService.getViewerCount(stream.id).then(c => setViewerCount(c)).catch(() => {});

    roomChannelRef.current = liveService.createLiveRoom(
      stream.id,
      {
        onHeart: () => spawnHeart(),
        onComment: (comment) => {
          setComments(prev => [...prev.slice(-19), { ...comment, key: comment.id }]);
        },
        onGift: (gift) => {
          setGifts(g => [...g, gift]);
          setTimeout(() => setGifts(g => g.filter(x => x.key !== gift.key)), 4000);
        },
        onStreamEnded: () => {
          if (!isHost) {
            showSheet({
              title: 'Stream Ended',
              message: `${stream.hostName}'s live has ended.`,
              options: [{ label: 'OK', onPress: onClose }],
            });
          }
        },
        // Admin force-end — immediately close the stream on both host and viewers,
        // then show a modal with the admin's reason. The user dismisses the modal
        // to be sent back to the live tab listing.
        onAdminForceEnd: (reason) => {
          // Instantly tear down the Agora session so the host stops broadcasting
          // and viewers stop receiving frames.
          engineRef.current?.leaveChannel();
          engineRef.current?.release();
          engineRef.current = null;
          setForceEndReason(reason || 'Your stream was ended by an administrator.');
        },
        // Admin mute-audio — only the host actually mutes their mic
        onAdminMuteAudio: () => {
          if (isHost) {
            engineRef.current?.muteLocalAudioStream(true);
            setMuted(true);
            showSheet({ title: 'Audio Muted', message: 'An admin has muted your microphone.', options: [{ label: 'OK' }] });
          }
        },
        // Admin mute-video — only the host actually mutes their camera
        onAdminMuteVideo: () => {
          if (isHost) {
            engineRef.current?.muteLocalVideoStream(true);
            setCamOff(true);
            showSheet({ title: 'Video Muted', message: 'An admin has muted your camera.', options: [{ label: 'OK' }] });
          }
        },
      },
      user.id,
      seenIdsRef.current,
    );

    viewerChannelRef.current = liveService.subscribeToViewerCount(stream.id, setViewerCount);
    const pollInterval = setInterval(() => {
      liveService.getViewerCount(stream.id).then(c => setViewerCount(c)).catch(() => {});
    }, 5000);

    return () => {
      StatusBar.setHidden(false);
      clearInterval(pollInterval);
      roomChannelRef.current?.unsubscribe();
      viewerChannelRef.current?.unsubscribe();
      if (!isHost) liveService.leaveStream(stream.id).catch(() => {});
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
      engineRef.current = null;
    };
  }, []);

  const setupAgora = async () => {
    try {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      }
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      engine.registerEventHandler({
        onUserJoined: (_conn, uid) => { setRemoteUids(ids => [...ids, uid]); setRemoteVideoOff(false); },
        onUserOffline: (_conn, uid) => setRemoteUids(ids => ids.filter(i => i !== uid)),
        onJoinChannelSuccess: () => setLiveStatus('live'),
        // Most reliable: fires when remote user toggles their video
        onUserMuteVideo: (_conn, _uid, muted) => setRemoteVideoOff(!!muted),
        // Backup: state changes (0=Stopped, 1=Starting, 2=Decoding, 3=Frozen, 4=Failed)
        onRemoteVideoStateChanged: (_conn, _uid, state) => {
          if (state === 0) setRemoteVideoOff(true);
          if (state === 2) setRemoteVideoOff(false);
        },
        onError: (err) => { setLiveStatus('error'); console.log('[Agora live]', err); },
      });
      engine.setClientRole(isHost
        ? ClientRoleType.ClientRoleBroadcaster
        : ClientRoleType.ClientRoleAudience);
      engine.enableVideo();
      engine.enableAudio();
      setEngineReady(true);
      // Give RtcSurfaceView one render frame to mount before starting preview/publish
      setTimeout(async () => {
        if (isHost) engineRef.current?.startPreview();
        const token = await getAgoraToken(AGORA_TEST_CHANNEL, 0, isHost ? 'publisher' : 'subscriber');
        await engineRef.current?.joinChannel(token, AGORA_TEST_CHANNEL, 0, {
          clientRoleType: isHost ? ClientRoleType.ClientRoleBroadcaster : ClientRoleType.ClientRoleAudience,
          publishCameraTrack: isHost,
          publishMicrophoneTrack: isHost,
        });
      }, 100);
    } catch (e: any) {
      setLiveStatus('error');
      console.log('[Agora live] setup error', e.message);
    }
  };

  const toggleGiftPanel = (show: boolean) => {
    setShowGiftPanel(show);
  };

  const sendComment = () => {
    if (!chatText.trim() || !user) return;
    const text = chatText.trim();
    setChatText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = `${Date.now()}-${Math.random()}`;
    const createdAt = new Date().toISOString();
    seenIdsRef.current.add(id); // mark as seen so we don't echo our own
    const newComment = { id, key: id, userId: user.id, userName: user.name, userAvatar: user.avatar, text, createdAt: new Date(createdAt) };
    setComments(prev => [...prev.slice(-19), newComment]);
    liveService.roomSendComment(roomChannelRef.current, {
      id, userId: user.id, userName: user.name, userAvatar: user.avatar, text, createdAt,
    });
  };

  const sendGift = (gift: typeof GIFTS[number]) => {
    if (!user) return;
    const isOwnStream = user.id === stream.hostId;
    if (!isOwnStream && !spendCoins(gift.coins, `Gift: ${gift.name} to ${stream.hostName}`)) {
      showSheet({
        title: 'Not Enough Coins',
        message: 'Buy more coins in your profile wallet.',
        options: [{ label: 'OK' }],
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const broadcastKey = `${Date.now()}-${Math.random()}`;
    // Keep gift.id as the TYPE (e.g. "heart") for animation lookup,
    // but add `key` for unique tracking across host + viewers.
    const giftPayload = { ...gift, key: broadcastKey, senderName: user.name, userId: user.id };
    seenIdsRef.current.add(broadcastKey);
    setGifts(g => [...g, giftPayload]);
    toggleGiftPanel(false);
    setTimeout(() => setGifts(g => g.filter(x => x.key !== broadcastKey)), 4000);
    liveService.roomSendGift(roomChannelRef.current, giftPayload);
    if (!isOwnStream) {
      liveService.sendGift(stream.id, user.id, stream.hostId, gift.id, gift.name, gift.emoji, gift.coins).catch(() => {});
    }
  };

  const sendHeart = () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    spawnHeart(); // show locally immediately
    liveService.roomSendHeart(roomChannelRef.current, user.id);
  };

  const heartHoldRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHeartSpam = () => {
    sendHeart();
    heartHoldRef.current = setInterval(sendHeart, 150);
  };
  const stopHeartSpam = () => {
    if (heartHoldRef.current) { clearInterval(heartHoldRef.current); heartHoldRef.current = null; }
  };

  const toggleMute = () => {
    engineRef.current?.muteLocalAudioStream(!muted);
    setMuted(m => !m);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const toggleCam = () => {
    engineRef.current?.muteLocalVideoStream(!camOff);
    setCamOff(c => !c);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const switchCam = () => {
    engineRef.current?.switchCamera();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const visibleComments = comments.slice(-5);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Remote video (viewer sees host) — show avatar if remote stream is off */}
      {engineReady && remoteUids.length > 0 && !remoteVideoOff ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUids[0] }}
        />
      ) : engineReady && isHost && !camOff ? (
        /* Host sees their own camera */
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: 0 }}
        />
      ) : (
        /* Camera-off placeholder: host avatar centered on dark bg */
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }]}>
          <Image source={{ uri: stream.hostAvatar }} style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)' }} contentFit="cover" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 14, fontWeight: '600' }}>{stream.hostName}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.35)', marginTop: 4, fontSize: 12 }}>
            {!engineReady ? 'Connecting...' : isHost ? 'Camera off' : 'Host paused video'}
          </Text>
        </View>
      )}

      {/* Connecting overlay */}
      {liveStatus === 'connecting' && (
        <View style={s.connectingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
          <Text style={s.connectingText}>{isHost ? 'Starting stream...' : 'Connecting...'}</Text>
        </View>
      )}
      {liveStatus === 'error' && (
        <View style={s.errorOverlay} pointerEvents="none">
          <Ionicons name="warning" size={44} color="#FF3D6E" />
          <Text style={s.errorText}>Stream connection failed. Check your internet.</Text>
        </View>
      )}

      {/* Top gradient */}
      <LinearGradient colors={['rgba(0,0,0,0.75)', 'transparent']} style={s.topGrad} pointerEvents="none" />

      {/* Top bar */}
      <SafeAreaView style={s.topSafe} edges={['top']}>
        <View style={s.topBar}>
          {/* Host info */}
          <View style={s.hostRow}>
            <AvatarWithRing uri={stream.hostAvatar} size={38} isLive />
            <View style={{ gap: 2 }}>
              <Text style={s.hostName}>{stream.hostName}</Text>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            </View>
          </View>

          {/* Right side: viewer count + end/close button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ViewerBadge count={viewerCount} />
            {isHost ? (
              <TouchableOpacity
                style={s.endLiveBtn}
                onPress={() => {
                  showSheet({
                    title: 'End Live Stream?',
                    message: 'Are you sure you want to end your live?',
                    options: [
                      {
                        label: 'End Live',
                        destructive: true,
                        onPress: () => {
                          liveService.roomSendStreamEnded(roomChannelRef.current);
                          setTimeout(onClose, 300);
                        },
                      },
                      { label: 'Cancel' },
                    ],
                  });
                }}
              >
                <Ionicons name="power" size={14} color="#fff" />
                <Text style={s.endLiveText}>End Live</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={s.ctrl}
                  onPress={() => showSheet({
                    title: stream.hostName,
                    options: [
                      { label: 'Report Stream', destructive: true, onPress: () => setShowReport(true) },
                      { label: 'Cancel' },
                    ],
                  })}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Host controls — second row below header, only visible for host */}
        {isHost && (
          <View style={s.hostControlsRow}>
            <TouchableOpacity style={[s.hostCtrl, muted && s.hostCtrlActive]} onPress={toggleMute}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.hostCtrl, camOff && s.hostCtrlActive]} onPress={toggleCam}>
              <Ionicons name={camOff ? 'videocam-off' : 'videocam'} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.hostCtrl} onPress={switchCam}>
              <Ionicons name="camera-reverse" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Animated comments — bottom left stack (tap to reply) */}
      <View style={s.commentsArea} pointerEvents="box-none">
        {visibleComments.map((c, i) => (
          <TouchableOpacity
            key={c.key}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setChatText(prev => prev.startsWith(`@${c.userName} `) ? prev : `@${c.userName} `);
            }}
          >
            <AnimatedComment
              comment={c}
              color={COMMENT_COLORS[i % COMMENT_COLORS.length]}
              index={i}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom gradient */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={s.bottomGrad} pointerEvents="none" />

      {/* Bottom controls */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.bottomWrap}>
        <View style={s.inputRow}>
          <TouchableOpacity style={s.inputBox} activeOpacity={1}>
            <TextInput
              style={s.chatInput}
              value={chatText}
              onChangeText={setChatText}
              placeholder="Say something..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="send"
              onSubmitEditing={sendComment}
            />
          </TouchableOpacity>
          {!isHost && (
            <>
              <TouchableOpacity style={s.actionBtn} onPress={() => toggleGiftPanel(true)}>
                <Ionicons name="gift-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(255,59,48,0.85)' }]}
                onPress={sendHeart}
                onPressIn={startHeartSpam}
                onPressOut={stopHeartSpam}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={22} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>

      </KeyboardAvoidingView>

      {/* Gift sheet — only mounted when shown to avoid render overhead under live video */}
      {showGiftPanel && (
        <>
          <TouchableOpacity
            style={s.giftBackdrop}
            activeOpacity={1}
            onPress={() => toggleGiftPanel(false)}
          />
          <View style={s.giftSheet}>
            <View style={s.giftHandle} />
            <View style={s.giftSheetHeader}>
              <View>
                <Text style={s.giftSheetTitle}>Send a Gift</Text>
                <Text style={s.giftSheetSubtitle}>Show some love to {stream.hostName}</Text>
              </View>
              <View style={s.giftCoinsPill}>
                <Ionicons name="diamond" size={13} color="#FFD700" />
                <Text style={s.giftCoinsValue}>{coins.toLocaleString()}</Text>
              </View>
            </View>
            <View style={s.giftGrid}>
              {GIFTS.map((gift) => {
                const canAfford = coins >= gift.coins || user?.id === stream.hostId;
                return (
                  <TouchableOpacity
                    key={gift.id}
                    style={[s.giftCardFlat, !canAfford && s.giftCardDisabled]}
                    onPress={() => sendGift(gift)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.giftCardEmoji}>{gift.emoji}</Text>
                    <Text style={s.giftCardName}>{gift.name}</Text>
                    <View style={s.giftCardPriceRow}>
                      <Ionicons name="diamond" size={9} color="#FFD700" />
                      <Text style={s.giftCardPrice}>{gift.coins}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Floating hearts */}
      <View style={s.heartsLayer} pointerEvents="none">
        {hearts.map(id => (
          <FloatingHeart key={id} onComplete={() => setHearts(h => h.filter(x => x !== id))} />
        ))}
      </View>

      {/* Gift animations — LAST in tree = drawn on top of everything including gift sheet */}
      {gifts.map(g => (
        <CenterGiftAnimation key={g.key} gift={g} onComplete={() => setGifts(gs => gs.filter(x => x.key !== g.key))} />
      ))}

      {/* Force-end modal — shows admin's reason; stream is already torn down */}
      {forceEndReason && (
        <View style={fe.backdrop} pointerEvents="auto">
          <View style={fe.card}>
            <View style={fe.iconWrap}>
              <Ionicons name="warning" size={32} color="#FF453A" />
            </View>
            <Text style={fe.title}>{isHost ? 'Your Stream Was Ended' : 'Stream Ended by Admin'}</Text>
            <Text style={fe.label}>REASON FROM ADMIN</Text>
            <View style={fe.reasonBox}>
              <Text style={fe.reasonText}>{forceEndReason}</Text>
            </View>
            {isHost && (
              <Text style={fe.supportNote}>
                If you think this is a mistake, contact support@dateafilipina.app
              </Text>
            )}
            <TouchableOpacity
              style={fe.okBtn}
              onPress={() => { setForceEndReason(null); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={fe.okText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ReportSheet
        visible={showReport}
        targetType="stream"
        targetId={stream.id}
        targetLabel={`${stream.hostName}'s stream`}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}

// ── Go Live Modal ─────────────────────────────────────────────────────────────

function GoLiveModal({ onClose, onStart }: { onClose: () => void; onStart: (stream: LiveStream) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Chat');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const showSheet = useSheet();

  const handleGoLive = async () => {
    if (!title.trim()) {
      showSheet({ title: 'Add a Title', message: 'Please add a title for your stream.', options: [{ label: 'OK' }] });
      return;
    }
    if (!user) return;
    // Blocked from streaming by admin
    if (user.canStream === false) {
      showSheet({
        title: 'Streaming Disabled',
        message: 'Your streaming privileges have been revoked by an administrator. Contact support if you think this is a mistake.',
        options: [{ label: 'OK' }],
      });
      return;
    }
    setLoading(true);
    try {
      const stream = await liveService.startStream(user.id, title.trim(), category);
      onStart(stream);
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message || 'Could not start stream.', options: [{ label: 'OK' }] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.goLiveOverlay]}>
      <View style={styles.goLiveModal}>
        <View style={styles.goLiveHandle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="videocam" size={22} color={Colors.primary} />
          <Text style={styles.goLiveTitle}>Go Live</Text>
        </View>
        <Text style={styles.goLiveSubtitle}>Start streaming to your followers</Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Stream title..."
            placeholderTextColor={Colors.textMuted}
            maxLength={50}
          />
        </View>

        <Text style={styles.goLiveLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {CATEGORIES.filter(c => c !== 'All').map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catChipText, category === cat && { color: '#fff' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.goLiveBtn} onPress={handleGoLive} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={Gradients.primary} style={styles.goLiveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.goLiveBtnText}>Start Streaming</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: Colors.textMuted, fontSize: 15 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Live Screen ──────────────────────────────────────────────────────────

export default function LiveScreen() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: streams = [], isLoading, refetch } = useQuery({
    queryKey: ['live_streams'],
    queryFn: liveService.getStreams,
    refetchInterval: 15000,
  });

  // Subscribe to real-time stream list changes
  useEffect(() => {
    const channel = liveService.subscribeToStreams(() => {
      queryClient.invalidateQueries({ queryKey: ['live_streams'] });
    });
    return () => { channel.unsubscribe(); };
  }, []);

  const filtered = activeCategory === 'All'
    ? streams
    : streams.filter(s => s.category === activeCategory);

  const handleStreamStart = (stream: LiveStream) => {
    setShowGoLive(false);
    setIsHosting(true);
    setSelectedStream(stream);
  };

  const handleClose = async () => {
    if (isHosting && selectedStream && user) {
      await liveService.endStream(selectedStream.id, user.id).catch(() => {});
    }
    setSelectedStream(null);
    setIsHosting(false);
    queryClient.invalidateQueries({ queryKey: ['live_streams'] });
  };

  if (selectedStream) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FullscreenLive
          stream={selectedStream}
          isHost={isHosting}
          onClose={handleClose}
        />
      </View>
    );
  }

  const totalViewers = streams.reduce((sum, s) => sum + (s.viewerCount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Subtle background gradient */}
      <LinearGradient
        colors={['rgba(255,61,110,0.08)', 'transparent']}
        style={styles.bgGradient}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Live</Text>
            {streams.length > 0 ? (
              <View style={styles.headerSub}>
                <View style={styles.headerDot} />
                <Text style={styles.headerSubText}>{streams.length} live · {totalViewers} watching</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity style={styles.goLiveHeaderBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowGoLive(true); }} activeOpacity={0.85}>
            <LinearGradient colors={Gradients.primary} style={styles.goLiveHeaderGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="videocam" size={15} color="#fff" />
              <Text style={styles.goLiveHeaderText}>Go Live</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll} contentContainerStyle={styles.cats}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catPill, active && styles.catPillActive]}
                onPress={() => { setActiveCategory(cat); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.8}
              >
                {active && (
                  <LinearGradient
                    colors={['rgba(255,61,110,0.95)', 'rgba(180,20,80,0.95)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  />
                )}
                <Ionicons
                  name={CATEGORY_ICONS[cat] ?? 'flame-outline'}
                  size={14}
                  color={active ? '#fff' : Colors.textMuted}
                />
                <Text style={[styles.catPillText, active && styles.catPillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stream grid */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 110, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <LiveCard stream={item} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsHosting(false); setSelectedStream(item); }} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              {isLoading ? (
                <ActivityIndicator color={Colors.primary} size="large" />
              ) : (
                <>
                  <View style={styles.emptyIconWrap}>
                    <LinearGradient colors={['rgba(255,61,110,0.15)', 'rgba(255,61,110,0.03)']} style={styles.emptyIconBg} />
                    <Ionicons name="videocam-outline" size={52} color={Colors.primary} style={{ opacity: 0.8 }} />
                  </View>
                  <Text style={styles.emptyText}>No one is live right now</Text>
                  <Text style={styles.emptySub}>Be the first to broadcast and connect with others</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowGoLive(true)} activeOpacity={0.85}>
                    <LinearGradient colors={Gradients.primary} style={styles.emptyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="videocam" size={16} color="#fff" />
                      <Text style={styles.emptyBtnText}>Start Broadcasting</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      </SafeAreaView>

      {showGoLive && <GoLiveModal onClose={() => setShowGoLive(false)} onStart={handleStreamStart} />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 0, paddingBottom: 4 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.8 },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  headerSubText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  goLiveHeaderBtn: { borderRadius: 22, overflow: 'hidden', shadowColor: '#FF3D6E', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  goLiveHeaderGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  goLiveHeaderText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  catsScroll: { marginTop: 12, flexGrow: 0 },
  cats: { paddingHorizontal: 16, gap: 8, paddingTop: 0, paddingBottom: 6, alignItems: 'center' },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillActive: {
    borderColor: 'rgba(255,61,110,0.5)',
    shadowColor: '#FF3D6E', shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  catPillText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  catPillTextActive: { color: '#fff', fontWeight: '700' },

  card: { width: CARD_W, height: CARD_W * 1.55, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.card, shadowColor: '#FF3D6E', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  cardTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 1 },
  cardTopRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  liveBadgeNew: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, shadowColor: '#FF3B30', shadowOpacity: 0.6, shadowRadius: 6, elevation: 4 },
  liveDotNew: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  viewerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  viewerPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  cardCategoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cardCategoryText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18, letterSpacing: -0.2 },
  cardHost: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardGifts: { color: '#FFD700', fontSize: 10, fontWeight: '700', marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 14, paddingHorizontal: 32 },
  emptyIconWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyIconBg: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  emptyEmoji: { fontSize: 58 },
  emptyText: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: 26, overflow: 'hidden', marginTop: 8, shadowColor: '#FF3D6E', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 30, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Go Live Modal
  goLiveOverlay: { backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'flex-end' },
  goLiveModal: { backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, width: '100%', gap: 16, paddingBottom: 40 },
  goLiveHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.glassBorder, alignSelf: 'center', marginBottom: 8 },
  goLiveTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  goLiveSubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: -8 },
  goLiveLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  inputWrap: { borderRadius: 14, borderWidth: 1.5, borderColor: Colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14 },
  input: { height: 48, fontSize: 15, color: Colors.textPrimary },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.glassBorder },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  goLiveBtn: { borderRadius: 14, overflow: 'hidden' },
  goLiveBtnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  goLiveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// Fullscreen live styles (separate to keep clean)
const s = StyleSheet.create({
  connectingOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 8 },
  connectingText: { color: '#fff', marginTop: 14, fontSize: 15, fontWeight: '600' },
  connectingStep: { color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 11, fontWeight: '500', textAlign: 'center', paddingHorizontal: 24 },
  errorOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 8, paddingHorizontal: 32 },
  errorText: { color: '#fff', marginTop: 14, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 5 },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },

  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,59,48,0.75)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  ctrl: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  ctrlActive: { backgroundColor: 'rgba(255,59,48,0.75)' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,59,48,0.75)', alignItems: 'center', justifyContent: 'center' },
  endLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#FF3B30' },
  endLiveText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  heartsLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999 },

  hostControlsRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, gap: 10 },
  hostCtrl: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  hostCtrlActive: { backgroundColor: 'rgba(255,59,48,0.7)', borderColor: 'rgba(255,59,48,0.9)' },

  commentsArea: { position: 'absolute', bottom: 110, left: 14, right: 72, zIndex: 5 },

  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, zIndex: 4 },
  bottomWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 7 },

  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 28, paddingTop: 10, gap: 10 },
  inputBox: { flex: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 22, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chatInput: { color: '#fff', fontSize: 14 },
  actionBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

  // Modern gift bottom sheet
  giftBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 50, elevation: 50 },
  giftSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#15151c', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 28, paddingHorizontal: 18, zIndex: 51, elevation: 51, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  giftHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 18 },
  giftSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  giftSheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  giftSheetSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  giftCoinsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  giftCoinsEmoji: { fontSize: 14 },
  giftCoinsValue: { color: '#FFD700', fontSize: 13, fontWeight: '800' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  giftCard: { width: '23%', aspectRatio: 0.85, borderRadius: 16, overflow: 'hidden' },
  giftCardFlat: { width: '23%', aspectRatio: 0.85, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4, borderWidth: 1, borderColor: 'rgba(255,61,110,0.2)', backgroundColor: 'rgba(255,61,110,0.12)' },
  giftCardDisabled: { opacity: 0.4 },
  giftCardGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4, borderWidth: 1, borderColor: 'rgba(255,61,110,0.2)', borderRadius: 16 },
  giftCardEmoji: { fontSize: 32 },
  giftCardName: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  giftCardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
  giftCardCoinEmoji: { fontSize: 9 },
  giftCardPrice: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
});

// Force-end modal (shown on host + viewer when admin force-ends)
const fe = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 9999, elevation: 9999 },
  card: { width: '100%', backgroundColor: '#1a1a22', borderRadius: 22, padding: 22, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)' },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,69,58,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { color: '#fff', fontSize: 19, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  label: { color: '#FF453A', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  reasonBox: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,69,58,0.08)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)' },
  reasonText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  supportNote: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 4 },
  okBtn: { width: '100%', height: 48, borderRadius: 14, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  okText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
