import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '@/constants/colors';
import { AdminReportStatus, useAdminReports, useResolveReport } from '@/hooks/useAdmin';
import { useSheet } from '@/components/GlobalActionSheet';
import { fixAvatarUri } from '@/constants/avatarUtils';

const FILTERS: { key: AdminReportStatus; label: string; color: string }[] = [
  { key: 'all',      label: 'All',      color: Colors.textMuted },
  { key: 'pending',  label: 'Pending',  color: '#FF9F0A' },
  { key: 'resolved', label: 'Resolved', color: '#34C759' },
  { key: 'ignored',  label: 'Ignored',  color: Colors.textMuted },
];

const TARGET_META: Record<string, { icon: any; color: string; label: string }> = {
  user:    { icon: 'person-outline',         color: '#0A84FF', label: 'USER' },
  post:    { icon: 'document-text-outline',  color: '#34C759', label: 'POST' },
  stream:  { icon: 'videocam-outline',       color: '#FF453A', label: 'STREAM' },
  comment: { icon: 'chatbubble-outline',     color: '#BF5AF2', label: 'COMMENT' },
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const showSheet = useSheet();
  const [status, setStatus] = useState<AdminReportStatus>('pending');

  const {
    data, isLoading, isFetchingNextPage, hasNextPage,
    fetchNextPage, refetch, isRefetching,
  } = useAdminReports(status);

  const resolve = useResolveReport();

  const reports = useMemo(() => data?.pages.flatMap(p => p.reports) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const toast = (title: string, msg?: string) =>
    showSheet({ title, message: msg, options: [{ label: 'OK' }] });

  const openActions = (report: any) => {
    Haptics.selectionAsync();
    const isPending = report.status === 'pending';
    const target = TARGET_META[report.target_type];
    showSheet({
      title: 'Report Actions',
      message: report.reason,
      options: [
        // Jump to target
        ...(report.target_type === 'user' ? [{
          label: 'View Reported User',
          onPress: () => router.push({ pathname: '/admin/user/[id]', params: { id: report.target_id } } as any),
        }] : []),
        ...(report.target_type === 'post' ? [{
          label: 'View Reported Post',
          onPress: () => router.push('/admin/posts'),
        }] : []),
        ...(report.target_type === 'stream' ? [{
          label: 'View Stream',
          onPress: () => router.push({ pathname: '/admin/watch/[id]', params: { id: report.target_id } } as any),
        }] : []),
        // Reporter shortcut
        {
          label: `View Reporter (${report.reporter?.name || 'Unknown'})`,
          onPress: () => router.push({ pathname: '/admin/user/[id]', params: { id: report.reporter?.id } } as any),
        },
        // Resolution
        ...(isPending ? [
          {
            label: 'Mark Resolved',
            onPress: () => resolve.mutate({ reportId: report.id, action: 'resolved' }, {
              onSuccess: () => toast('Report Resolved'),
              onError: (e: any) => toast('Error', e.message),
            }),
          },
          {
            label: 'Mark Ignored',
            destructive: true,
            onPress: () => resolve.mutate({ reportId: report.id, action: 'ignored' }, {
              onSuccess: () => toast('Report Ignored'),
              onError: (e: any) => toast('Error', e.message),
            }),
          },
        ] : []),
        { label: 'Cancel' },
      ],
    });
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Reports</Text>
            <Text style={s.subtitle}>{total.toLocaleString()} reports</Text>
          </View>
        </View>

        <View style={s.filterRow}>
          {FILTERS.map(f => {
            const active = status === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.filterPill, active && s.filterPillActive]}
                onPress={() => { Haptics.selectionAsync(); setStatus(f.key); }}
                activeOpacity={0.75}
              >
                <Text style={[s.filterLabel, active && s.filterLabelActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <ReportRow report={item} onPress={() => openActions(item)} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="flag-outline" size={52} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No reports</Text>
              <Text style={s.emptyText}>
                {status === 'pending' ? 'No pending reports — you\'re all caught up!' : 'Try a different filter.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage
              ? <View style={{ padding: 20, alignItems: 'center' }}><ActivityIndicator color={Colors.primary} /></View>
              : null
          }
        />
      )}
    </View>
  );
}

function ReportRow({ report, onPress }: { report: any; onPress: () => void }) {
  const target = TARGET_META[report.target_type] ?? TARGET_META.post;
  const isPending = report.status === 'pending';
  const isResolved = report.status === 'resolved';
  const reporter = report.reporter;

  return (
    <TouchableOpacity style={r.card} onPress={onPress} activeOpacity={0.75}>
      {/* Header row: target type tag + status */}
      <View style={r.topRow}>
        <View style={[r.tag, { backgroundColor: `${target.color}22`, borderColor: `${target.color}44` }]}>
          <Ionicons name={target.icon} size={11} color={target.color} />
          <Text style={[r.tagText, { color: target.color }]}>{target.label}</Text>
        </View>
        <View style={[
          r.statusPill,
          isPending && r.statusPending,
          isResolved && r.statusResolved,
          !isPending && !isResolved && r.statusIgnored,
        ]}>
          <Text style={r.statusText}>{report.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Reason */}
      <Text style={r.reason} numberOfLines={3}>{report.reason}</Text>

      {/* Reporter + time */}
      <View style={r.bottomRow}>
        {reporter && (
          <View style={r.reporterWrap}>
            <Image source={{ uri: fixAvatarUri(reporter.avatar_url, reporter.id) }} style={r.reporterAvatar} contentFit="cover" />
            <Text style={r.reporterName} numberOfLines={1}>
              by <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{reporter.name || 'Unknown'}</Text>
            </Text>
          </View>
        )}
        <Text style={r.time}>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },

  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  filterPill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: '#fff' },

  list: { padding: 14, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});

const r = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.glassBorder, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  tagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPending: { backgroundColor: '#FF9F0A' },
  statusResolved: { backgroundColor: '#34C759' },
  statusIgnored: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  reason: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reporterWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  reporterAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#222' },
  reporterName: { color: Colors.textMuted, fontSize: 12, flexShrink: 1 },
  time: { color: Colors.textMuted, fontSize: 11 },
});
