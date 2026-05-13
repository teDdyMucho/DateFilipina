import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAdminUsers } from '@/hooks/useAdmin';
import { UserRow } from '@/components/admin/UserRow';

type BannedFilter = 'all' | 'active' | 'banned';
type VerifiedFilter = 'all' | 'verified' | 'unverified';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [bannedFilter, setBannedFilter] = useState<BannedFilter>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(() => ({
    search: searchDebounced || undefined,
    banned: bannedFilter,
    verified: verifiedFilter,
  }), [searchDebounced, bannedFilter, verifiedFilter]);

  const {
    data, isLoading, isFetchingNextPage, hasNextPage,
    fetchNextPage, refetch, isRefetching,
  } = useAdminUsers(filters);

  const users = useMemo(() => data?.pages.flatMap(p => p.users) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Users</Text>
            <Text style={s.subtitle}>{total.toLocaleString()} total</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter pills */}
        <View style={s.filtersRow}>
          <FilterPill
            label="Status"
            value={bannedFilter === 'all' ? 'All' : bannedFilter === 'banned' ? 'Banned' : 'Active'}
            onPress={() => {
              Haptics.selectionAsync();
              setBannedFilter(f => f === 'all' ? 'active' : f === 'active' ? 'banned' : 'all');
            }}
          />
          <FilterPill
            label="Verified"
            value={verifiedFilter === 'all' ? 'All' : verifiedFilter === 'verified' ? 'Verified' : 'Unverified'}
            onPress={() => {
              Haptics.selectionAsync();
              setVerifiedFilter(f => f === 'all' ? 'verified' : f === 'verified' ? 'unverified' : 'all');
            }}
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: item.id } } as any)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={52} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No users match</Text>
              <Text style={s.emptyText}>Try a different search or clear the filters.</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function FilterPill({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const active = value !== 'All';
  return (
    <TouchableOpacity style={[s.filterPill, active && s.filterPillActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}:</Text>
      <Text style={[s.filterValue, active && s.filterValueActive]}>{value}</Text>
      <Ionicons name="chevron-down" size={11} color={active ? Colors.primary : Colors.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, padding: 0 },

  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: 'rgba(214,26,78,0.12)', borderColor: 'rgba(214,26,78,0.4)' },
  filterLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  filterLabelActive: { color: Colors.primary },
  filterValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  filterValueActive: { color: Colors.primary },

  list: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
});
