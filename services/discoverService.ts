import { supabase } from './supabase';
import { User } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';

export interface DiscoverFilters {
  minAge?: number;
  maxAge?: number;
  location?: string;
}

export const discoverService = {
  // Fetch profiles to show — excludes: self, already swiped, already matched
  // Ordered by: online first, then verified, then most recently active
  async getProfiles(userId: string, filters: DiscoverFilters = {}): Promise<User[]> {
    // Get already-swiped IDs
    const { data: swiped } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', userId);
    const swipedIds = (swiped || []).map((s: any) => s.swiped_id);

    // Get matched IDs
    const { data: matches } = await supabase
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    const matchedIds = (matches || []).map((m: any) =>
      m.user1_id === userId ? m.user2_id : m.user1_id
    );

    const excludeIds = [...new Set([userId, ...swipedIds, ...matchedIds])];

    let query = supabase
      .from('profiles')
      .select('id, name, age, bio, location, occupation, avatar_url, photos, interests, is_online, is_verified, is_live, last_seen_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .neq('is_admin', true)   // admins are never in the swipe pool
      .neq('is_banned', true)  // banned users are never visible to others
      .order('is_online', { ascending: false })
      .order('is_verified', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(50);

    if (filters.minAge) query = query.gte('age', filters.minAge);
    if (filters.maxAge) query = query.lte('age', filters.maxAge);
    if (filters.location && filters.location !== 'Any') {
      query = query.ilike('location', `%${filters.location}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      bio: p.bio || '',
      location: p.location || '',
      occupation: p.occupation || '',
      avatar: fixAvatarUri(p.avatar_url, p.id),
      photos: p.photos || [],
      interests: p.interests || [],
      isOnline: p.is_online || false,
      isVerified: p.is_verified || false,
      isLive: p.is_live || false,
      coins: 0,
      followers: 0,
      following: 0,
      likes: 0,
    }));
  },

  // Record a swipe and check for mutual match
  // Returns matched User if it's a match, null otherwise
  async swipe(swiperId: string, swipedId: string, direction: 'like' | 'pass' | 'super_like'): Promise<User | null> {
    // Insert swipe (ignore duplicate)
    const { error } = await supabase
      .from('swipes')
      .insert({ swiper_id: swiperId, swiped_id: swipedId, direction })
      .select()
      .single();

    if (error && !error.message.includes('duplicate')) throw new Error(error.message);

    if (direction === 'pass') return null;

    // Check if mutual match exists now (trigger creates it, we just check)
    const p1 = swiperId < swipedId ? swiperId : swipedId;
    const p2 = swiperId < swipedId ? swipedId : swiperId;
    const { data: match } = await supabase
      .from('matches')
      .select('id')
      .eq('user1_id', p1)
      .eq('user2_id', p2)
      .single();

    if (!match) return null;

    // Fetch matched user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, age, bio, location, occupation, avatar_url, photos, interests, is_online, is_verified')
      .eq('id', swipedId)
      .single();

    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.name,
      age: profile.age,
      bio: profile.bio || '',
      location: profile.location || '',
      occupation: profile.occupation || '',
      avatar: fixAvatarUri(profile.avatar_url, profile.id),
      photos: profile.photos || [],
      interests: profile.interests || [],
      isOnline: profile.is_online || false,
      isVerified: profile.is_verified || false,
      isLive: false,
      coins: 0,
      followers: 0,
      following: 0,
      likes: 0,
    };
  },

  // People who liked/super-liked me but I haven't responded to yet
  async getIncomingLikes(userId: string): Promise<User[]> {
    // Step 1: IDs I've already swiped on (so I don't show people I already passed/liked)
    const { data: mySwipes } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', userId);
    const alreadySwiped = new Set((mySwipes || []).map((s: any) => s.swiped_id));

    // Step 2: IDs of people already matched with me (mutual match already happened)
    const { data: myMatches } = await supabase
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    const matchedIds = new Set((myMatches || []).map((m: any) =>
      m.user1_id === userId ? m.user2_id : m.user1_id
    ));

    // Step 3: Get swiper_ids who liked me
    const { data: incomingSwipes, error: swipeErr } = await supabase
      .from('swipes')
      .select('swiper_id, direction')
      .eq('swiped_id', userId)
      .in('direction', ['like', 'super_like'])
      .order('created_at', { ascending: false });

    if (swipeErr) throw new Error(swipeErr.message);
    if (!incomingSwipes || incomingSwipes.length === 0) return [];

    // Filter out people I already swiped on or matched with
    const pendingIds = incomingSwipes
      .map((s: any) => s.swiper_id)
      .filter((id: string) => !alreadySwiped.has(id) && !matchedIds.has(id) && id !== userId);

    if (pendingIds.length === 0) return [];

    // Step 4: Fetch their profiles (exclude admins + banned)
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, name, age, bio, location, occupation, avatar_url, photos, interests, is_online, is_verified, is_live')
      .in('id', pendingIds)
      .neq('is_admin', true)
      .neq('is_banned', true);

    if (profErr) throw new Error(profErr.message);
    if (!profiles) return [];

    // Preserve order (most recent first)
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    return pendingIds
      .map((id: string) => profileMap.get(id))
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        age: p.age || 0,
        bio: p.bio || '',
        location: p.location || '',
        occupation: p.occupation || '',
        avatar: fixAvatarUri(p.avatar_url, p.id),
        photos: p.photos || [],
        interests: p.interests || [],
        isOnline: p.is_online || false,
        isVerified: p.is_verified || false,
        isLive: p.is_live || false,
        coins: 0, followers: 0, following: 0, likes: 0,
      }));
  },

  // Get current user's matches with profile info
  async getMatches(userId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        profiles!matches_user1_id_fkey (id, name, avatar_url, is_online, is_verified, age, location),
        profiles!matches_user2_id_fkey (id, name, avatar_url, is_online, is_verified, age, location),
        user1_id, user2_id
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) return [];

    return data.map((m: any) => {
      const isUser1 = m.user1_id === userId;
      const p = isUser1 ? m['profiles!matches_user2_id_fkey'] : m['profiles!matches_user1_id_fkey'];
      return {
        id: p.id,
        name: p.name,
        age: p.age || 0,
        bio: '',
        location: p.location || '',
        occupation: '',
        avatar: fixAvatarUri(p.avatar_url, p.id),
        photos: [],
        interests: [],
        isOnline: p.is_online || false,
        isVerified: p.is_verified || false,
        isLive: false,
        coins: 0, followers: 0, following: 0, likes: 0,
      };
    });
  },
};
