import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedService, PostReactionKey } from '@/services/feedService';
import { useAuthStore } from '@/store/authStore';
import { FeedPost } from '@/constants/types';

export function useFeed() {
  const user = useAuthStore(s => s.user);
  return useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => feedService.getFeed(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

// Fetches the list of users who liked a specific post. Used by LikersModal.
export function usePostLikers(postId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['postLikers', postId],
    queryFn: () => feedService.getPostLikers(postId!),
    enabled: !!postId && enabled,
    staleTime: 10_000,
  });
}

// Apply a post reaction. `reaction = null` removes the current user's
// reaction. Otherwise sets/changes it (love/wow/hot/sexy/sad/angry).
// The simpler legacy useLikePost interface (boolean isLiked) still works
// via the toggleLike shim in feedService.
export function useLikePost() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: ({ postId, reaction }: { postId: string; reaction: PostReactionKey | null }) =>
      feedService.reactToPost(postId, user!.id, reaction),
    onMutate: async ({ postId, reaction }) => {
      const key = ['feed', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedPost[]>(key);
      qc.setQueryData<FeedPost[]>(key, posts =>
        posts?.map(p => {
          if (p.id !== postId) return p;
          const wasLiked = p.isLiked;
          const willBeLiked = reaction !== null;
          // Count goes up only when going from no-reaction → some reaction
          const delta = (willBeLiked ? 1 : 0) - (wasLiked ? 1 : 0);
          return {
            ...p,
            isLiked: willBeLiked,
            myReaction: reaction,
            likes: Math.max(0, p.likes + delta),
          };
        })
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['feed', user?.id], ctx.prev);
    },
    // No onSettled invalidate — the optimistic update is already accurate,
    // and refetching causes feedService.getFeed to re-shuffle non-pinned
    // posts (intentional on pull-to-refresh, but jarring after a tap).
  });
}

export function useShareToFeed() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: (original: { userId: string; userName: string; userAvatar: string; caption: string; imageUrl: string; mediaType: string }) =>
      feedService.sharePostToFeed(user!.id, original),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
      qc.invalidateQueries({ queryKey: ['userPosts', user?.id] });
    },
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: async ({ media, caption }: { media: Array<{ uri: string; type: 'photo' | 'video' }>; caption: string }) => {
      // Upload each item in parallel
      const urls = await Promise.all(media.map(m => feedService.uploadMedia(m.uri, user!.id, m.type)));
      const types = media.map(m => m.type);
      await feedService.createPostMulti(user!.id, urls, types, caption);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  return useMutation({
    mutationFn: ({ postId, caption }: { postId: string; caption: string }) =>
      feedService.updatePostCaption(postId, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
      qc.invalidateQueries({ queryKey: ['posts', user?.id] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: (postId: string) => feedService.deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
      qc.invalidateQueries({ queryKey: ['posts', user?.id] });
    },
  });
}

export function useComments(postId: string) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => feedService.getComments(postId),
    enabled: !!postId,
    staleTime: 0,
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: (content: string) => feedService.addComment(postId, user!.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
    },
  });
}
