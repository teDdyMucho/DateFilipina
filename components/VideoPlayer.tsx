import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, PanResponder,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

const { width: SW } = Dimensions.get('window');

export function VideoFullscreenModal({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <Video
          source={{ uri }}
          style={{ width: SW, height: SW * 0.5625 }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls
        />
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: 52, right: 18, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 }}>✕  Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function VideoPlayer({ uri, isVisible = true }: { uri: string; isVisible?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<Video>(null);
  const scrubBarWidth = useRef(1);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setTimeout(() => {
        videoRef.current?.pauseAsync().catch(() => {});
      }, 0);
      setPlaying(false);
    }
  }, [isVisible]);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  const resetControlsTimer = () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => {
      if (playing && !isScrubbing) setShowControls(false);
    }, 3000);
  };

  const handlePlayPause = async () => {
    if (ended) {
      await videoRef.current?.setPositionAsync(0);
      await videoRef.current?.playAsync();
      setEnded(false); setPlaying(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => setShowControls(false), 800);
    } else if (playing) {
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      await videoRef.current?.pauseAsync();
      controlsTimer.current = setTimeout(() => setShowControls(false), 700);
    } else {
      await videoRef.current?.playAsync();
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => setShowControls(false), 800);
    }
  };

  const seekTo = async (x: number) => {
    const pct = Math.max(0, Math.min(1, x / scrubBarWidth.current));
    const newPos = Math.round(pct * duration);
    setPosition(newPos);
    await videoRef.current?.setPositionAsync(newPos);
    if (ended) setEnded(false);
  };

  const scrubPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: async (e) => {
      setIsScrubbing(true);
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      await videoRef.current?.pauseAsync();
      seekTo(e.nativeEvent.locationX);
    },
    onPanResponderMove: (e) => seekTo(e.nativeEvent.locationX),
    onPanResponderRelease: async (e) => {
      await seekTo(e.nativeEvent.locationX);
      await videoRef.current?.playAsync();
      setPlaying(true);
      setIsScrubbing(false);
      resetControlsTimer();
    },
  })).current;

  return (
    <View style={s.videoWrapper}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={s.media}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isMuted={isMuted}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if (!status.isLoaded || isScrubbing) return;
          setPlaying(status.isPlaying);
          setPosition(status.positionMillis ?? 0);
          if (status.durationMillis) setDuration(status.durationMillis);
          if (status.didJustFinish) {
            setEnded(true); setPlaying(false); setShowControls(true);
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
          }
        }}
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handlePlayPause}
      />

      {(!playing && !ended) && (
        <View pointerEvents="none" style={s.centreBtn}>
          <View style={s.centreBtnInner}>
            <Ionicons name="play" size={28} color="#fff" />
          </View>
        </View>
      )}
      {ended && (
        <View pointerEvents="none" style={s.centreBtn}>
          <View style={s.centreBtnInner}>
            <Ionicons name="refresh" size={28} color="#fff" />
          </View>
        </View>
      )}
      {playing && showControls && (
        <View pointerEvents="none" style={s.centreBtn}>
          <View style={s.centreBtnInner}>
            <Ionicons name="pause" size={28} color="#fff" />
          </View>
        </View>
      )}

      {(showControls || !playing || ended) && (
        <View style={s.videoBar}>
          <TouchableOpacity onPress={handlePlayPause} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={ended ? 'refresh' : playing ? 'pause' : 'play'} size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={s.barTime}>{fmtTime(position)}</Text>
          <View
            style={s.scrubTrack}
            onLayout={e => { scrubBarWidth.current = Math.max(1, e.nativeEvent.layout.width); }}
            {...scrubPanResponder.panHandlers}
          >
            <View style={s.scrubRail} />
            <View style={[s.scrubFill, { width: `${progress * 100}%` as any }]} />
            <View style={[s.scrubThumb, { left: `${progress * 100}%` as any }]} />
          </View>
          <Text style={s.barTime}>{fmtTime(duration)}</Text>
          <TouchableOpacity
            onPress={() => { setIsMuted(m => !m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFullscreen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.fullscreenIcon}
          >
            <Ionicons name="expand" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <VideoFullscreenModal uri={uri} visible={showFullscreen} onClose={() => setShowFullscreen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  videoWrapper: { position: 'relative' },
  media: { width: SW, height: SW * 0.75 },
  centreBtn: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centreBtnInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  videoBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 8,
  },
  barTime: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', minWidth: 34, textAlign: 'center' },
  scrubTrack: { flex: 1, height: 20, justifyContent: 'center' },
  scrubRail: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  scrubFill: { position: 'absolute', left: 0, height: 3, backgroundColor: Colors.primaryLight, borderRadius: 2 },
  scrubThumb: { position: 'absolute', top: 4, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', marginLeft: -6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, elevation: 3 },
  fullscreenIcon: { paddingLeft: 2 },
});
