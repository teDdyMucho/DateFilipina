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

  // Look up a single story by id. Returns null if expired (RLS hides it),
  // deleted, or not found — callers should fall back to plain-text rendering.
  async getStory(storyId: string): Promise<Story | null> {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        id, user_id, media_url, media_type, created_at, expires_at,
        profiles!stories_user_id_fkey ( id, name, avatar_url )
      `)
      .eq('id', storyId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as any;
    if (!row.profiles) return null;
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.profiles.name || 'User',
      userAvatar: fixAvatarUri(row.profiles.avatar_url, row.profiles.id),
      mediaUrl: row.media_url,
      mediaType: row.media_type === 'video' ? 'video' : 'photo',
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
    };
  },

  // Toggle a specific reaction type on/off for the current user on a story.
  // Multiple different reactions per user are allowed (love + hot + cupid
  // can all be active simultaneously). Tapping the SAME reaction again
  // removes just that one type — other reactions from the same user stay.
  async reactToStory(storyId: string, userId: string, reaction: StoryReactionKey): Promise<void> {
    const { data: existing } = await supabase
      .from('story_reactions')
      .select('id')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .maybeSingle();
    if (existing?.id) {
      // Already applied → remove this specific reaction
      const { error } = await supabase
        .from('story_reactions')
        .delete()
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
      return;
    }
    // Not yet applied → insert. The UNIQUE(story_id, user_id, reaction)
    // constraint protects against a race that would create a duplicate row.
    const { error } = await supabase
      .from('story_reactions')
      .insert({ story_id: storyId, user_id: userId, reaction });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
  },

  // Returns the current user's reactions for a story (array, possibly empty)
  // plus the owner-facing list (every reactor profile + the reaction they
  // sent, possibly multiple rows per user). RLS limits the "all" list to
  // the story owner.
  async getStoryReactions(storyId: string): Promise<{
    mine: StoryReactionKey[];
    all: Array<{ userId: string; userName: string; userAvatar: string; reaction: StoryReactionKey; createdAt: Date }>;
  }> {
    const { data, error } = await supabase
      .from('story_reactions')
      .select(`
        user_id,
        reaction,
        created_at,
        profiles!story_reactions_user_id_fkey ( id, name, avatar_url )
      `)
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });
    if (error) return { mine: [], all: [] };

    const { data: { session } } = await supabase.auth.getSession();
    const myId = session?.user?.id;

    const mine: StoryReactionKey[] = [];
    const all = (data || []).map((row: any) => {
      const key = row.reaction as StoryReactionKey;
      if (row.user_id === myId) mine.push(key);
      return {
        userId: row.user_id,
        userName: row.profiles?.name || 'User',
        userAvatar: fixAvatarUri(row.profiles?.avatar_url, row.user_id),
        reaction: key,
        createdAt: new Date(row.created_at),
      };
    });
    return { mine, all };
  },
};

export type StoryReactionKey =
  | 'cupid' | 'match' | 'love' | 'crush' | 'kiss'
  | 'admire' | 'hot' | 'flirt' | 'romance' | 'wow';

// Modern monochrome icons from MaterialCommunityIcons — replaces the cartoony
// system emojis for a cleaner look that doesn't depend on the device's emoji
// renderer. `emoji` is kept as a textual fallback (e.g. for SQL trigger /
// notification body / older code paths).
export const STORY_REACTIONS: ReadonlyArray<{
  key: StoryReactionKey;
  icon: string;          // MaterialCommunityIcons name (verified to exist in bundled MCI)
  color: string;         // tint color for selected state
  emoji: string;         // fallback for text contexts (bell notification)
  label: string;
}> = [
  { key: 'cupid',   icon: 'heart-pulse',           color: '#FF3D6E', emoji: '💘', label: 'Cupid' },
  { key: 'match',   icon: 'heart-multiple',        color: '#FF3D6E', emoji: '💕', label: 'Match' },
  { key: 'love',    icon: 'heart',                 color: '#FF3D6E', emoji: '❤️', label: 'Love' },
  { key: 'crush',   icon: 'heart-half-full',       color: '#FF3D6E', emoji: '🥰', label: 'Crush' },
  { key: 'kiss',    icon: 'emoticon-kiss-outline', color: '#FF3D6E', emoji: '😘', label: 'Kiss' },
  { key: 'admire',  icon: 'star',                  color: '#FFD700', emoji: '😍', label: 'Admire' },
  { key: 'hot',     icon: 'fire',                  color: '#FF6B35', emoji: '🔥', label: 'Hot' },
  { key: 'flirt',   icon: 'emoticon-wink-outline', color: '#FF3D6E', emoji: '💋', label: 'Flirt' },
  { key: 'romance', icon: 'flower',                color: '#FF3D6E', emoji: '🌹', label: 'Romance' },
  { key: 'wow',     icon: 'emoticon-excited',      color: '#FFD700', emoji: '😮', label: 'Wow' },
];
