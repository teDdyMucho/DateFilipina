import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedService } from '@/services/feedService';
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

export function useLikePost() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      feedService.toggleLike(postId, user!.id, isLiked),
    onMutate: async ({ postId, isLiked }) => {
      const key = ['feed', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FeedPost[]>(key);
      qc.setQueryData<FeedPost[]>(key, posts =>
        posts?.map(p => p.id === postId
          ? { ...p, isLiked: !isLiked, likes: isLiked ? p.likes - 1 : p.likes + 1 }
          : p
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['feed', user?.id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['feed', user?.id] });
    },
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
    mutationFn: async ({ uri, mediaType, caption }: { uri: string | null; mediaType: 'photo' | 'video'; caption: string }) => {
      let mediaUrl = '';
      if (uri) {
        mediaUrl = await feedService.uploadMedia(uri, user!.id, mediaType);
      }
      await feedService.createPost(user!.id, mediaUrl, mediaType, caption);
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
