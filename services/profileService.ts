import { supabase } from './supabase';
import { User } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';

function dbToUser(p: any): User {
  return {
    id: p.id,
    name: p.name || 'User',
    age: p.age || 18,
    location: p.location || '',
    bio: p.bio || '',
    avatar: fixAvatarUri(p.avatar_url, p.id),
    cover: p.cover_url || undefined,
    photos: p.photos || [],
    isOnline: p.is_online || false,
    isLive: p.is_live || false,
    isVerified: p.is_verified || false,
    coins: p.coins || 0,
    followers: p.followers_count || 0,
    following: p.following_count || 0,
    likes: p.likes_count || 0,
    interests: p.interests || [],
    occupation: p.occupation || '',
  };
}

export const profileService = {
  async getProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw new Error(error.message);
    return dbToUser(data);
  },

  async uploadAvatar(userId: string, localUri: string): Promise<string> {
    const ext = (localUri.split('.').pop() || 'jpg').toLowerCase().replace(/\?.*$/, '');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const contentType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileName = `${userId}.${safeExt}`;
    const path = `avatars/${fileName}`;

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: fileName,
      type: contentType,
    } as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${path}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Avatar upload failed: ${body}`);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  },

  async updateProfile(userId: string, updates: {
    name?: string;
    bio?: string;
    location?: string;
    occupation?: string;
    age?: number;
    interests?: string[];
    avatar_url?: string;
    cover_url?: string;
  }): Promise<User> {
    // Upload local file URIs first
    if (updates.avatar_url && updates.avatar_url.startsWith('file://')) {
      updates.avatar_url = await profileService.uploadAvatar(userId, updates.avatar_url);
    }
    if (updates.cover_url && updates.cover_url.startsWith('file://')) {
      updates.cover_url = await profileService.uploadCover(userId, updates.cover_url);
    }
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    // If cover_url column doesn't exist yet, retry without it (migration not applied)
    if (error && updates.cover_url !== undefined && /cover_url/i.test(error.message)) {
      const { cover_url: _omit, ...rest } = updates;
      const retry = await supabase
        .from('profiles')
        .update(rest)
        .eq('id', userId)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    return dbToUser(data);
  },

  async uploadCover(userId: string, localUri: string): Promise<string> {
    const ext = (localUri.split('.').pop() || 'jpg').toLowerCase().replace(/\?.*$/, '');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const contentType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileName = `${userId}.${safeExt}`;
    const path = `covers/${fileName}`;

    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: contentType } as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${path}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cover upload failed: ${body}`);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  },

  async getUserPosts(userId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async addCoins(userId: string, amount: number, description: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ coins: supabase.rpc('increment', { x: amount }) })
      .eq('id', userId);

    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount,
      transaction_type: 'purchase',
      description,
    });
  },

  async refreshCoins(userId: string): Promise<number> {
    const { data } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single();
    return data?.coins || 0;
  },

  async getFollowStatus(followerId: string, followingId: string): Promise<boolean> {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();
    return !!data;
  },

  async followUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });
    if (error) throw new Error(error.message);
  },

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw new Error(error.message);
  },
};
