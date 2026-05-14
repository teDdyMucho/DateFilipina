import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  RtcSurfaceView,
  RtcTextureView,
  ChannelProfileType,
  ClientRoleType,
  VideoSourceType,
} from 'react-native-agora';
import { callService, CallStatus } from '@/services/callService';
import { useAuthStore } from '@/store/authStore';
import { AGORA_APP_ID, AGORA_TEST_CHANNEL, getAgoraToken } from '@/services/agoraService';

function PulsingRing({ size = 160, color = 'rgba(255,255,255,0.2)' }: { size?: number; color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

type ScreenState = 'ringing' | 'connected' | 'ended';

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; type?: string; partnerName?: string; partnerAvatar?: string; calleeId?: string }>();
  const authUser = useAuthStore(s => s.user);
  const isVideo = params.type !== 'audio';
  const partnerName = params.partnerName || 'Unknown';
  const partnerAvatar = params.partnerAvatar || '';
  const myAvatar = authUser?.avatar || '';

  const [screenState, setScreenState] = useState<ScreenState>('ringing');
  const [sessionId, setSessionId] = useState<string | null>(params.sessionId || null);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const engineRef = useRef<IRtcEngine | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setupAgora();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!engineReady || !authUser?.id) return;
    if (params.sessionId && params.calleeId) {
      setScreenState('connected');
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      subscribeToSession(params.sessionId);
    } else if (params.calleeId) {
      initCall();
    }
  }, [engineReady, authUser?.id]);

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
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.registerEventHandler({
        onUserJoined: (connection, uid) => {
          setRemoteUid(uid);
        },
        onUserOffline: () => {
          setRemoteUid(null);
        },
        onError: (err) => {
          console.log('[Agora] error', err);
        },
      });

      if (isVideo) {
        engine.enableVideo();
      } else {
        engine.enableAudio();
      }

      setEngineReady(true);
      // Let RtcSurfaceView mount before starting preview/joining
      setTimeout(async () => {
        if (isVideo) engineRef.current?.startPreview();
        const token = await getAgoraToken(AGORA_TEST_CHANNEL, 0, 'publisher');
        await engineRef.current?.joinChannel(token, AGORA_TEST_CHANNEL, 0, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishCameraTrack: isVideo,
          publishMicrophoneTrack: true,
        });
      }, 100);
    } catch (e: any) {
      console.log('[Agora] setup error', e.message);
    }
  };

  const initCall = async () => {
    try {
      const session = await callService.startCall(authUser!.id, params.calleeId!, (params.type as 'video' | 'audio') || 'video');
      setSessionId(session.id);
      subscribeToSession(session.id);
      ringTimeoutRef.current = setTimeout(() => {
        callService.cancelCall(session.id).catch(() => {});
        setScreenState('ended');
        setTimeout(() => router.back(), 2000);
      }, 45_000);
    } catch {
      router.back();
    }
  };

  const subscribeToSession = (sid: string) => {
    channelRef.current = callService.subscribeToCall(sid, (status: CallStatus) => {
      if (status === 'answered') {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        setScreenState('connected');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } else if (status === 'declined') {
        setScreenState('ended');
        setTimeout(() => router.back(), 2500);
      } else if (status === 'ended' || status === 'missed') {
        if (durationRef.current) clearInterval(durationRef.current);
        setScreenState('ended');
        setTimeout(() => router.back(), 2500);
      }
    });
  };

  const cleanup = () => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    channelRef.current?.unsubscribe();
    engineRef.current?.leaveChannel();
    engineRef.current?.release();
    engineRef.current = null;
  };

  const handleEnd = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    cleanup();
    if (sessionId) await callService.endCall(sessionId).catch(() => {});
    setScreenState('ended');
    setTimeout(() => router.back(), 1500);
  };

  const handleMute = () => {
    if (!engineRef.current) return;
    engineRef.current.muteLocalAudioStream(!muted);
    setMuted(m => !m);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCamOff = () => {
    if (!engineRef.current) return;
    engineRef.current.muteLocalVideoStream(!camOff);
    setCamOff(c => !c);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSwitchCam = () => {
    if (!engineRef.current) return;
    engineRef.current.switchCamera();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const fmtDuration = (secs: number) => {
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Ringing screen ──
  if (screenState === 'ringing') {
    return (
      <View style={s.fill}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        {partnerAvatar
          ? <Image source={{ uri: partnerAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={70} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d1a' }]} />}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={s.ringingWrap} edges={['top', 'bottom']}>
          <View style={s.ringingHeader}>
            <Text style={s.callTypeText}>
              {params.calleeId
                ? (isVideo ? 'Video Calling...' : 'Calling...')
                : (isVideo ? 'Incoming Video Call' : 'Incoming Call')}
            </Text>
          </View>
          <View style={s.ringingCenter}>
            <View style={s.avatarWrap}>
              <PulsingRing size={200} color="rgba(255,255,255,0.12)" />
              <PulsingRing size={155} color="rgba(255,255,255,0.18)" />
              {partnerAvatar
                ? <Image source={{ uri: partnerAvatar }} style={s.ringingAvatar} contentFit="cover" />
                : <View style={[s.ringingAvatar, s.avatarFallback]}>
                    <Ionicons name="person" size={52} color="rgba(255,255,255,0.5)" />
                  </View>}
            </View>
            <Text style={s.ringingName}>{partnerName}</Text>
            <Text style={s.ringingStatus}>
              {params.calleeId ? 'Ringing…' : isVideo ? 'Video Call' : 'Voice Call'}
            </Text>
          </View>
          <View style={s.ringingFooter}>
            <View style={s.callBtnWrap}>
              <TouchableOpacity style={s.endCallBtn} onPress={handleEnd} activeOpacity={0.8}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={s.callBtnLabel}>End</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Ended screen ──
  if (screenState === 'ended') {
    return (
      <View style={[s.fill, { backgroundColor: '#0d0d1a' }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={s.ringingWrap} edges={['top', 'bottom']}>
          <View style={s.ringingCenter}>
            {partnerAvatar
              ? <Image source={{ uri: partnerAvatar }} style={s.ringingAvatar} contentFit="cover" />
              : <View style={[s.ringingAvatar, s.avatarFallback]}>
                  <Ionicons name="person" size={52} color="rgba(255,255,255,0.5)" />
                </View>}
            <Text style={[s.ringingName, { marginTop: 20 }]}>{partnerName}</Text>
            <Text style={s.ringingStatus}>
              Call ended{duration > 0 ? ` · ${fmtDuration(duration)}` : ''}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Connected / video call screen ──
  return (
    <View style={s.fill}>
      <StatusBar hidden />

      {/* Remote video — full screen */}
      {isVideo && engineReady && remoteUid !== null ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUid }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
          {partnerAvatar
            ? <Image source={{ uri: partnerAvatar }} style={{ width: 140, height: 140, borderRadius: 70 }} contentFit="cover" />
            : <Ionicons name="person" size={80} color="rgba(255,255,255,0.3)" />}
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 14 }}>
            {remoteUid === null ? 'Waiting for other person...' : 'Camera off'}
          </Text>
        </View>
      )}

      {/* Local preview — top right (use TextureView to avoid SurfaceView z-order conflict with remote) */}
      {isVideo && engineReady && !camOff && (
        <View style={s.localView}>
          <RtcTextureView
            style={{ flex: 1 }}
            canvas={{ uid: 0 }}
          />
        </View>
      )}

      {/* Top gradient + info */}
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={s.topGrad} pointerEvents="none" />
      <SafeAreaView style={s.topSafe} edges={['top']} pointerEvents="box-none">
        <View style={s.topRow}>
          <View>
            <Text style={s.connectedName}>{partnerName}</Text>
            <View style={s.durationRow}>
              <View style={s.dot} />
              <Text style={s.durationText}>{fmtDuration(duration)}</Text>
            </View>
          </View>
          {isVideo && (
            <TouchableOpacity style={s.iconBtn} onPress={handleSwitchCam} activeOpacity={0.75}>
              <Ionicons name="camera-reverse" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Bottom gradient + controls */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={s.bottomGrad} pointerEvents="none" />
      <SafeAreaView style={s.bottomSafe} edges={['bottom']} pointerEvents="box-none">
        <View style={s.controls}>
          <View style={s.ctrlWrap}>
            <TouchableOpacity style={[s.ctrlBtn, muted && s.ctrlBtnOn]} onPress={handleMute} activeOpacity={0.75}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.ctrlLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
          </View>

          {isVideo && (
            <View style={s.ctrlWrap}>
              <TouchableOpacity style={[s.ctrlBtn, camOff && s.ctrlBtnOn]} onPress={handleCamOff} activeOpacity={0.75}>
                <Ionicons name={camOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={s.ctrlLabel}>{camOff ? 'Start Cam' : 'Stop Cam'}</Text>
            </View>
          )}

          <View style={s.ctrlWrap}>
            <TouchableOpacity style={s.endCallBtn} onPress={handleEnd} activeOpacity={0.8}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={s.ctrlLabel}>End</Text>
          </View>

          <View style={s.ctrlWrap}>
            <TouchableOpacity style={s.ctrlBtn} activeOpacity={0.75}>
              <Ionicons name="volume-high" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.ctrlLabel}>Speaker</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const AVATAR_SIZE = 120;

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },

  ringingWrap: { flex: 1, justifyContent: 'space-between' },
  ringingHeader: { alignItems: 'center', paddingTop: 12 },
  callTypeText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  ringingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  avatarWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ringingAvatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  avatarFallback: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  ringingName: { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  ringingStatus: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  ringingFooter: { paddingBottom: 52, flexDirection: 'row', justifyContent: 'center' },
  callBtnWrap: { alignItems: 'center', gap: 10 },
  callBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

  localView: { position: 'absolute', top: 72, right: 16, width: 96, height: 140, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', zIndex: 10 },

  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  connectedName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34C759' },
  durationText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, zIndex: 5 },
  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 6 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 20, paddingBottom: 36, paddingHorizontal: 20 },
  ctrlWrap: { alignItems: 'center', gap: 8 },
  ctrlBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnOn: { backgroundColor: 'rgba(255,59,48,0.7)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  endCallBtn: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#FF3B30', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});
