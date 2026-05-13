import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import {
  AdminTxType, useAdminTransactions, useEconomyStats,
  useGrantCoins, useRevokeCoins, useAdminUsers,
} from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { StatCard } from '@/components/admin/StatCard';

const FILTERS: { key: AdminTxType; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'purchase', label: 'Purchases' },
  { key: 'spend',    label: 'Spends' },
  { key: 'earn',     label: 'Earnings' },
  { key: 'bonus',    label: 'Bonuses' },
];

export default function AdminWalletScreen() {
  const router = useRouter();
  const showSheet = useSheet();
  const [filter, setFilter] = useState<AdminTxType>('all');
  const [grantOpen, setGrantOpen] = useState<'grant' | 'revoke' | null>(null);

  const { data: stats } = useEconomyStats();
  const {
    data, isLoading, isFetchingNextPage, hasNextPage,
    fetchNextPage, refetch, isRefetching,
  } = useAdminTransactions(filter);

  const txs = useMemo(() => data?.pages.flatMap(p => p.transactions) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Wallet & Economy</Text>
            <Text style={s.subtitle}>{total.toLocaleString()} transactions</Text>
          </View>
        </View>
      </SafeAreaView>

      <FlatList
        data={txs}
        keyExtractor={tx => tx.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View>
            {/* Stat cards */}
            <View style={s.statsGrid}>
              <StatCard icon="diamond-outline" label="Total Coins in Circulation" value={stats?.totalCoins ?? '—'} accent="#FFD700" />
              <StatCard icon="trending-up-outline" label="Coins Moved (24h)" value={stats?.coinsToday ?? '—'} accent="#34C759" />
            </View>

            {/* Quick actions */}
            <View style={s.quickRow}>
              <QuickBtn icon="add-circle-outline" label="Grant Coins" color="#34C759" onPress={() => setGrantOpen('grant')} />
              <QuickBtn icon="remove-circle-outline" label="Revoke Coins" color="#FF9F0A" onPress={() => setGrantOpen('revoke')} />
            </View>

            {/* Filters */}
            <View style={s.filterRow}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.filterPill, active && s.filterPillActive]}
                    onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.filterLabel, active && s.filterLabelActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>RECENT TRANSACTIONS</Text>
          </View>
        }
        renderItem={({ item }) => <TxRow tx={item} onUser={() => router.push({ pathname: '/admin/user/[id]', params: { id: item.user_id } } as any)} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={52} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No transactions</Text>
              <Text style={s.emptyText}>Try a different filter.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading || isFetchingNextPage
            ? <View style={{ padding: 20, alignItems: 'center' }}><ActivityIndicator color={Colors.primary} /></View>
            : null
        }
      />

      <GrantRevokeModal
        mode={grantOpen}
        onClose={() => setGrantOpen(null)}
      />
    </View>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────────────────

function TxRow({ tx, onUser }: { tx: any; onUser: () => void }) {
  const profile = tx.profiles;
  const isPositive = tx.amount > 0;
  const meta = TX_META[tx.type] ?? { icon: 'cash-outline', color: Colors.textMuted, label: tx.type };

  return (
    <TouchableOpacity style={txs.row} onPress={onUser} activeOpacity={0.7}>
      <View style={[txs.iconWrap, { backgroundColor: `${meta.color}22` }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={txs.topRow}>
          <Text style={txs.name} numberOfLines={1}>{profile?.name || 'Unknown'}</Text>
          <Text style={[txs.amount, { color: isPositive ? '#34C759' : '#FF453A' }]}>
            {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
          </Text>
        </View>
        <View style={txs.bottomRow}>
          <Text style={[txs.typeTag, { color: meta.color }]}>{meta.label}</Text>
          {tx.description ? <Text style={txs.desc} numberOfLines={1}>· {tx.description}</Text> : null}
        </View>
        <Text style={txs.time}>{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}</Text>
      </View>
    </TouchableOpacity>
  );
}

const TX_META: Record<string, { icon: string; color: string; label: string }> = {
  purchase: { icon: 'card-outline',     color: '#0A84FF', label: 'PURCHASE' },
  spend:    { icon: 'arrow-up-outline', color: '#FF453A', label: 'SPEND' },
  earn:     { icon: 'gift-outline',     color: '#34C759', label: 'EARN' },
  bonus:    { icon: 'star-outline',     color: '#FFD700', label: 'BONUS' },
};

// ─── Quick action button ─────────────────────────────────────────────────────

function QuickBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.quickBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.quickIconWrap, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Grant / Revoke Modal ────────────────────────────────────────────────────

function GrantRevokeModal({ mode, onClose }: { mode: 'grant' | 'revoke' | null; onClose: () => void }) {
  const visible = !!mode;
  const isGrant = mode === 'grant';
  const [search, setSearch] = useState('');
  const [searchDeb, setSearchDeb] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const showSheet = useSheet();

  const grant = useGrantCoins();
  const revoke = useRevokeCoins();
  const loading = grant.isPending || revoke.isPending;

  React.useEffect(() => {
    const t = setTimeout(() => setSearchDeb(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    if (!visible) {
      setSearch(''); setSearchDeb(''); setSelectedUser(null); setAmount(''); setReason('');
    }
  }, [visible]);

  const { data } = useAdminUsers({ search: searchDeb || undefined });
  const users = useMemo(() => data?.pages.flatMap(p => p.users) ?? [], [data]);

  const toast = (title: string, msg?: string) => showSheet({ title, message: msg, options: [{ label: 'OK' }] });

  const handleConfirm = () => {
    if (!selectedUser) { toast('Pick a user', 'Search and select a user first.'); return; }
    const amt = parseInt(amount);
    if (!amt || amt <= 0) { toast('Invalid amount', 'Enter a positive number.'); return; }
    if (!reason.trim()) { toast('Reason required', 'Add a short reason for the audit log.'); return; }

    const mutation = isGrant ? grant : revoke;
    mutation.mutate({ userId: selectedUser.id, amount: amt, reason: reason.trim() }, {
      onSuccess: () => {
        toast(isGrant ? 'Coins Granted' : 'Coins Revoked', `${amt} coins ${isGrant ? 'added to' : 'removed from'} ${selectedUser.name}.`);
        onClose();
      },
      onError: (e: any) => toast('Error', e.message),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={gm.container}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <View style={gm.header}>
            <TouchableOpacity onPress={onClose} style={gm.backBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={gm.headerTitle}>{isGrant ? 'Grant Coins' : 'Revoke Coins'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={gm.section}>
              <Text style={gm.sectionLabel}>USER</Text>
              {selectedUser ? (
                <TouchableOpacity style={gm.selectedUser} onPress={() => setSelectedUser(null)} activeOpacity={0.75}>
                  <Image source={{ uri: fixAvatarUri(selectedUser.avatar, selectedUser.id) }} style={gm.selUserAvatar} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={gm.selUserName}>{selectedUser.name}</Text>
                    <Text style={gm.selUserBalance}>Current balance: {selectedUser.coins?.toLocaleString() ?? 0} coins</Text>
                  </View>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <>
                  <View style={gm.searchWrap}>
                    <Ionicons name="search" size={15} color={Colors.textMuted} />
                    <TextInput
                      style={gm.searchInput}
                      placeholder="Search by name or email..."
                      placeholderTextColor={Colors.textMuted}
                      value={search}
                      onChangeText={setSearch}
                      autoCapitalize="none"
                    />
                  </View>
                  {search.length > 0 && (
                    <FlatList
                      data={users.slice(0, 8)}
                      keyExtractor={u => u.id}
                      style={gm.userList}
                      ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={gm.userRow} onPress={() => { setSelectedUser(item); setSearch(''); }}>
                          <Image source={{ uri: fixAvatarUri(item.avatar, item.id) }} style={gm.userAvatar} contentFit="cover" />
                          <View style={{ flex: 1 }}>
                            <Text style={gm.userName}>{item.name}</Text>
                            <Text style={gm.userMeta}>{item.coins?.toLocaleString() ?? 0} coins · {item.followers} followers</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                      )}
                      keyboardShouldPersistTaps="handled"
                    />
                  )}
                </>
              )}
            </View>

            <View style={gm.section}>
              <Text style={gm.sectionLabel}>AMOUNT</Text>
              <View style={gm.amountWrap}>
                <Ionicons name="diamond" size={20} color="#FFD700" />
                <TextInput
                  style={gm.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  maxLength={8}
                />
                <Text style={gm.amountSuffix}>coins</Text>
              </View>
            </View>

            <View style={gm.section}>
              <Text style={gm.sectionLabel}>REASON</Text>
              <TextInput
                style={gm.reasonInput}
                placeholder={isGrant ? 'e.g. Bug bounty, contest reward...' : 'e.g. Fraud, refund, policy violation...'}
                placeholderTextColor={Colors.textMuted}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={200}
              />
            </View>

            <View style={gm.confirmWrap}>
              <TouchableOpacity
                style={[gm.confirmBtn, isGrant ? { backgroundColor: '#34C759' } : { backgroundColor: '#FF9F0A' }]}
                onPress={handleConfirm}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name={isGrant ? 'add' : 'remove'} size={18} color="#fff" />
                      <Text style={gm.confirmText}>{isGrant ? 'Grant Coins' : 'Revoke Coins'}</Text>
                    </>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },

  list: { paddingBottom: 32 },
  statsGrid: { paddingHorizontal: 14, gap: 8, marginBottom: 12 },

  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 14 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  quickIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  quickLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },

  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  filterPill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterLabelActive: { color: '#fff' },

  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 8 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});

const txs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 14, padding: 12, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  amount: { fontSize: 14, fontWeight: '900' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  typeTag: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  desc: { color: Colors.textSecondary, fontSize: 11, flexShrink: 1 },
  time: { color: Colors.textMuted, fontSize: 10, marginTop: 3 },
});

const gm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center' },

  section: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },
  userList: { maxHeight: 220 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  userName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  userMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  selectedUser: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(214,26,78,0.10)', borderWidth: 1, borderColor: 'rgba(214,26,78,0.30)' },
  selUserAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#222' },
  selUserName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  selUserBalance: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)' },
  amountInput: { flex: 1, color: Colors.textPrimary, fontSize: 18, fontWeight: '800', padding: 0 },
  amountSuffix: { color: '#FFD700', fontSize: 12, fontWeight: '700' },

  reasonInput: { minHeight: 80, maxHeight: 140, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },

  confirmWrap: { padding: 16, marginTop: 4 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: 14 },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
