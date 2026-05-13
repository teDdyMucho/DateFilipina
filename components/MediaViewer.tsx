import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export interface MediaItem {
  id: string;
  url: string;
  type: 'photo' | 'video';
}

interface Props {
  visible: boolean;
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

export function MediaViewer({ visible, items, initialIndex, onClose }: Props) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Jump to the initial item once the list is mounted
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: initialIndex * W, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View style={s.container}>
        <SafeAreaView edges={['top']} style={s.headerWrap}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={s.counter}>{currentIndex + 1} / {items.length}</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        <FlatList
          ref={flatListRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          renderItem={({ item, index }) => (
            <MediaSlide item={item} isActive={index === currentIndex && visible} />
          )}
        />
      </View>
    </Modal>
  );
}

function MediaSlide({ item, isActive }: { item: MediaItem; isActive: boolean }) {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pause when slide isn't active
    if (!isActive && videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive]);

  if (item.type === 'video') {
    return (
      <View style={s.slide}>
        <Video
          ref={videoRef}
          source={{ uri: item.url }}
          style={s.media}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay={isActive}
          isLooping={false}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <View style={s.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.slide}>
      <Image source={{ uri: item.url }} style={s.media} contentFit="contain" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.45)' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  counter: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  slide: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  media: { width: W, height: H },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
