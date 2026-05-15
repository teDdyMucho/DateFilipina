import { supabase } from './supabase';
import { fixAvatarUri } from '@/constants/avatarUtils';

export type NotificationType =
  | 'match' | 'message' | 'like' | 'follow' | 'gift'
  | 'live_start' | 'super_like' | 'comment' | 'share';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data: Record<string, any>;
  actor: { id: string; name: string; avatar: string } | null;
}

export const notificationService = {
  async getNotifications(userId: string, limit = 60): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, type, title, body, data, is_read, created_at,
        actor:profiles!notifications_actor_id_fkey ( id, name, avatar_url )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      isRead: !!row.is_read,
      createdAt: new Date(row.created_at),
      data: row.data || {},
      actor: row.actor
        ? { id: row.actor.id, name: row.actor.name || 'User', avatar: fixAvatarUri(row.actor.avatar_url, row.actor.id) }
        : null,
    }));
  },

  async getUnreadCount(userId: string): Promise<number> {
    // RPC is more efficient but falls back to count() if missing
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count', { p_user_id: userId });
      if (!error && typeof data === 'number') return data;
    } catch {}
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count ?? 0;
  },

  async markAllRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId });
      if (!error) return;
    } catch {}
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  async markOneRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  async deleteNotification(id: string): Promise<void> {
    await supabase.from('notifications').delete().eq('id', id);
  },

  async clearAll(userId: string): Promise<void> {
    await supabase.from('notifications').delete().eq('user_id', userId);
  },
};
