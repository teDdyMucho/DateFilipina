import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import * as Haptics from 'expo-haptics';

export function useUpdateProfile() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (updates: Parameters<typeof profileService.updateProfile>[1]) =>
      profileService.updateProfile(user!.id, updates),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      qc.invalidateQueries({ queryKey: ['profile', user!.id] });
    },
  });
}

export function useUserPosts(userId: string) {
  return useQuery({
    queryKey: ['posts', userId],
    queryFn: () => profileService.getUserPosts(userId),
    staleTime: 30000,
  });
}

export function useFriendsForStories() {
  const myId = useAuthStore(s => s.user?.id);
  return useQuery({
    queryKey: ['friendsForStories', myId],
    queryFn: () => profileService.getFriendsForStories(myId!, 20),
    enabled: !!myId,
    staleTime: 60_000,
  });
}

export function useFollowStatus(myId: string, targetId: string) {
  return useQuery({
    queryKey: ['followStatus', myId, targetId],
    queryFn: () => profileService.getFollowStatus(myId, targetId),
    enabled: !!myId && !!targetId && myId !== targetId,
    staleTime: 30_000,
  });
}

export function useToggleFollow(myId: string, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isFollowing: boolean) =>
      isFollowing
        ? profileService.unfollowUser(myId, targetId)
        : profileService.followUser(myId, targetId),
    onMutate: async (isFollowing) => {
      const key = ['followStatus', myId, targetId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData<boolean>(key, !isFollowing);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['followStatus', myId, targetId], ctx?.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['followStatus', myId, targetId] });
      qc.invalidateQueries({ queryKey: ['profile', targetId] });
      qc.invalidateQueries({ queryKey: ['profile', myId] });
    },
    onSuccess: (_, isFollowing) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
}

export function useRefreshProfile() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();

  return async () => {
    if (!user) return;
    const fresh = await profileService.getProfile(user.id);
    setUser(fresh);
    qc.invalidateQueries({ queryKey: ['profile', user.id] });
  };
}
