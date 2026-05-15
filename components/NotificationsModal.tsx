import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import { Notification, NotificationType } from '@/services/notificationService';
import { useNotifications, useMarkAllRead, useDeleteNotification, useClearAllNotifications } from '@/hooks/useNotifications';
import { useSheet } from '@/components/GlobalActionSheet';

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  like:       { icon: 'heart',          color: '#FF3D6E' },
  super_like: { icon: 'star',           color: '#FFD700' },
  match:      { icon: 'sparkles',       color: '#BF5AF2' },
  message:    { icon: 'chatbubble',     color: '#5E5CE6' },
  comment:    { icon: 'chatbox',        color: '#30D158' },
  share:      { icon: 'arrow-redo',     color: '#0A84FF' },
  follow:     { icon: 'person-add',     color: '#FF9F0A' },
  gift:       { icon: 'gift',           color: '#FF3D6E' },
  live_start: { icon: 'videocam',       color: '#FF3B30' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsModal({ visible, onClose }: Props) {
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: deleteOne } = useDeleteNotification();
  const { mutate: clearAll } = useClearAllNotifications();
  const showSheet = useSheet();
  const router = useRouter();

  // When the modal opens, mark everything as read so the bell badge clears.
  useEffect(() => {
    if (visible && notifications.some(n => !n.isRead)) {
      markAllRead();
    }
  }, [visible]);

  const handleTap = (n: Notification) => {
    // Best-effort deep-link to the relevant screen
    onClose();
    setTimeout(() => {
      if ((n.type === 'like' || n.type === 'comment' || n.type === 'share') && n.data?.post_id) {
        // Most posts live on the user's profile; for now, open the actor's profile
        if (n.actor) router.push({ pathname: '/user/[id]', params: { id: n.actor.id } } as any);
      } else if (n.type === 'follow' || n.type === 'super_like') {
        if (n.actor) router.push({ pathname: '/user/[id]', params: { id: n.actor.id } } as any);
      } else if (n.type === 'match') {
        router.push('/(tabs)/messages' as any);
      } else if (n.type === 'message') {
        router.push('/(tabs)/messages' as any);
      } else if (n.type === 'gift' || n.type === 'live_start') {
        router.push('/(tabs)/live' as any);
      } else if (n.actor) {
        router.push({ pathname: '/user/[id]', params: { id: n.actor.id } } as any);
      }
    }, 50);
  };

  const handleLongPress = (n: Notification) => {
    showSheet({
      title: 'Notification',
      options: [
        { label: 'Delete', destructive: true, onPress: () => deleteOne(n.id) },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    showSheet({
      title: 'Clear all notifications?',
      message: 'This cannot be undone.',
      options: [
        { label: 'Clear All', destructive: true, onPress: () => clearAll() },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.title}>Notifications</Text>
            <TouchableOpacity
              onPress={handleClearAll}
              disabled={notifications.length === 0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[s.clearText, notifications.length === 0 && { opacity: 0.3 }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : notifications.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="notifications-off-outline" size={56} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No notifications</Text>
            <Text style={s.emptySub}>When people interact with you, you'll see it here.</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={n => n.id}
            onRefresh={refetch}
            refreshing={isLoading}
            renderItem={({ item }) => <Row item={item} onPress={handleTap} onLongPress={handleLongPress} />}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </Modal>
  );
}

function Row({
  item, onPress, onLongPress,
}: {
  item: Notification;
  onPress: (n: Notification) => void;
  onLongPress: (n: Notification) => void;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.message;
  return (
    <TouchableOpacity
      style={[s.row, !item.isRead && s.rowUnread]}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
    >
      <View style={{ position: 'relative' }}>
        {item.actor ? (
          <Image source={{ uri: item.actor.avatar }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatar, { backgroundColor: meta.color + '22', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>
        )}
        {item.actor && (
          <View style={[s.iconBadge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={11} color="#fff" />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.bodyText} numberOfLines={2}>
          {item.actor && <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{item.actor.name} </Text>}
          {item.body.replace(item.actor?.name + ' ', '')}
        </Text>
        <Text style={s.time}>{formatDistanceToNow(item.createdAt, { addSuffix: true })}</Text>
      </View>
      {!item.isRead && <View style={s.unreadDot} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  clearText: { color: Colors.primaryLight, fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 10 },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.background },
  rowUnread: { backgroundColor: 'rgba(214,26,78,0.06)' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#222' },
  iconBadge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  bodyText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },
  time: { color: Colors.textMuted, fontSize: 11 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  separator: { height: 1, backgroundColor: Colors.separator, marginLeft: 74 },
});
