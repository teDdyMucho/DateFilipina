import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';

export function useNotifications() {
  const user = useAuthStore(s => s.user);
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.getNotifications(user!.id),
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

export function useUnreadCount() {
  const user = useAuthStore(s => s.user);
  return useQuery({
    queryKey: ['notifications', user?.id, 'unread'],
    queryFn: () => notificationService.getUnreadCount(user!.id),
    enabled: !!user?.id,
    // Poll periodically so the bell badge stays roughly fresh even when the
    // home screen is in view for a long time.
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      qc.invalidateQueries({ queryKey: ['notifications', user?.id, 'unread'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      qc.invalidateQueries({ queryKey: ['notifications', user?.id, 'unread'] });
    },
  });
}

export function useClearAllNotifications() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: () => notificationService.clearAll(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      qc.invalidateQueries({ queryKey: ['notifications', user?.id, 'unread'] });
    },
  });
}
