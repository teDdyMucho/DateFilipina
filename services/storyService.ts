import { supabase } from './supabase';
import { fixAvatarUri } from '@/constants/avatarUtils';

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  createdAt: Date;
  expiresAt: Date;
}

// One entry per user that has any active (non-expired) story.
// Groups stories so the friends strip shows one ring per user.
export interface UserStories {
  userId: string;
  userName: string;
  userAvatar: string;
  stories: Story[];
  latestAt: Date;
}

export const storyService = {
  // Returns all active stories from every user, grouped by user, newest first.
  async getActiveStoriesGrouped(): Promise<UserStories[]> {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        created_at,
        expires_at,
        profiles!stories_user_id_fkey ( id, name, avatar_url )
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      // Likely "relation stories does not exist" if migration hasn't been applied yet.
      return [];
    }

    const byUser = new Map<string, UserStories>();
    for (const row of (data || []) as any[]) {
      if (!row.profiles) continue;
      const story: Story = {
        id: row.id,
        userId: row.user_id,
        userName: row.profiles.name || 'User',
        userAvatar: fixAvatarUri(row.profiles.avatar_url, row.profiles.id),
        mediaUrl: row.media_url,
        mediaType: row.media_type === 'video' ? 'video' : 'photo',
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      };
      const existing = byUser.get(row.user_id);
      if (existing) {
        existing.stories.push(story);
        if (story.createdAt > existing.latestAt) existing.latestAt = story.createdAt;
      } else {
        byUser.set(row.user_id, {
          userId: row.user_id,
          userName: story.userName,
          userAvatar: story.userAvatar,
          stories: [story],
          latestAt: story.createdAt,
        });
      }
    }

    // Newest user first
    return Array.from(byUser.values()).sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
  },

  async uploadStoryMedia(uri: string, userId: string, mediaType: 'photo' | 'video'): Promise<string> {
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const path = `stories/${userId}/${fileName}`;
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', { uri, name: fileName, type: contentType } as any);

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

  async createStory(userId: string, mediaUrl: string, mediaType: 'photo' | 'video'): Promise<void> {
    const { error } = await supabase.from('stories').insert({
      user_id: userId,
      media_url: mediaUrl,
      media_type: mediaType,
    });
    if (error) throw new Error(error.message);
  },

  async deleteStory(storyId: string): Promise<void> {
    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    if (error) throw new Error(error.message);
  },
};
