import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, FlatList, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Message } from '@/constants/types';
import { useSheet } from '@/components/GlobalActionSheet';

type Tab = 'photos' | 'media' | 'links';

interface Props {
  visible: boolean;
  onClose: () => void;
  partnerName: string;
  partnerAvatar: string;
  messages: Message[];
  isBlocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
}

const URL_REGEX = /\bhttps?:\/\/[^\s]+/gi;

export function ChatSettingsModal({ visible, onClose, partnerName, partnerAvatar, messages, isBlocked, onBlock, onUnblock, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('photos');
  const showSheet = useSheet();

  const photos = useMemo(
    () => messages.filter(m => m.type === 'image' || (m.imageUrl && !m.content?.endsWith('.mp4'))),
    [messages]
  );
  const media = useMemo(
    () => messages.filter(m => m.imageUrl?.endsWith('.mp4') || m.content?.endsWith('.mp4')),
    [messages]
  );
  const links = useMemo(() => {
    const found: { id: string; url: string; text: string; timestamp: Date }[] = [];
    messages.forEach(m => {
      if (m.type === 'text' && m.content) {
        const matches = m.content.match(URL_REGEX);
        if (matches) matches.forEach(url => found.push({ id: m.id + url, url, text: m.content, timestamp: m.timestamp }));
      }
    });
    return found;
  }, [messages]);

  const confirmBlock = () => {
    showSheet({
      title: `Block ${partnerName}?`,
      message: 'They won\'t be able to send you messages.',
      options: [
        { label: 'Block', destructive: true, onPress: () => { onBlock(); onClose(); } },
        { label: 'Cancel' },
      ],
    });
  };

  const confirmDelete = () => {
    showSheet({
      title: 'Delete Conversation?',
      message: 'This will hide the conversation for you only. The other person will still see your messages.',
      options: [
        { label: 'Delete', destructive: true, onPress: () => { onDelete(); onClose(); } },
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Chat Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Partner section */}
        <View style={s.partnerSection}>
          {partnerAvatar
            ? <Image source={{ uri: partnerAvatar }} style={s.avatar} contentFit="cover" />
            : <View style={[s.avatar, { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={40} color={Colors.textMuted} />
              </View>}
          <Text style={s.partnerName}>{partnerName}</Text>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TabBtn icon="image-outline" label="Photos" count={photos.length} active={tab === 'photos'} onPress={() => setTab('photos')} />
          <TabBtn icon="videocam-outline" label="Media" count={media.length} active={tab === 'media'} onPress={() => setTab('media')} />
          <TabBtn icon="link-outline" label="Links" count={links.length} active={tab === 'links'} onPress={() => setTab('links')} />
        </View>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {tab === 'photos' && (
            <FlatList
              data={photos}
              numColumns={3}
              keyExtractor={m => m.id}
              contentContainerStyle={s.grid}
              renderItem={({ item }) => (
                <View style={s.gridCell}>
                  <Image source={{ uri: item.imageUrl || item.content }} style={s.gridImg} contentFit="cover" />
                </View>
              )}
              ListEmptyComponent={<EmptyState icon="image-outline" label="No photos shared yet" />}
            />
          )}

          {tab === 'media' && (
            <FlatList
              data={media}
              numColumns={3}
              keyExtractor={m => m.id}
              contentContainerStyle={s.grid}
              renderItem={({ item }) => (
                <View style={s.gridCell}>
                  <View style={s.videoCell}>
                    <Ionicons name="play-circle" size={36} color="#fff" />
                  </View>
                </View>
              )}
              ListEmptyComponent={<EmptyState icon="videocam-outline" label="No videos shared yet" />}
            />
          )}

          {tab === 'links' && (
            <FlatList
              data={links}
              keyExtractor={l => l.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL(item.url).catch(() => {})}>
                  <View style={s.linkIconWrap}>
                    <Ionicons name="link" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.linkUrl} numberOfLines={1}>{item.url}</Text>
                    <Text style={s.linkTime}>{item.timestamp.toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<EmptyState icon="link-outline" label="No links shared yet" />}
            />
          )}
        </View>

        {/* Action buttons */}
        <View style={s.actions}>
          {isBlocked ? (
            <TouchableOpacity style={s.actionBtn} onPress={() => { onUnblock(); onClose(); }}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />
              <Text style={[s.actionLabel, { color: '#34C759' }]}>Unblock {partnerName}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.actionBtn} onPress={confirmBlock}>
              <Ionicons name="ban-outline" size={20} color="#FF9F0A" />
              <Text style={[s.actionLabel, { color: '#FF9F0A' }]}>Block {partnerName}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.actionBtn} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={20} color="#FF453A" />
            <Text style={[s.actionLabel, { color: '#FF453A' }]}>Delete Conversation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function TabBtn({ icon, label, count, active, onPress }: { icon: any; label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.tabBtn, active && s.tabBtnActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.75}>
      <Ionicons name={icon} size={18} color={active ? Colors.primary : Colors.textMuted} />
      <Text style={[s.tabLabel, active && { color: Colors.primary, fontWeight: '700' }]}>{label}</Text>
      {count > 0 && <Text style={[s.tabCount, active && { color: Colors.primary }]}>{count}</Text>}
    </TouchableOpacity>
  );
}

function EmptyState({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={Colors.textMuted} />
      <Text style={s.emptyLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  partnerSection: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Colors.glassBorder },
  partnerName: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, paddingBottom: 10 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent' },
  tabBtnActive: { backgroundColor: 'rgba(255,61,110,0.12)', borderColor: 'rgba(255,61,110,0.3)' },
  tabLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabCount: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },

  grid: { padding: 4 },
  gridCell: { width: '33.33%', aspectRatio: 1, padding: 2 },
  gridImg: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#222' },
  videoCell: { width: '100%', height: '100%', backgroundColor: '#1a1a1a', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8 },
  linkIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,61,110,0.15)', alignItems: 'center', justifyContent: 'center' },
  linkUrl: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  linkTime: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyLabel: { color: Colors.textMuted, fontSize: 14 },

  actions: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  actionLabel: { fontSize: 15, fontWeight: '600' },
});
