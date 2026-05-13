import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService, UserListParams } from '@/services/adminService';

const PAGE_SIZE = 30;

// ─── Users list with infinite scroll + search/filter ─────────────────────────
export function useAdminUsers(filters: Omit<UserListParams, 'limit' | 'offset'>) {
  return useInfiniteQuery({
    queryKey: ['adminUsers', filters],
    queryFn: async ({ pageParam = 0 }) => {
      return adminService.getAllUsers({ ...filters, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.users.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 30_000,
  });
}

// ─── Single user detail ─────────────────────────────────────────────────────
export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ['adminUser', id],
    queryFn: () => adminService.getUserById(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ─── User activity ──────────────────────────────────────────────────────────
export function useAdminUserActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['adminUserActivity', id],
    queryFn: () => adminService.getUserActivity(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────
function invalidateUser(qc: ReturnType<typeof useQueryClient>, userId: string) {
  qc.invalidateQueries({ queryKey: ['adminUsers'] });
  qc.invalidateQueries({ queryKey: ['adminUser', userId] });
}

export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminService.banUser(userId, reason),
    onSuccess: (_, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.unbanUser(userId),
    onSuccess: (_, userId) => invalidateUser(qc, userId),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  });
}

export function useSetVerified() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, verified }: { userId: string; verified: boolean }) =>
      adminService.setVerified(userId, verified),
    onSuccess: (_, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useSetCanStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, canStream }: { userId: string; canStream: boolean }) =>
      adminService.setCanStream(userId, canStream),
    onSuccess: (_, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useUpdateUserProfileAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: any }) =>
      adminService.updateUserProfile(userId, updates),
    onSuccess: (_, vars) => invalidateUser(qc, vars.userId),
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.removeAvatar(userId),
    onSuccess: (_, userId) => invalidateUser(qc, userId),
  });
}

export function useRemoveCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminService.removeCover(userId),
    onSuccess: (_, userId) => invalidateUser(qc, userId),
  });
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export type AdminPostFilter = 'all' | 'photo' | 'video' | 'pinned' | 'hidden';

export function useAdminPosts(filters: { search?: string; filter?: AdminPostFilter }) {
  return useInfiniteQuery({
    queryKey: ['adminPosts', filters],
    queryFn: ({ pageParam = 0 }) =>
      adminService.getAllPosts({ ...filters, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.posts.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 30_000,
  });
}

export function useAdminPostComments(postId: string | undefined) {
  return useQuery({
    queryKey: ['adminPostComments', postId],
    queryFn: () => adminService.getPostComments(postId!),
    enabled: !!postId,
    staleTime: 10_000,
  });
}

function invalidatePosts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['adminPosts'] });
  qc.invalidateQueries({ queryKey: ['feed'] });
}

export function useDeletePostAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => adminService.deletePostAsAdmin(postId),
    onSuccess: () => invalidatePosts(qc),
  });
}

export function useUpdatePostCaptionAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, caption }: { postId: string; caption: string }) =>
      adminService.updatePostCaptionAsAdmin(postId, caption),
    onSuccess: () => invalidatePosts(qc),
  });
}

export function useSetPinned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) =>
      adminService.setPinned(postId, pinned),
    onSuccess: () => invalidatePosts(qc),
  });
}

export function useSetHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, hidden }: { postId: string; hidden: boolean }) =>
      adminService.setHidden(postId, hidden),
    onSuccess: () => invalidatePosts(qc),
  });
}

export function useDeleteCommentAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => adminService.deleteCommentAsAdmin(commentId),
    onSuccess: (_, _commentId) => {
      qc.invalidateQueries({ queryKey: ['adminPostComments'] });
      qc.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useUpdateCommentAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      adminService.updateCommentAsAdmin(commentId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminPostComments'] });
      qc.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// ─── Live streams ───────────────────────────────────────────────────────────

export function useAdminStreams() {
  return useQuery({
    queryKey: ['adminStreams'],
    queryFn: () => adminService.getAllActiveStreams(),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useEndStreamAsAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ streamId, hostId, reason }: { streamId: string; hostId: string; reason: string }) =>
      adminService.endStreamAsAdmin(streamId, hostId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminStreams'] });
      qc.invalidateQueries({ queryKey: ['live_streams'] });
    },
  });
}

export function useMuteStreamAudio() {
  return useMutation({
    mutationFn: ({ streamId, hostId }: { streamId: string; hostId: string }) =>
      adminService.muteStreamAudio(streamId, hostId),
  });
}

export function useMuteStreamVideo() {
  return useMutation({
    mutationFn: ({ streamId, hostId }: { streamId: string; hostId: string }) =>
      adminService.muteStreamVideo(streamId, hostId),
  });
}

// ─── Wallet / Economy ───────────────────────────────────────────────────────

export type AdminTxType = 'all' | 'purchase' | 'spend' | 'earn' | 'bonus';

export function useAdminTransactions(filter: AdminTxType) {
  return useInfiniteQuery({
    queryKey: ['adminTransactions', filter],
    queryFn: ({ pageParam = 0 }) =>
      adminService.getAllTransactions({ type: filter, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.transactions.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 15_000,
  });
}

export function useEconomyStats() {
  return useQuery({
    queryKey: ['economyStats'],
    queryFn: () => adminService.getEconomyStats(),
    staleTime: 30_000,
  });
}

function invalidateWallet(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  qc.invalidateQueries({ queryKey: ['adminTransactions'] });
  qc.invalidateQueries({ queryKey: ['economyStats'] });
  if (userId) {
    qc.invalidateQueries({ queryKey: ['adminUser', userId] });
    qc.invalidateQueries({ queryKey: ['adminUserActivity', userId] });
  }
}

export function useGrantCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) =>
      adminService.grantCoins(userId, amount, reason),
    onSuccess: (_, vars) => invalidateWallet(qc, vars.userId),
  });
}

export function useRevokeCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) =>
      adminService.revokeCoins(userId, amount, reason),
    onSuccess: (_, vars) => invalidateWallet(qc, vars.userId),
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

export type AdminReportStatus = 'all' | 'pending' | 'resolved' | 'ignored';

export function useAdminReports(status: AdminReportStatus) {
  return useInfiniteQuery({
    queryKey: ['adminReports', status],
    queryFn: ({ pageParam = 0 }) =>
      adminService.getReports({ status, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.reports.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 15_000,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, action, note }: { reportId: string; action: 'resolved' | 'ignored'; note?: string }) =>
      adminService.resolveReport(reportId, action, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminReports'] }),
  });
}
