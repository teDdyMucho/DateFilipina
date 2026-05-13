import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { messageService } from '@/services/messageService';
import { Message } from '@/constants/types';

export function useConversations() {
  const { setConversations } = useChatStore();
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const convs = await messageService.getConversations(user.id);
      setConversations(convs);
      return convs;
    },
    enabled: !!user?.id,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = messageService.subscribeToConversations(user.id, () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    });
    return () => { channel?.unsubscribe(); };
  }, [user?.id]);

  return query;
}

export function useMessages(conversationId: string) {
  const { messages, setMessages, addMessage, setTyping } = useChatStore();
  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const userId = useAuthStore(s => s.user?.id);

  useQuery({
    queryKey: ['messages', conversationId, userId],
    queryFn: async () => {
      const msgs = await messageService.getMessages(conversationId, userId);
      setMessages(conversationId, msgs);
      return msgs;
    },
    enabled: !!conversationId && !!userId,
    staleTime: 0,
  });

  useEffect(() => {
    const onRealtimeMessage = (msg: Message) => {
      if (msg.conversationId === conversationId) addMessage(msg);
    };
    realtimeRef.current = messageService.subscribeToMessages(conversationId, onRealtimeMessage);

    return () => {
      realtimeRef.current?.unsubscribe();
    };
  }, [conversationId]);

  return messages[conversationId] || [];
}

export function useSendMessage(conversationId: string) {
  const { addMessage } = useChatStore();
  const user = useAuthStore(s => s.user);

  return useMutation({
    mutationFn: async (args: string | { content: string; type: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!conversationId) throw new Error('No conversation ID');
      const content = typeof args === 'string' ? args : args.content;
      const type = typeof args === 'string' ? 'text' : args.type;
      return messageService.sendMessage(conversationId, user.id, content, type);
    },
    onSuccess: (message) => {
      addMessage(message);
    },
    onError: (e: any) => {
      Alert.alert('Send failed', e.message || 'Could not send message. Please try again.');
    },
  });
}

export function useGetOrCreateConversation() {
  const user = useAuthStore(s => s.user);
  return async (partnerId: string): Promise<string> => {
    if (!user?.id) throw new Error('Not authenticated');
    return messageService.getOrCreateConversation(user.id, partnerId);
  };
}
