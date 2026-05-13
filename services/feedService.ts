import { supabase } from './supabase';
import { FeedPost } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';

export const feedService = {
  async getFeed(userId: string): Promise<FeedPost[]> {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        caption,
        media_urls,
        media_type,
        likes_count,
        comments_count,
        created_at,
        shared_from_user_id,
        shared_from_user_name,
        shared_from_user_avatar,
        profiles!posts_user_id_fkey (id, name, avatar_url, is_online, is_verified)
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    if (!data) return [];

    const postIds = data.map((p: any) => p.id);
    let likedSet = new Set<string>();
    if (postIds.length > 0) {
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);
      if (likes) likes.forEach((l: any) => likedSet.add(l.post_id));
    }

    return data.map((row: any) => ({
      id: row.id,
      user: {
        id: row.profiles.id,
        name: row.profiles.name,
        avatar: fixAvatarUri(row.profiles.avatar_url, row.profiles.id),
        isOnline: row.profiles.is_online || false,
        isVerified: row.profiles.is_verified || false,
      },
      imageUrl: row.media_urls?.[0] || '',
      mediaUrls: row.media_urls || [],
      mediaType: row.media_type || 'photo',
      caption: row.caption || '',
      likes: row.likes_count || 0,
      comments: row.comments_count || 0,
      isLiked: likedSet.has(row.id),
      timestamp: new Date(row.created_at),
      sharedFrom: row.shared_from_user_id ? {
        userId: row.shared_from_user_id,
        userName: row.shared_from_user_name || 'Unknown',
        userAvatar: fixAvatarUri(row.shared_from_user_avatar, row.shared_from_user_id),
      } : undefined,
    }));
  },

  async toggleLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    }
  },

  async uploadMedia(uri: string, userId: string, mediaType: 'photo' | 'video'): Promise<string> {
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const path = `posts/${userId}/${fileName}`;
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

    // FormData upload — works with local file:// URIs on React Native
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: contentType,
    } as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/media/${path}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Upload failed: ${body}`);
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  },

  async createPost(userId: string, mediaUrl: string, mediaType: 'photo' | 'video', caption: string): Promise<void> {
    const { error } = await supabase.from('posts').insert({
      user_id: userId,
      caption,
      media_urls: mediaUrl ? [mediaUrl] : [],
      media_type: mediaType,
    });
    if (error) throw new Error(error.message);
  },

  async sharePostToFeed(
    sharerId: string,
    original: { userId: string; userName: string; userAvatar: string; caption: string; imageUrl: string; mediaType: string }
  ): Promise<void> {
    const { error } = await supabase.from('posts').insert({
      user_id: sharerId,
      caption: original.caption,
      media_urls: original.imageUrl ? [original.imageUrl] : [],
      media_type: original.mediaType || 'photo',
      shared_from_user_id: original.userId,
      shared_from_user_name: original.userName,
      shared_from_user_avatar: original.userAvatar,
    });
    if (error) throw new Error(error.message);
  },

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
  },

  async updatePostCaption(postId: string, caption: string): Promise<void> {
    const { error } = await supabase.from('posts').update({ caption }).eq('id', postId);
    if (error) throw new Error(error.message);
  },

  async getComments(postId: string) {
    const { data, error } = await supabase
      .from('post_comments')
      .select('id, content, created_at, profiles!post_comments_user_id_fkey (id, name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      id: r.id,
      content: r.content,
      createdAt: new Date(r.created_at),
      user: {
        id: r.profiles.id,
        name: r.profiles.name,
        avatar: fixAvatarUri(r.profiles.avatar_url, r.profiles.id),
      },
    }));
  },

  async addComment(postId: string, userId: string, content: string) {
    const { error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, content });
    if (error) throw new Error(error.message);
  },
};
