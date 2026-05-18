import { supabase } from './supabase';
import { Conversation, Message } from '@/constants/types';
import { fixAvatarUri } from '@/constants/avatarUtils';

export const messageService = {
  async getConversations(userId: string): Promise<Conversation[]> {
    // Try with cleared_at columns (added by fix_chat_settings.sql migration).
    // Fall back gracefully if the columns don't exist yet.
    let data: any[] | null = null;
    const withClear = await supabase
      .from('conversations')
      .select('id, last_message, last_message_at, participant1_id, participant2_id, unread_count1, unread_count2, cleared_at_p1, cleared_at_p2, created_at')
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (withClear.error) {
      // Migration not applied yet — retry without the new columns
      const fallback = await supabase
        .from('conversations')
        .select('id, last_message, last_message_at, participant1_id, participant2_id, unread_count1, unread_count2, created_at')
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (fallback.error) throw new Error(fallback.error.message);
      data = fallback.data;
    } else {
      data = withClear.data;
    }
    if (!data || data.length === 0) return [];

    // Hide conversations the user cleared (no-op if the cleared_at columns are absent)
    const filtered = data.filter((row: any) => {
      const clearedAt = row.participant1_id === userId ? row.cleared_at_p1 : row.cleared_at_p2;
      if (!clearedAt) return true;
      if (!row.last_message_at) return false;
      return new Date(row.last_message_at) > new Date(clearedAt);
    });
    if (filtered.length === 0) return [];

    // Collect all partner IDs (from filtered list)
    const partnerIds = filtered.map((row: any) =>
      row.participant1_id === userId ? row.participant2_id : row.participant1_id
    );

    // Fetch partner profiles in one query
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, is_online, is_verified')
      .in('id', partnerIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    return filtered.map((row: any) => {
      const isP1 = row.participant1_id === userId;
      const partnerId = isP1 ? row.participant2_id : row.participant1_id;
      const partner = profileMap.get(partnerId);
      const unread = isP1 ? row.unread_count1 : row.unread_count2;
      const lastTime = row.last_message_at || row.created_at || new Date().toISOString();
      return {
        id: row.id,
        participant: {
          id: partnerId,
          name: partner?.name || 'Unknown',
          avatar: fixAvatarUri(partner?.avatar_url, partnerId),
          isOnline: partner?.is_online || false,
          isVerified: partner?.is_verified || false,
        },
        lastMessage: row.last_message || '',
        lastMessageTime: new Date(lastTime),
        unreadCount: unread || 0,
        isPinned: false,
      };
    });
  },

  async getMessages(conversationId: string, userId?: string): Promise<Message[]> {
    // Respect per-user "cleared_at" — only return messages newer than the user's clear.
    // Wrapped in try/catch in case the migration hasn't been run yet.
    let clearedAt: string | null = null;
    if (userId) {
      try {
        const { data: conv, error } = await supabase
          .from('conversations')
          .select('participant1_id, participant2_id, cleared_at_p1, cleared_at_p2')
          .eq('id', conversationId)
          .single();
        if (!error && conv) {
          clearedAt = (conv as any).participant1_id === userId ? (conv as any).cleared_at_p1 : (conv as any).cleared_at_p2;
        }
      } catch { /* columns may not exist — ignore */ }
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (clearedAt) query = query.gt('created_at', clearedAt);

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      type: row.message_type || 'text',
      timestamp: new Date(row.created_at),
      read: row.is_read,
      imageUrl: row.media_url || undefined,
      replyToStoryId: row.reply_to_story_id || undefined,
    }));
  },

  // Per-user "clear conversation" — sets the clear timestamp for the current user.
  // The conversation disappears from their list until a new message arrives.
  async clearConversationForUser(conversationId: string, userId: string): Promise<void> {
    const { data: conv } = await supabase
      .from('conversations')
      .select('participant1_id, participant2_id')
      .eq('id', conversationId)
      .single();
    if (!conv) return;
    const field = conv.participant1_id === userId ? 'cleared_at_p1' : 'cleared_at_p2';
    const { error } = await supabase
      .from('conversations')
      .update({ [field]: new Date().toISOString() })
      .eq('id', conversationId);
    if (error) throw new Error(error.message);
  },

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  },

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
  },

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();
    return !!data;
  },

  // Bi-directional check: returns { iBlocked: I blocked them, blockedMe: they blocked me }
  async getBlockStatus(myId: string, partnerId: string): Promise<{ iBlocked: boolean; blockedMe: boolean }> {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(`and(blocker_id.eq.${myId},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${myId})`);
      if (error || !data) return { iBlocked: false, blockedMe: false };
      return {
        iBlocked: data.some(r => r.blocker_id === myId && r.blocked_id === partnerId),
        blockedMe: data.some(r => r.blocker_id === partnerId && r.blocked_id === myId),
      };
    } catch {
      return { iBlocked: false, blockedMe: false };
    }
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type = 'text',
    replyToStoryId?: string,
  ): Promise<Message> {
    const payload: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: type,
    };
    if (replyToStoryId) payload.reply_to_story_id = replyToStoryId;

    // If the reply_to_story_id column hasn't been added yet, retry without it.
    let res = await supabase.from('messages').insert(payload).select().single();
    if (res.error && /reply_to_story_id/i.test(res.error.message)) {
      delete payload.reply_to_story_id;
      res = await supabase.from('messages').insert(payload).select().single();
    }
    if (res.error) throw new Error(res.error.message);
    const data = res.data;

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      content: data.content,
      type: data.message_type,
      timestamp: new Date(data.created_at),
      read: false,
      replyToStoryId: data.reply_to_story_id || undefined,
    };
  },

  async markConversationRead(conversationId: string, userId: string) {
    // Mark individual messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    // Zero out the unread counter for this participant in the conversations table
    const { data: conv } = await supabase
      .from('conversations')
      .select('participant1_id, participant2_id')
      .eq('id', conversationId)
      .single();

    if (conv) {
      const field = conv.participant1_id === userId ? 'unread_count1' : 'unread_count2';
      await supabase.from('conversations').update({ [field]: 0 }).eq('id', conversationId);
    }
  },

  subscribeToMessages(conversationId: string, onMessage: (msg: Message) => void) {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as any;
        onMessage({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          content: row.content,
          type: row.message_type,
          timestamp: new Date(row.created_at),
          read: false,
        });
      })
      .subscribe();
    return channel;
  },

  subscribeToConversations(userId: string, onChange: () => void) {
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant1_id=eq.${userId}`,
      }, onChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant2_id=eq.${userId}`,
      }, onChange)
      .subscribe();
    return channel;
  },

  async uploadPhoto(localUri: string, userId: string): Promise<string> {
    const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'jpg';
    const fileName = `${userId}_${Date.now()}.${safeExt}`;
    const path = `chat/${userId}/${fileName}`;
    const contentType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: contentType } as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const res = await fetch(`${supabaseUrl}/storage/v1/object/media/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      body: formData as any,
    });

    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  },

  async getOrCreateConversation(userId: string, partnerId: string): Promise<string> {
    const p1 = userId < partnerId ? userId : partnerId;
    const p2 = userId < partnerId ? partnerId : userId;

    // Try to find existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant1_id', p1)
      .eq('participant2_id', p2)
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Insert with upsert to handle race conditions gracefully
    const { data: created, error } = await supabase
      .from('conversations')
      .upsert(
        { participant1_id: p1, participant2_id: p2 },
        { onConflict: 'participant1_id,participant2_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (error) {
      // If conflict — just fetch the existing row
      const { data: retry } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant1_id', p1)
        .eq('participant2_id', p2)
        .maybeSingle();
      if (retry?.id) return retry.id;
      throw new Error(error.message);
    }

    return created.id;
  },
};
