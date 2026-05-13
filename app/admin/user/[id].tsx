import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import {
  useAdminUser, useAdminUserActivity,
  useBanUser, useUnbanUser, useDeleteUser,
  useSetVerified, useSetCanStream, useRemoveAvatar, useRemoveCover,
} from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = id || '';
  const showSheet = useSheet();

  const { data: user, isLoading } = useAdminUser(userId);
  const { data: activity } = useAdminUserActivity(userId);

  const ban = useBanUser();
  const unban = useUnbanUser();
  const del = useDeleteUser();
  const verify = useSetVerified();
  const setStream = useSetCanStream();
  const removeAvatar = useRemoveAvatar();
  const removeCover = useRemoveCover();

  const [banReason, setBanReason] = useState('');
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const toast = (title: string, message?: string) => showSheet({ title, message, options: [{ label: 'OK' }] });

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleBan = () => {
    if (!banReason.trim()) {
      toast('Reason required', 'Please enter a ban reason.');
      return;
    }
    ban.mutate({ userId, reason: banReason.trim() }, {
      onSuccess: () => {
        setBanModalOpen(false);
        setBanReason('');
        toast('User Banned', `${user?.name} has been banned.`);
      },
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const handleUnban = () => {
    unban.mutate(userId, {
      onSuccess: () => toast('User Unbanned', `${user?.name} can use the app again.`),
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const handleDelete = () => {
    del.mutate(userId, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        toast('User Deleted', `${user?.name} has been removed.`);
        router.back();
      },
      onError: (e: any) => {
        setDeleteConfirmOpen(false);
        toast('Error', e.message);
      },
    });
  };

  const handleVerifyToggle = () => {
    if (!user) return;
    verify.mutate({ userId, verified: !user.isVerified }, {
      onSuccess: () => toast(user.isVerified ? 'Verification Removed' : 'User Verified'),
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const handleStreamToggle = () => {
    if (!user) return;
    setStream.mutate({ userId, canStream: !user.canStream }, {
      onSuccess: () => toast(user.canStream ? 'Streaming Revoked' : 'Streaming Allowed'),
      onError: (e: any) => toast('Error', e.message),
    });
  };

  const handleRemoveAvatar = () => {
    showSheet({
      title: 'Remove Avatar?',
      message: 'Reset to default avatar?',
      options: [
        {
          label: 'Remove', destructive: true, onPress: () => removeAvatar.mutate(userId, {
            onSuccess: () => toast('Avatar Removed'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        { label: 'Cancel' },
      ],
    });
  };

  const handleRemoveCover = () => {
    showSheet({
      title: 'Remove Cover?',
      message: 'Remove this user\'s cover photo?',
      options: [
        {
          label: 'Remove', destructive: true, onPress: () => removeCover.mutate(userId, {
            onSuccess: () => toast('Cover Removed'),
            onError: (e: any) => toast('Error', e.message),
          }),
        },
        { label: 'Cancel' },
      ],
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading || !user) {
    return (
      <View style={s.container}>
        <SafeAreaView edges={['top']}>
          <Header onBack={() => router.back()} title="User Detail" />
        </SafeAreaView>
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <Header onBack={() => router.back()} title="User Detail" />
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover preview */}
        <View style={s.coverWrap}>
          {user.cover ? (
            <Image source={{ uri: user.cover }} style={s.cover} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#5A1530', '#2A0A14']} style={s.cover} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          <View style={s.coverDark} />
          {user.cover && (
            <TouchableOpacity style={s.coverRemoveBtn} onPress={handleRemoveCover}>
              <Ionicons name="trash-outline" size={12} color="#fff" />
              <Text style={s.coverRemoveText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile heading */}
        <View style={s.profileSection}>
          <TouchableOpacity onPress={handleRemoveAvatar} activeOpacity={0.85} style={s.avatarOverlap}>
            <Image source={{ uri: user.avatar }} style={s.avatar} contentFit="cover" />
            <View style={s.avatarTrash}>
              <Ionicons name="trash-outline" size={11} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={s.nameRow}>
            <Text style={s.name}>{user.name}</Text>
            {user.isVerified && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
            {user.isOnline && <View style={s.onlineDot} />}
          </View>

          <Text style={s.subInfo}>
            {user.age} yrs{user.location ? ` · ${user.location}` : ''}{user.occupation ? ` · ${user.occupation}` : ''}
          </Text>

          {user.bio ? <Text style={s.bio}>{user.bio}</Text> : null}

          {user.isBanned && (
            <View style={s.banBanner}>
              <Ionicons name="ban" size={16} color="#FF453A" />
              <View style={{ flex: 1 }}>
                <Text style={s.banTitle}>Account Banned</Text>
                {user.bannedReason && <Text style={s.banReason}>{user.bannedReason}</Text>}
              </View>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <Stat label="Followers" value={user.followers} />
          <Stat label="Following" value={user.following} />
          <Stat label="Posts" value={activity?.posts.length ?? 0} />
          <Stat label="Coins" value={user.coins} />
        </View>

        {/* Actions */}
        <Text style={s.sectionLabel}>MODERATION</Text>
        <View style={s.actions}>
          {user.isBanned ? (
            <ActionRow
              icon="checkmark-circle-outline"
              label="Unban User"
              color="#34C759"
              loading={unban.isPending}
              onPress={handleUnban}
            />
          ) : (
            <ActionRow
              icon="ban-outline"
              label="Ban User"
              color="#FF9F0A"
              onPress={() => setBanModalOpen(true)}
            />
          )}
          <ActionRow
            icon={user.isVerified ? 'shield-checkmark' : 'shield-outline'}
            label={user.isVerified ? 'Remove Verification' : 'Verify User'}
            color={user.isVerified ? Colors.textMuted : '#0A84FF'}
            loading={verify.isPending}
            onPress={handleVerifyToggle}
          />
          <ActionRow
            icon={user.canStream ? 'videocam-off-outline' : 'videocam-outline'}
            label={user.canStream ? 'Revoke Streaming' : 'Allow Streaming'}
            color="#BF5AF2"
            loading={setStream.isPending}
            onPress={handleStreamToggle}
          />
          <ActionRow
            icon="trash-outline"
            label="Delete User"
            color="#FF453A"
            onPress={() => setDeleteConfirmOpen(true)}
          />
        </View>

        {/* Activity */}
        <Text style={s.sectionLabel}>ACTIVITY</Text>
        <View style={s.activityBox}>
          <ActivityRow icon="document-text-outline" label="Total posts" value={activity?.posts.length ?? '—'} />
          <ActivityRow icon="gift-outline" label="Gifts received" value={activity?.totalGiftsReceived ?? '—'} />
          <ActivityRow icon="paper-plane-outline" label="Gifts sent" value={activity?.totalGiftsSent ?? '—'} />
          <ActivityRow icon="cash-outline" label="Recent transactions" value={activity?.recentTransactions.length ?? '—'} />
        </View>
      </ScrollView>

      {/* Ban reason modal */}
      <Modal visible={banModalOpen} transparent animationType="fade" onRequestClose={() => setBanModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.banModal}>
            <View style={s.banModalIcon}>
              <Ionicons name="ban" size={28} color="#FF9F0A" />
            </View>
            <Text style={s.banModalTitle}>Ban {user.name}?</Text>
            <Text style={s.banModalText}>Provide a reason. The user will see this when they try to log in.</Text>
            <TextInput
              style={s.banInput}
              placeholder="e.g. Spam, harassment, fake profile..."
              placeholderTextColor={Colors.textMuted}
              value={banReason}
              onChangeText={setBanReason}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setBanModalOpen(false); setBanReason(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleBan} disabled={ban.isPending}>
                {ban.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.modalConfirmText}>Ban User</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={deleteConfirmOpen}
        title={`Delete ${user.name}?`}
        message="This permanently removes the profile and cannot be undone. All posts, comments, and follows are also removed."
        destructive
        loading={del.isPending}
        confirmLabel="Delete Permanently"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.backBtn}>
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ActionRow({ icon, label, color, onPress, loading }: { icon: IoniconName; label: string; color: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.7} disabled={loading}>
      <View style={[s.actionIconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.actionLabel, { color }]}>{label}</Text>
      {loading
        ? <ActivityIndicator color={color} size="small" />
        : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

function ActivityRow({ icon, label, value }: { icon: IoniconName; label: string; value: number | string }) {
  return (
    <View style={s.activityRow}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} />
      <Text style={s.activityLabel}>{label}</Text>
      <Text style={s.activityValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },

  scroll: { paddingBottom: 30 },

  coverWrap: { height: 110, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverDark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  coverRemoveBtn: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  coverRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  profileSection: { alignItems: 'center', paddingHorizontal: 20, marginTop: -42, gap: 6 },
  avatarOverlap: { borderWidth: 4, borderColor: Colors.background, borderRadius: 50, position: 'relative' },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#222' },
  avatarTrash: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.background },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  onlineDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#34C759' },
  subInfo: { color: Colors.textMuted, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  bio: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 },

  banBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,69,58,0.10)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.30)', width: '100%' },
  banTitle: { color: '#FF453A', fontSize: 13, fontWeight: '800' },
  banReason: { color: '#ff8780', fontSize: 12, marginTop: 2 },

  statsGrid: { flexDirection: 'row', marginHorizontal: 16, marginTop: 18, marginBottom: 8, gap: 8 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  statValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 3, letterSpacing: 0.8 },

  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },

  actions: { marginHorizontal: 16, gap: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  actionIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '700' },

  activityBox: { marginHorizontal: 16, padding: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder, gap: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityLabel: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  activityValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },

  // Ban modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  banModal: { width: '100%', backgroundColor: Colors.card, borderRadius: 22, padding: 22, gap: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  banModalIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,159,10,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  banModalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  banModalText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 4 },
  banInput: { width: '100%', minHeight: 80, maxHeight: 140, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14, marginTop: 6, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' },
  modalCancel: { flex: 1, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  modalConfirm: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#FF9F0A', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
