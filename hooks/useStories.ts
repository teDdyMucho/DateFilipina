import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storyService } from '@/services/storyService';
import { useAuthStore } from '@/store/authStore';

export function useActiveStories() {
  return useQuery({
    queryKey: ['stories', 'active'],
    queryFn: () => storyService.getActiveStoriesGrouped(),
    staleTime: 30_000,
    // Re-check expiry every minute so a story disappears from the strip
    // shortly after it hits 24h, without requiring a manual refresh.
    refetchInterval: 60_000,
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: async ({ uri, type }: { uri: string; type: 'photo' | 'video' }) => {
      if (!user?.id) throw new Error('Not signed in');
      const url = await storyService.uploadStoryMedia(uri, user.id, type);
      await storyService.createStory(user.id, url, type);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => storyService.deleteStory(storyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}
