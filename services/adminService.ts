import { supabase } from './supabase';
import { User } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';
import { liveService } from './liveService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    isAdmin: p.is_admin || false,
    isBanned: p.is_banned || false,
    bannedReason: p.banned_reason || undefined,
    canStream: p.can_stream !== false,
  };
}

async function getCurrentAdminId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Records an admin action in the audit log.
 * Silently fails if the admin_actions table is missing or RLS rejects.
 */
async function logAdminAction(
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any> = {},
): Promise<void> {
  const adminId = await getCurrentAdminId();
  if (!adminId) return;
  await supabase.from('admin_actions').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  }).then(() => {}, () => {});
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface UserListParams {
  search?: string;
  banned?: 'all' | 'banned' | 'active';
  verified?: 'all' | 'verified' | 'unverified';
  limit?: number;
  offset?: number;
}

export interface UserActivity {
  posts: any[];
  recentTransactions: any[];
  totalGiftsReceived: number;
  totalGiftsSent: number;
  followerCount: number;
  followingCount: number;
}

export const adminService = {
  // ── User list ──────────────────────────────────────────────────────────────
  async getAllUsers(params: UserListParams = {}): Promise<{ users: User[]; total: number }> {
    const limit = params.limit ?? 30;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .neq('is_admin', true)   // never list admin accounts in the management UI
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.search?.trim()) {
      const s = params.search.trim();
      query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
    }

    if (params.banned === 'banned')   query = query.eq('is_banned', true);
    if (params.banned === 'active')   query = query.eq('is_banned', false);
    if (params.verified === 'verified')   query = query.eq('is_verified', true);
    if (params.verified === 'unverified') query = query.eq('is_verified', false);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      users: (data || []).map(dbToUser),
      total: count ?? 0,
    };
  },

  async getUserById(id: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return dbToUser(data);
  },

  // ── User actions ──────────────────────────────────────────────────────────
  async banUser(userId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
      })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction('ban_user', 'user', userId, { reason });
  },

  async unbanUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
      })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction('unban_user', 'user', userId, {});
  },

  async deleteUser(userId: string): Promise<void> {
    // Best-effort deletion. Cascading FK relations will handle user-owned rows.
    // auth.users entry will need to be removed via Supabase admin API or dashboard.
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction('delete_user', 'user', userId, {});
  },

  async setVerified(userId: string, verified: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: verified })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction(verified ? 'verify_user' : 'unverify_user', 'user', userId, {});
  },

  async setCanStream(userId: string, canStream: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ can_stream: canStream })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction(canStream ? 'allow_streaming' : 'revoke_streaming', 'user', userId, {});
  },

  async updateUserProfile(
    userId: string,
    updates: Partial<{ name: string; bio: string; age: number; location: string; occupation: string; avatar_url: string; cover_url: string }>,
  ): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction('update_user_profile', 'user', userId, { fields: Object.keys(updates) });
  },

  async removeAvatar(userId: string): Promise<void> {
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: defaultAvatar })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    await logAdminAction('remove_avatar', 'user', userId, {});
  },

  async removeCover(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: null })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      await logAdminAction('remove_cover', 'user', userId, {});
    } catch (e: any) {
      // Column may not exist if migration not applied — silently ignore
      if (!/cover_url/i.test(e.message)) throw e;
    }
  },

  // ── User activity ─────────────────────────────────────────────────────────
  async getUserActivity(userId: string): Promise<UserActivity> {
    const [postsRes, txRes, earnRes, spendRes, followersRes, followingRes] = await Promise.all([
      supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('coin_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('coin_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'earn'),
      supabase.from('coin_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'spend'),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    return {
      posts: postsRes.data || [],
      recentTransactions: txRes.data || [],
      totalGiftsReceived: earnRes.count ?? 0,
      totalGiftsSent: spendRes.count ?? 0,
      followerCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
    };
  },

  // ── Posts management ──────────────────────────────────────────────────────
  async getAllPosts(params: { search?: string; filter?: 'all' | 'photo' | 'video' | 'pinned' | 'hidden'; limit?: number; offset?: number } = {}): Promise<{ posts: any[]; total: number }> {
    const limit = params.limit ?? 30;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('posts')
      .select(`
        id, caption, media_urls, media_type,
        likes_count, comments_count, is_pinned, is_hidden,
        created_at, user_id,
        profiles!posts_user_id_fkey (id, name, avatar_url, is_verified, is_banned)
      `, { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.search?.trim()) {
      query = query.ilike('caption', `%${params.search.trim()}%`);
    }

    if (params.filter === 'photo')  query = query.eq('media_type', 'photo');
    if (params.filter === 'video')  query = query.eq('media_type', 'video');
    if (params.filter === 'pinned') query = query.eq('is_pinned', true);
    if (params.filter === 'hidden') query = query.eq('is_hidden', true);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { posts: data || [], total: count ?? 0 };
  },

  async getPostComments(postId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select('id, content, created_at, user_id, profiles!post_comments_user_id_fkey (id, name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async deletePostAsAdmin(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
    await logAdminAction('delete_post', 'post', postId, {});
  },

  async updatePostCaptionAsAdmin(postId: string, caption: string): Promise<void> {
    const { error } = await supabase.from('posts').update({ caption }).eq('id', postId);
    if (error) throw new Error(error.message);
    await logAdminAction('update_post_caption', 'post', postId, { caption });
  },

  async setPinned(postId: string, pinned: boolean): Promise<void> {
    const { error } = await supabase.from('posts').update({ is_pinned: pinned }).eq('id', postId);
    if (error) throw new Error(error.message);
    await logAdminAction(pinned ? 'pin_post' : 'unpin_post', 'post', postId, {});
  },

  async setHidden(postId: string, hidden: boolean): Promise<void> {
    const { error } = await supabase.from('posts').update({ is_hidden: hidden }).eq('id', postId);
    if (error) throw new Error(error.message);
    await logAdminAction(hidden ? 'hide_post' : 'unhide_post', 'post', postId, {});
  },

  async deleteCommentAsAdmin(commentId: string): Promise<void> {
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);
    await logAdminAction('delete_comment', 'comment', commentId, {});
  },

  async updateCommentAsAdmin(commentId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('post_comments')
      .update({ content })
      .eq('id', commentId);
    if (error) throw new Error(error.message);
    await logAdminAction('update_comment', 'comment', commentId, { content });
  },

  // ── Live streams management ───────────────────────────────────────────────
  async getAllActiveStreams(): Promise<any[]> {
    const { data, error } = await supabase
      .from('live_streams')
      .select(`
        id, host_id, title, category, viewer_count, gift_total, started_at,
        profiles!live_streams_host_id_fkey (id, name, avatar_url, is_verified, is_banned, can_stream)
      `)
      .is('ended_at', null)
      .order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async endStreamAsAdmin(streamId: string, hostId: string, reason: string): Promise<void> {
    // Broadcast force-end with reason — host + viewers close instantly with the reason shown.
    // No need to also send 'stream_ended' (would cause duplicate modals on the viewer side).
    await liveService.adminBroadcast(streamId, 'admin_force_end', { reason });
    // Mark in DB
    const { error } = await supabase
      .from('live_streams')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', streamId);
    if (error) throw new Error(error.message);
    // Also flip host's is_live flag
    await supabase.from('profiles').update({ is_live: false }).eq('id', hostId).then(() => {}, () => {});
    await logAdminAction('end_stream', 'stream', streamId, { reason, host_id: hostId });
  },

  async muteStreamAudio(streamId: string, hostId: string): Promise<void> {
    await liveService.adminBroadcast(streamId, 'admin_mute_audio', {});
    await logAdminAction('mute_stream_audio', 'stream', streamId, { host_id: hostId });
  },

  async muteStreamVideo(streamId: string, hostId: string): Promise<void> {
    await liveService.adminBroadcast(streamId, 'admin_mute_video', {});
    await logAdminAction('mute_stream_video', 'stream', streamId, { host_id: hostId });
  },

  // ── Wallet / Economy ──────────────────────────────────────────────────────
  async getAllTransactions(params: { type?: 'all' | 'purchase' | 'spend' | 'earn' | 'bonus'; limit?: number; offset?: number } = {}): Promise<{ transactions: any[]; total: number }> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('coin_transactions')
      .select(`
        id, amount, type, description, created_at, user_id,
        profiles!coin_transactions_user_id_fkey (id, name, avatar_url, is_verified)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.type && params.type !== 'all') {
      query = query.eq('type', params.type);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { transactions: data || [], total: count ?? 0 };
  },

  async getEconomyStats(): Promise<{ totalCoins: number; totalUsers: number; totalTransactions: number; coinsToday: number }> {
    const [coinsRes, userCountRes, txCountRes, todayRes] = await Promise.all([
      supabase.from('profiles').select('coins').neq('is_admin', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('is_admin', true),
      supabase.from('coin_transactions').select('id', { count: 'exact', head: true }),
      supabase.from('coin_transactions').select('amount').gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);
    const totalCoins = (coinsRes.data || []).reduce((sum: number, p: any) => sum + (p.coins || 0), 0);
    const coinsToday = (todayRes.data || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
    return {
      totalCoins,
      totalUsers: userCountRes.count ?? 0,
      totalTransactions: txCountRes.count ?? 0,
      coinsToday,
    };
  },

  async grantCoins(userId: string, amount: number, reason: string): Promise<void> {
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    // 1. Bump user balance
    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('coins').eq('id', userId).single();
    if (pErr) throw new Error(pErr.message);
    const newBalance = (profile?.coins || 0) + amount;
    const { error: upErr } = await supabase
      .from('profiles').update({ coins: newBalance }).eq('id', userId);
    if (upErr) throw new Error(upErr.message);
    // 2. Insert transaction record (type=bonus, admin grant)
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount,
      type: 'bonus',
      description: `Admin grant: ${reason}`,
    }).then(() => {}, () => {});
    await logAdminAction('grant_coins', 'user', userId, { amount, reason });
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  async getReports(params: { status?: 'all' | 'pending' | 'resolved' | 'ignored'; limit?: number; offset?: number } = {}): Promise<{ reports: any[]; total: number }> {
    const limit = params.limit ?? 30;
    const offset = params.offset ?? 0;

    // First get the raw reports (no joins — they're flaky with custom-named FKs).
    // Use '*' to dodge any missing-column issues from older migrations.
    let query = supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    const { data, error, count } = await query;
    if (error) {
      console.log('[admin.getReports] DB error:', error);
      throw new Error(error.message);
    }
    const rows = data || [];
    console.log(`[admin.getReports] returned ${rows.length} rows (total=${count})`);
    if (rows.length === 0) return { reports: [], total: count ?? 0 };

    // Fetch reporter + resolver profiles (best-effort; still return reports if it fails)
    const profileIds = [
      ...new Set([
        ...rows.map(r => r.reporter_id).filter(Boolean),
        ...rows.map(r => r.resolved_by).filter(Boolean),
      ]),
    ] as string[];

    let profileMap = new Map<string, any>();
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', profileIds);
      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    } catch (e) {
      console.log('[admin.getReports] profile lookup failed', e);
    }

    return {
      reports: rows.map((r: any) => ({
        ...r,
        reporter: r.reporter_id ? profileMap.get(r.reporter_id) || null : null,
        resolver: r.resolved_by ? profileMap.get(r.resolved_by) || null : null,
      })),
      total: count ?? 0,
    };
  },

  async resolveReport(reportId: string, action: 'resolved' | 'ignored', note?: string): Promise<void> {
    const adminId = await getCurrentAdminId();
    const { error } = await supabase
      .from('reports')
      .update({
        status: action,
        resolved_at: new Date().toISOString(),
        resolved_by: adminId,
        resolution_note: note?.trim() || null,
      })
      .eq('id', reportId);
    if (error) throw new Error(error.message);
    await logAdminAction(action === 'resolved' ? 'resolve_report' : 'ignore_report', 'report', reportId, { note });
  },

  async revokeCoins(userId: string, amount: number, reason: string): Promise<void> {
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('coins').eq('id', userId).single();
    if (pErr) throw new Error(pErr.message);
    const current = profile?.coins || 0;
    if (current < amount) throw new Error(`User only has ${current} coins.`);
    const newBalance = current - amount;
    const { error: upErr } = await supabase
      .from('profiles').update({ coins: newBalance }).eq('id', userId);
    if (upErr) throw new Error(upErr.message);
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -amount,
      type: 'spend',
      description: `Admin revoke: ${reason}`,
    }).then(() => {}, () => {});
    await logAdminAction('revoke_coins', 'user', userId, { amount, reason });
  },

  // ── Audit log helper (also exposed for non-user actions used later) ──────
  logAction: logAdminAction,
};
