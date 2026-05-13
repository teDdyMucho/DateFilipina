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

export const authService = {
  async register({ email, password, name, age }: { email: string; password: string; name: string; age: number }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, age },
        emailRedirectTo: undefined,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Registration failed. Please try again.');

    // Auto sign-in after signup (works when email confirmation is disabled in Supabase)
    if (!data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      data.session = signInData.session;
    }

    // Session is active — insert profile now
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${data.user.id}`;
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      age,
      coins: 100,
      bio: '',
      location: '',
      occupation: '',
      avatar_url: avatarUrl,
      is_online: true,
      is_live: false,
      is_verified: false,
      interests: [],
      photos: [],
      followers_count: 0,
      following_count: 0,
      likes_count: 0,
    });

    if (profileError) throw new Error(profileError.message);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return { user: dbToUser(profile), token: data.session!.access_token };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Login failed.');

    await supabase.from('profiles').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', data.user.id);

    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profileError) throw new Error('Could not load profile.');

    return { user: dbToUser(profile), token: data.session.access_token };
  },

  async logout(userId?: string) {
    if (userId) {
      await supabase.from('profiles').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('id', userId);
    }
    await supabase.auth.signOut();
  },

  async restoreSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return null;
    return { user: dbToUser(profile), token: session.access_token };
  },
};
