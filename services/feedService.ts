import { supabase } from './supabase';
import { FeedPost } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';

// Facebook-style post reactions. Each user has at most one reaction per post.
// 'love' is the default (a plain tap on the heart icon).
export type PostReactionKey = 'love' | 'wow' | 'hot' | 'sexy' | 'sad' | 'angry';

export const POST_REACTIONS: ReadonlyArray<{
  key: PostReactionKey;
  icon: string;     // MaterialCommunityIcons name
  color: string;    // tint / bg color for the icon bubble
  emoji: string;    // textual fallback (notifications etc.)
  label: string;
}> = [
  { key: 'love',  icon: 'heart',             color: '#FF3D6E', emoji: '❤️', label: 'Love' },
  { key: 'wow',   icon: 'emoticon-excited',  color: '#FFB400', emoji: '😮', label: 'Wow' },
  { key: 'hot',   icon: 'fire',              color: '#FF6B35', emoji: '🔥', label: 'Hot' },
  { key: 'sexy',  icon: 'emoticon-kiss',     color: '#FF1493', emoji: '🥵', label: 'Sexy' },
  { key: 'sad',   icon: 'emoticon-sad',      color: '#5E9EFF', emoji: '😢', label: 'Sad' },
  { key: 'angry', icon: 'emoticon-angry',    color: '#FF3B30', emoji: '😡', label: 'Angry' },
];

export const feedService = {
  async getFeed(userId: string): Promise<FeedPost[]> {
    // Admin-hidden posts are filtered out; pinned posts surface first.
    // Wrap in try/catch so the feed still works if the is_hidden / is_pinned
    // columns haven't been migrated yet.
    let data: any[] | null = null;
    let error: any = null;
    try {
      const res = await supabase
        .from('posts')
        .select(`
          id,
          caption,
          media_urls,
          media_type,
          likes_count,
          comments_count,
          is_pinned,
          is_hidden,
          created_at,
          shared_from_user_id,
          shared_from_user_name,
          shared_from_user_avatar,
          profiles!posts_user_id_fkey (id, name, avatar_url, is_online, is_verified)
        `)
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      data = res.data;
      error = res.error;
    } catch (e: any) {
      error = e;
    }
    if (error && /is_pinned|is_hidden/i.test(error.message || '')) {
      // Fallback for projects that haven't applied the admin migration yet
      const fallback = await supabase
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
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw new Error(error.message);
    if (!data) return [];

    const postIds = data.map((p: any) => p.id);
    // Fetch the user's reactions for these posts (post_id → reaction key).
    // Falls back to a tolerant select that ignores missing `reaction` column.
    const myReactions = new Map<string, PostReactionKey>();
    if (postIds.length > 0) {
      let likes: any[] | null = null;
      const tryFull = await supabase
        .from('post_likes')
        .select('post_id, reaction')
        .eq('user_id', userId)
        .in('post_id', postIds);
      if (tryFull.error && /reaction/i.test(tryFull.error.message || '')) {
        const fallback = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds);
        likes = fallback.data;
      } else {
        likes = tryFull.data;
      }
      if (likes) {
        likes.forEach((l: any) => {
          const r = (l.reaction as PostReactionKey) || 'love';
          myReactions.set(l.post_id, r);
        });
      }
    }

    // Shuffle non-pinned posts so the home feed feels fresh on each refresh.
    // Pinned posts stay at the top (their order is preserved among themselves).
    const pinned = data.filter((r: any) => r.is_pinned);
    const rest = data.filter((r: any) => !r.is_pinned);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const ordered = [...pinned, ...rest];

    return ordered.map((row: any) => {
      const urls: string[] = row.media_urls || [];
      const explicitTypes: string[] | undefined = row.media_types && row.media_types.length === urls.length ? row.media_types : undefined;
      const fallbackType = row.media_type || 'photo';
      // Detect video by file extension as a robust fallback — needed when the
      // media_types column hasn't been migrated yet (legacy single media_type
      // column only stores the FIRST item's type, so mixed posts mis-detect).
      const isVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm|3gp|mkv)(\?|$)/i.test(u || '');
      const types: Array<'photo' | 'video'> = urls.map((u, i) => {
        if (explicitTypes) return explicitTypes[i] as any;
        if (isVideoUrl(u)) return 'video';
        return fallbackType;
      });
      return {
      id: row.id,
      user: {
        id: row.profiles.id,
        name: row.profiles.name,
        avatar: fixAvatarUri(row.profiles.avatar_url, row.profiles.id),
        isOnline: row.profiles.is_online || false,
        isVerified: row.profiles.is_verified || false,
      },
      imageUrl: urls[0] || '',
      mediaUrls: urls,
      mediaTypes: types,
      mediaType: fallbackType,
      caption: row.caption || '',
      likes: row.likes_count || 0,
      comments: row.comments_count || 0,
      isLiked: myReactions.has(row.id),
      myReaction: myReactions.get(row.id) ?? null,
      timestamp: new Date(row.created_at),
      sharedFrom: row.shared_from_user_id ? {
        userId: row.shared_from_user_id,
        userName: row.shared_from_user_name || 'Unknown',
        userAvatar: fixAvatarUri(row.shared_from_user_avatar, row.shared_from_user_id),
      } : undefined,
      };
    });
  },

  // Returns the list of users who liked a post (most-recent first).
  async getPostLikers(postId: string): Promise<Array<{ id: string; name: string; avatar: string; isOnline: boolean; isVerified: boolean; likedAt: Date }>> {
    const { data, error } = await supabase
      .from('post_likes')
      .select(`
        created_at,
        profiles!post_likes_user_id_fkey ( id, name, avatar_url, is_online, is_verified )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) return [];
    return data
      .filter((r: any) => r.profiles)
      .map((r: any) => ({
        id: r.profiles.id,
        name: r.profiles.name || 'User',
        avatar: fixAvatarUri(r.profiles.avatar_url, r.profiles.id),
        isOnline: !!r.profiles.is_online,
        isVerified: !!r.profiles.is_verified,
        likedAt: new Date(r.created_at),
      }));
  },

  // Set or change the current user's reaction on a post. Pass null to remove.
  // Falls back to plain like/unlike if the `reaction` column hasn't been
  // migrated yet, so the app keeps working pre-migration.
  async reactToPost(postId: string, userId: string, reaction: PostReactionKey | null): Promise<void> {
    if (reaction === null) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
      return;
    }
    // Check if row exists — update vs insert
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing?.id) {
      const res = await supabase
        .from('post_likes')
        .update({ reaction })
        .eq('id', existing.id);
      if (res.error && /reaction/i.test(res.error.message || '')) {
        // Column missing — nothing to update, the row already exists
        return;
      }
      if (res.error) throw new Error(res.error.message);
      return;
    }
    let res = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId, reaction });
    if (res.error && /reaction/i.test(res.error.message || '')) {
      // Column missing — insert without reaction (legacy schema)
      res = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    }
    if (res.error) throw new Error(res.error.message);
  },

  // Backwards-compat shim — used elsewhere in the codebase. A plain tap on
  // the heart now toggles between no-reaction and 'love'.
  async toggleLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
    return this.reactToPost(postId, userId, isLiked ? null : 'love');
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
      body: formData as any,
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

  // Multi-media post: photos + videos mixed, in order.
  // media_type stores the type of the FIRST item (legacy column),
  // media_types stores the full array (new column).
  async createPostMulti(userId: string, urls: string[], types: Array<'photo' | 'video'>, caption: string): Promise<void> {
    const payload: any = {
      user_id: userId,
      caption,
      media_urls: urls,
      media_type: types[0] || 'photo',
    };
    // Try with media_types array. If column doesn't exist (older DB), fall back.
    let res = await supabase.from('posts').insert({ ...payload, media_types: types });
    if (res.error && /media_types/i.test(res.error.message)) {
      res = await supabase.from('posts').insert(payload);
    }
    if (res.error) throw new Error(res.error.message);
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
