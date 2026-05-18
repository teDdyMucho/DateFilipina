import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storyService, StoryReactionKey } from '@/services/storyService';
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

export function useStoryReactions(storyId: string | undefined) {
  return useQuery({
    queryKey: ['storyReactions', storyId],
    queryFn: () => storyService.getStoryReactions(storyId!),
    enabled: !!storyId,
    staleTime: 5_000,
  });
}

export function useReactToStory() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: ({ storyId, reaction }: { storyId: string; reaction: StoryReactionKey }) => {
      if (!user?.id) throw new Error('Not signed in');
      return storyService.reactToStory(storyId, user.id, reaction);
    },
    // Optimistic update: toggle this specific reaction in the array
    // immediately so taps feel instant. Multiple reactions per user are
    // allowed; tapping the same one removes only that entry.
    onMutate: async ({ storyId, reaction }) => {
      await qc.cancelQueries({ queryKey: ['storyReactions', storyId] });
      const prev = qc.getQueryData<{ mine: StoryReactionKey[]; all: any[] }>(['storyReactions', storyId]);
      qc.setQueryData(['storyReactions', storyId], (old: any) => {
        const base = old || { mine: [], all: [] };
        const mine: StoryReactionKey[] = base.mine || [];
        const nextMine = mine.includes(reaction)
          ? mine.filter((r: StoryReactionKey) => r !== reaction)
          : [...mine, reaction];
        return { ...base, mine: nextMine };
      });
      return { prev };
    },
    onError: (_err, { storyId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(['storyReactions', storyId], ctx.prev);
    },
    onSettled: (_data, _err, { storyId }) => {
      qc.invalidateQueries({ queryKey: ['storyReactions', storyId] });
    },
  });
}
