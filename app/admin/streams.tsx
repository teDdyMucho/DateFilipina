import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, KeyboardAvoidingView, Platform, TextInput, Dimensions,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
// 2-column grid: 12px outer padding + 10px middle gap → each card = (W - 12*2 - 10) / 2
const CARD_W = Math.floor((SCREEN_W - 12 * 2 - 10) / 2);
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import {
  useAdminStreams, useEndStreamAsAdmin,
  useMuteStreamAudio, useMuteStreamVideo,
  useSetCanStream,
} from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { fixAvatarUri } from '@/constants/avatarUtils';

export default function AdminStreamsScreen() {
  const router = useRouter();
  const showSheet = useSheet();
  const { data: streams = [], isLoading, refetch, isRefetching } = useAdminStreams();

  const endStream = useEndStreamAsAdmin();
  const muteAudio = useMuteStreamAudio();
  const muteVideo = useMuteStreamVideo();
  const setCanStream = useSetCanStream();

  const [endTarget, setEndTarget] = useState<{ streamId: string; hostId: string; hostName: string } | null>(null);
  const [endReason, setEndReason] = useState('');

  const toast = (title: string, message?: string) =>
    showSheet({ title, message, options: [{ label: 'OK' }] });

  const handleConfirmEnd = () => {
    if (!endTarget) return;
    if (!endReason.trim()) {
      toast('Reason required', 'Please provide a reason. The host will see this.');
      return;
    }
    endStream.mutate({ streamId: endTarget.streamId, hostId: endTarget.hostId, reason: endReason.trim() }, {
      onSuccess: () => {
        setEndTarget(null);
        setEndReason('');
        toast('Stream Ended');
      },
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const openActions = (stream: any) => {
    Haptics.selectionAsync();
    const host = stream.profiles;
    showSheet({
      title: stream.title || `${host?.name}'s Stream`,
      message: `${stream.viewer_count} watching · ${formatDistanceToNow(new Date(stream.started_at), { addSuffix: true })}`,
      options: [
        {
          label: 'Mute Audio',
          onPress: () => muteAudio.mutate({ streamId: stream.id, hostId: stream.host_id }, {
            onSuccess: () => toast('Audio Muted', `${host?.name}'s microphone has been muted.`),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        {
          label: 'Mute Video',
          onPress: () => muteVideo.mutate({ streamId: stream.id, hostId: stream.host_id }, {
            onSuccess: () => toast('Video Muted', `${host?.name}'s camera has been muted.`),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        {
          label: host?.can_stream === false ? 'Allow Streaming' : 'Ban from Streaming',
          destructive: host?.can_stream !== false,
          onPress: () => setCanStream.mutate({ userId: stream.host_id, canStream: host?.can_stream === false }, {
            onSuccess: () => toast(host?.can_stream === false ? 'Streaming Allowed' : 'Streaming Revoked'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        { label: 'View Host', onPress: () => router.push({ pathname: '/admin/user/[id]', params: { id: stream.host_id } } as any) },
        {
          label: 'Force End Stream',
          destructive: true,
          onPress: () => setEndTarget({ streamId: stream.id, hostId: stream.host_id, hostName: host?.name || 'Host' }),
        },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Live Streams</Text>
            <View style={s.subtitleRow}>
              <View style={s.liveDot} />
              <Text style={s.subtitle}>{streams.length} active</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={streams}
          keyExtractor={st => st.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 12, justifyContent: 'flex-start' }}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <StreamCard
              stream={item}
              onActions={() => openActions(item)}
              onWatch={() => router.push({ pathname: '/admin/watch/[id]', params: { id: item.id } } as any)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="videocam-off-outline" size={52} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No active streams</Text>
              <Text style={s.emptyText}>Auto-refreshes every 10 seconds.</Text>
            </View>
          }
        />
      )}

      {/* Force-end reason modal */}
      <Modal visible={!!endTarget} transparent animationType="fade" onRequestClose={() => setEndTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.modal}>
            <View style={s.modalIcon}>
              <Ionicons name="warning" size={28} color="#FF453A" />
            </View>
            <Text style={s.modalTitle}>Force End {endTarget?.hostName}'s Stream?</Text>
            <Text style={s.modalText}>The stream will close immediately for the host and all viewers. Provide a reason.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Inappropriate content, harassment..."
              placeholderTextColor={Colors.textMuted}
              value={endReason}
              onChangeText={setEndReason}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setEndTarget(null); setEndReason(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleConfirmEnd} disabled={endStream.isPending}>
                {endStream.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.modalConfirmText}>End Stream</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Stream card ─────────────────────────────────────────────────────────────

function StreamCard({ stream, onActions, onWatch }: { stream: any; onActions: () => void; onWatch: () => void }) {
  const host = stream.profiles;
  return (
    <View style={sc.card}>
      <TouchableOpacity activeOpacity={0.85} onPress={onWatch}>
        <View style={sc.imgWrap}>
          <Image
            source={{ uri: fixAvatarUri(host?.avatar_url, host?.id) }}
            style={sc.img}
            contentFit="cover"
            blurRadius={4}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.78)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Center play overlay — indicates the card is tappable */}
          <View style={sc.playOverlay} pointerEvents="none">
            <View style={sc.playCircle}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
            <Text style={sc.playHint}>Tap to watch live</Text>
          </View>
          <View style={sc.topRow}>
            <View style={sc.liveBadge}>
              <View style={sc.liveDot} />
              <Text style={sc.liveText}>LIVE</Text>
            </View>
            <View style={sc.viewerPill}>
              <Ionicons name="eye" size={11} color="#fff" />
              <Text style={sc.viewerText}>
                {stream.viewer_count >= 1000 ? `${(stream.viewer_count / 1000).toFixed(1)}k` : stream.viewer_count}
              </Text>
            </View>
          </View>
          <View style={sc.titleWrap}>
            <Text style={sc.title} numberOfLines={2}>{stream.title || 'Untitled stream'}</Text>
            <View style={sc.hostRow}>
              <Image
                source={{ uri: fixAvatarUri(host?.avatar_url, host?.id) }}
                style={sc.hostAvatar}
                contentFit="cover"
              />
              <Text style={sc.hostName} numberOfLines={1}>{host?.name || 'Unknown'}</Text>
              {host?.is_verified && <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />}
              {host?.is_banned && (
                <View style={sc.banPill}><Text style={sc.banText}>BANNED USER</Text></View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={sc.actionsRow}>
        <Stat label="watching" value={stream.viewer_count || 0} icon="eye-outline" />
        <Stat label="gifts" value={stream.gift_total || 0} icon="gift-outline" color="#FFD700" />
        <TouchableOpacity style={sc.moreBtn} onPress={onActions}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number | string; icon: any; color?: string }) {
  return (
    <View style={sc.stat}>
      <Ionicons name={icon} size={13} color={color || Colors.textMuted} />
      <Text style={[sc.statValue, color ? { color } : null]}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={sc.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF453A' },
  subtitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  list: { paddingVertical: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  modal: { width: '100%', backgroundColor: Colors.card, borderRadius: 22, padding: 22, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  modalIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,69,58,0.12)', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  modalText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 4 },
  modalInput: { width: '100%', minHeight: 76, maxHeight: 140, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14, marginTop: 6, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  modalCancel: { flex: 1, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalConfirm: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

const sc = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: Colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder },
  imgWrap: { width: CARD_W, height: CARD_W * 1.55, position: 'relative', backgroundColor: '#0a0a0f' },
  img: { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6 },
  playCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  playHint: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  topRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  viewerPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  viewerText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  titleWrap: { position: 'absolute', bottom: 8, left: 10, right: 10, gap: 4 },
  title: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: -0.2, lineHeight: 16 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hostAvatar: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#fff' },
  hostName: { color: '#fff', fontSize: 10, fontWeight: '700', flexShrink: 1 },
  banPill: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: '#FF453A' },
  banText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.3 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  statValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '500' },
  moreBtn: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
});
