import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createAgoraRtcEngine, IRtcEngine, RtcSurfaceView,
  ChannelProfileType, ClientRoleType,
} from 'react-native-agora';
import { Colors } from '@/constants/colors';
import { AGORA_APP_ID, AGORA_TEST_CHANNEL, getAgoraToken } from '@/services/agoraService';
import { supabase } from '@/services/supabase';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { useEndStreamAsAdmin, useMuteStreamAudio, useMuteStreamVideo } from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { TextInput, KeyboardAvoidingView, Modal } from 'react-native';

/**
 * Admin live watcher.
 * Joins the live channel as a silent audience, displays the host's video,
 * and exposes admin actions (mute audio/video, force end).
 */
export default function AdminWatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const streamId = id || '';
  const showSheet = useSheet();

  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [endTarget, setEndTarget] = useState(false);
  const [endReason, setEndReason] = useState('');
  const engineRef = useRef<IRtcEngine | null>(null);

  const endStream = useEndStreamAsAdmin();
  const muteAudio = useMuteStreamAudio();
  const muteVideo = useMuteStreamVideo();

  const toast = (title: string, message?: string) =>
    showSheet({ title, message, options: [{ label: 'OK' }] });

  // Fetch stream metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('live_streams')
          .select('*, profiles!live_streams_host_id_fkey (id, name, avatar_url, is_verified)')
          .eq('id', streamId)
          .single();
        if (!cancelled) {
          setStream(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [streamId]);

  // Setup Agora as audience
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
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
          onUserJoined: (_c, uid) => { if (mounted) setRemoteUid(uid); },
          onUserOffline: (_c, uid) => {
            if (!mounted) return;
            setRemoteUid(curr => (curr === uid ? null : curr));
          },
        });
        engine.setClientRole(ClientRoleType.ClientRoleAudience);
        engine.enableVideo();
        engine.enableAudio();
        setEngineReady(true);
        setTimeout(async () => {
          const token = await getAgoraToken(AGORA_TEST_CHANNEL, 0, 'subscriber');
          await engineRef.current?.joinChannel(token, AGORA_TEST_CHANNEL, 0, {
            clientRoleType: ClientRoleType.ClientRoleAudience,
            publishCameraTrack: false,
            publishMicrophoneTrack: false,
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
          });
        }, 80);
      } catch (e) {
        console.log('[admin watch] init error', e);
      }
    })();
    return () => {
      mounted = false;
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
      engineRef.current = null;
    };
  }, []);

  const handleConfirmEnd = () => {
    if (!stream) return;
    if (!endReason.trim()) {
      toast('Reason required', 'Please provide a reason. The host will see this.');
      return;
    }
    endStream.mutate({ streamId, hostId: stream.host_id, reason: endReason.trim() }, {
      onSuccess: () => {
        setEndTarget(false);
        setEndReason('');
        toast('Stream Ended');
        router.back();
      },
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const openActions = () => {
    if (!stream) return;
    showSheet({
      title: stream.title || `${stream.profiles?.name}'s Stream`,
      options: [
        {
          label: 'Mute Audio',
          onPress: () => muteAudio.mutate({ streamId, hostId: stream.host_id }, {
            onSuccess: () => toast('Audio Muted'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        {
          label: 'Mute Video',
          onPress: () => muteVideo.mutate({ streamId, hostId: stream.host_id }, {
            onSuccess: () => toast('Video Muted'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        { label: 'View Host', onPress: () => router.push({ pathname: '/admin/user/[id]', params: { id: stream.host_id } } as any) },
        { label: 'Force End Stream', destructive: true, onPress: () => setEndTarget(true) },
        { label: 'Cancel' },
      ],
    });
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const host = stream?.profiles;

  return (
    <View style={s.container}>
      {/* Live video — full screen */}
      {engineReady && remoteUid !== null ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid }} />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.fallback]}>
          {host && (
            <Image source={{ uri: fixAvatarUri(host.avatar_url, host.id) }} style={s.fallbackAvatar} contentFit="cover" />
          )}
          <Text style={s.fallbackText}>
            {!engineReady ? 'Connecting...' : 'Host is offline'}
          </Text>
        </View>
      )}

      {/* Top dark gradient + admin overlay */}
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={s.topGrad} pointerEvents="none" />
      <SafeAreaView edges={['top']} style={s.topSafe}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.adminBadgeWrap}>
            <Ionicons name="shield-checkmark" size={13} color="#fff" />
            <Text style={s.adminBadgeText}>ADMIN VIEW</Text>
          </View>
          <TouchableOpacity style={s.moreBtn} onPress={openActions}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stream info */}
        {host && (
          <View style={s.hostRow}>
            <Image source={{ uri: fixAvatarUri(host.avatar_url, host.id) }} style={s.hostAvatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.hostName} numberOfLines={1}>{host.name}</Text>
                {host.is_verified && <Ionicons name="checkmark-circle" size={13} color={Colors.primary} />}
              </View>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            </View>
            <View style={s.viewerPill}>
              <Ionicons name="eye" size={12} color="#fff" />
              <Text style={s.viewerText}>{stream?.viewer_count ?? 0}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Bottom action bar */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={s.bottomGrad} pointerEvents="none" />
      <SafeAreaView edges={['bottom']} style={s.bottomSafe}>
        <View style={s.actions}>
          <ActionBtn
            icon="mic-off-outline"
            label="Mute Audio"
            onPress={() => muteAudio.mutate({ streamId, hostId: stream.host_id }, {
              onSuccess: () => toast('Audio Muted'),
              onError: (e: any) => toast('Error', e.message),
            })}
          />
          <ActionBtn
            icon="videocam-off-outline"
            label="Mute Video"
            onPress={() => muteVideo.mutate({ streamId, hostId: stream.host_id }, {
              onSuccess: () => toast('Video Muted'),
              onError: (e: any) => toast('Error', e.message),
            })}
          />
          <ActionBtn
            icon="power"
            label="End Stream"
            destructive
            onPress={() => setEndTarget(true)}
          />
        </View>
      </SafeAreaView>

      {/* Force-end modal with reason input */}
      <Modal visible={endTarget} transparent animationType="fade" onRequestClose={() => setEndTarget(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.modal}>
            <View style={s.modalIcon}>
              <Ionicons name="warning" size={28} color="#FF453A" />
            </View>
            <Text style={s.modalTitle}>Force End {host?.name}'s Stream?</Text>
            <Text style={s.modalText}>The host and all viewers see your reason and the stream closes immediately.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Inappropriate content..."
              placeholderTextColor={Colors.textMuted}
              value={endReason}
              onChangeText={setEndReason}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setEndTarget(false); setEndReason(''); }}>
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

function ActionBtn({ icon, label, onPress, destructive }: { icon: any; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity style={[s.actionBtn, destructive && s.actionBtnDanger]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', gap: 14 },
  fallbackAvatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },

  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 5 },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  adminBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: Colors.primary },
  adminBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  moreBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8 },
  hostAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hostName: { color: '#fff', fontSize: 14, fontWeight: '800', maxWidth: 180 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,59,48,0.75)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  viewerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  viewerText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, zIndex: 5 },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 6 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 16, paddingTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  actionBtnDanger: { backgroundColor: '#FF453A', borderColor: '#FF453A' },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  modal: { width: '100%', backgroundColor: Colors.card, borderRadius: 22, padding: 22, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  modalIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,69,58,0.12)', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  modalText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  modalInput: { width: '100%', minHeight: 76, maxHeight: 140, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14, marginTop: 6, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  modalCancel: { flex: 1, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalConfirm: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
