import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fixAvatarUri } from '@/constants/avatarUtils';

export interface LiveStream {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  category: string;
  viewerCount: number;
  giftTotal: number;
  startedAt: Date;
}

export interface LiveComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: Date;
}

export const liveService = {
  async getStreams(): Promise<LiveStream[]> {
    // Try with is_live column first (post-migration), fall back to is_active
    let { data, error } = await supabase
      .from('live_streams')
      .select('id, host_id, title, category, viewer_count, gift_total, started_at, profiles(name, avatar_url)')
      .eq('is_live', true)
      .order('viewer_count', { ascending: false });

    if (error?.message?.includes('is_live')) {
      // Column doesn't exist yet — try is_active fallback
      const res = await supabase
        .from('live_streams')
        .select('id, host_id, title, viewer_count, started_at, profiles(name, avatar_url)')
        .eq('is_active', true)
        .order('viewer_count', { ascending: false });
      data = res.data;
      error = res.error;
    }

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({
      id: row.id,
      hostId: row.host_id,
      hostName: row.profiles?.name || 'Unknown',
      hostAvatar: fixAvatarUri(row.profiles?.avatar_url, row.host_id),
      title: row.title || 'Live Stream',
      category: row.category || 'Chat',
      viewerCount: row.viewer_count || 0,
      giftTotal: row.gift_total || 0,
      startedAt: new Date(row.started_at),
    }));
  },

  async startStream(hostId: string, title: string, category: string): Promise<LiveStream> {
    // End any existing stream from this host
    await supabase
      .from('live_streams')
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq('host_id', hostId)
      .eq('is_live', true);

    const { data, error } = await supabase
      .from('live_streams')
      .insert({ host_id: hostId, title, category, is_live: true, viewer_count: 0, gift_total: 0 })
      .select('id, host_id, title, category, viewer_count, gift_total, started_at')
      .single();

    if (error) throw new Error(error.message);

    // Mark user as live
    await supabase.from('profiles').update({ is_live: true }).eq('id', hostId);

    const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', hostId).single();

    return {
      id: data.id,
      hostId: data.host_id,
      hostName: profile?.name || 'Unknown',
      hostAvatar: fixAvatarUri(profile?.avatar_url, hostId),
      title: data.title,
      category: data.category,
      viewerCount: 0,
      giftTotal: 0,
      startedAt: new Date(data.started_at),
    };
  },

  async endStream(streamId: string, hostId: string): Promise<void> {
    await supabase
      .from('live_streams')
      .update({ is_live: false, ended_at: new Date().toISOString() })
      .eq('id', streamId);
    await supabase.from('profiles').update({ is_live: false }).eq('id', hostId);
  },

  async joinStream(streamId: string): Promise<void> {
    // Try RPC first; if it fails (404 / not found), fall back to manual read+update
    const { error } = await supabase.rpc('increment_viewer_count', { stream_id: streamId });
    if (error) {
      const { data } = await supabase.from('live_streams').select('viewer_count').eq('id', streamId).single();
      if (data) {
        await supabase.from('live_streams').update({ viewer_count: (data.viewer_count || 0) + 1 }).eq('id', streamId);
      }
    }
  },

  async leaveStream(streamId: string): Promise<void> {
    const { error } = await supabase.rpc('decrement_viewer_count', { stream_id: streamId });
    if (error) {
      const { data } = await supabase.from('live_streams').select('viewer_count').eq('id', streamId).single();
      if (data) {
        await supabase.from('live_streams').update({ viewer_count: Math.max(0, (data.viewer_count || 1) - 1) }).eq('id', streamId);
      }
    }
  },

  async sendComment(streamId: string, userId: string, text: string): Promise<void> {
    await supabase.from('live_comments').insert({ stream_id: streamId, user_id: userId, text });
  },

  async sendGift(streamId: string, userId: string, hostId: string, giftId: string, giftName: string, giftEmoji: string, coins: number): Promise<void> {
    await supabase.from('gifts').insert({
      stream_id: streamId,
      sender_id: userId,
      receiver_id: hostId,
      gift_id: giftId,
      gift_name: giftName,
      gift_type: giftId,
      gift_emoji: giftEmoji,
      coin_cost: coins,
    }).catch(() => {});
    await supabase.rpc('add_gift_total', { stream_id: streamId, amount: coins }).catch(() => {
      supabase.from('live_streams').select('gift_total').eq('id', streamId).single().then(({ data }) => {
        if (data) supabase.from('live_streams').update({ gift_total: (data.gift_total || 0) + coins }).eq('id', streamId);
      });
    });
  },

  subscribeToComments(streamId: string, onComment: (comment: LiveComment) => void, currentUserId?: string) {
    return supabase
      .channel(`live_comments:${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_comments',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload) => {
        const row = payload.new as any;
        // Skip echo for messages from the current user (already shown optimistically)
        if (currentUserId && row.user_id === currentUserId) return;
        const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', row.user_id).single();
        onComment({
          id: row.id,
          userId: row.user_id,
          userName: profile?.name || 'User',
          userAvatar: fixAvatarUri(profile?.avatar_url, row.user_id),
          text: row.text,
          createdAt: new Date(row.created_at),
        });
      })
      .subscribe();
  },

  // ONE shared room channel for hearts + comments + gifts
  // self:true = sender receives own messages back (needed so host sees viewer gifts)
  // ack:false = fire-and-forget, no latency waiting for server confirmation
  createLiveRoom(
    streamId: string,
    callbacks: {
      onHeart: (fromUserId: string) => void;
      onComment: (comment: LiveComment) => void;
      onGift: (gift: any) => void;
      onStreamEnded?: () => void;
      onAdminForceEnd?: (reason: string) => void;
      onAdminMuteAudio?: () => void;
      onAdminMuteVideo?: () => void;
    },
    currentUserId: string,
    seenIds: Set<string>,
  ) {
    let isSubscribed = false;
    const queue: any[] = [];

    const channel = supabase.channel(`live_room:${streamId}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel.on('broadcast', { event: 'stream_ended' }, () => {
      callbacks.onStreamEnded?.();
    });

    channel.on('broadcast', { event: 'admin_force_end' }, ({ payload }) => {
      callbacks.onAdminForceEnd?.(payload?.reason || 'Stream ended by an administrator');
    });

    channel.on('broadcast', { event: 'admin_mute_audio' }, () => {
      callbacks.onAdminMuteAudio?.();
    });

    channel.on('broadcast', { event: 'admin_mute_video' }, () => {
      callbacks.onAdminMuteVideo?.();
    });

    channel.on('broadcast', { event: 'heart' }, ({ payload }) => {
      if (!payload || payload.fromUserId === currentUserId) return;
      callbacks.onHeart(payload.fromUserId);
    });

    channel.on('broadcast', { event: 'comment' }, ({ payload }) => {
      if (!payload || payload.userId === currentUserId) return;
      if (seenIds.has(payload.id)) return;
      seenIds.add(payload.id);
      callbacks.onComment({
        id: payload.id,
        userId: payload.userId,
        userName: payload.userName,
        userAvatar: fixAvatarUri(payload.userAvatar, payload.userId),
        text: payload.text,
        createdAt: new Date(payload.createdAt),
      });
    });

    channel.on('broadcast', { event: 'gift' }, ({ payload }) => {
      // Use payload.key for unique broadcast id (payload.id is the gift TYPE like "heart")
      const dedupKey = payload?.key ?? payload?.id;
      if (!payload || !dedupKey || seenIds.has(dedupKey)) return;
      seenIds.add(dedupKey);
      callbacks.onGift(payload);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        // Flush any messages that were queued before subscribe completed
        queue.forEach(msg => channel.send(msg));
        queue.length = 0;
      }
    });

    // Return channel + a safe send function that queues if not yet subscribed
    (channel as any)._safeSend = (msg: any) => {
      if (isSubscribed) {
        channel.send(msg);
      } else {
        queue.push(msg);
      }
    };

    return channel;
  },

  roomSendStreamEnded(channel: RealtimeChannel | null) {
    const fn = (channel as any)?._safeSend;
    fn?.({ type: 'broadcast', event: 'stream_ended', payload: {} });
  },

  /**
   * Admin-only: broadcast a one-shot event into a live room without
   * being subscribed first. Used by the admin streams dashboard.
   */
  async adminBroadcast(streamId: string, event: string, payload: any = {}): Promise<void> {
    const channel = supabase.channel(`live_room:${streamId}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event, payload }).finally(() => {
            channel.unsubscribe();
            resolve();
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channel.unsubscribe();
          resolve();
        }
      });
      // Safety timeout
      setTimeout(() => { channel.unsubscribe(); resolve(); }, 3000);
    });
  },

  roomSendHeart(channel: RealtimeChannel | null, fromUserId: string) {
    const fn = (channel as any)?._safeSend;
    fn?.({ type: 'broadcast', event: 'heart', payload: { fromUserId } });
  },

  roomSendComment(channel: RealtimeChannel | null, payload: {
    id: string; userId: string; userName: string;
    userAvatar: string; text: string; createdAt: string;
  }) {
    const fn = (channel as any)?._safeSend;
    fn?.({ type: 'broadcast', event: 'comment', payload });
  },

  roomSendGift(channel: RealtimeChannel | null, payload: any) {
    const fn = (channel as any)?._safeSend;
    fn?.({ type: 'broadcast', event: 'gift', payload });
  },

  subscribeToStreams(onChange: () => void) {
    return supabase
      .channel('live_streams_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, onChange)
      .subscribe();
  },

  subscribeToViewerCount(streamId: string, onUpdate: (count: number) => void) {
    return supabase
      .channel(`live_viewers:${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      }, (payload) => {
        onUpdate((payload.new as any).viewer_count || 0);
      })
      .subscribe();
  },

  async getViewerCount(streamId: string): Promise<number> {
    const { data } = await supabase
      .from('live_streams')
      .select('viewer_count')
      .eq('id', streamId)
      .single();
    return data?.viewer_count || 0;
  },
};
