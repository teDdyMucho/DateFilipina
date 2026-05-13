import { create } from 'zustand';
import { Message, Conversation } from '@/constants/types';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setActiveConversation: (id: string | null) => void;
  markRead: (conversationId: string) => void;
  pinConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  typingUsers: {},
  activeConversationId: null,

  setConversations: (conversations) => set({ conversations }),

  setMessages: (conversationId, messages) =>
    set(state => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (message) => {
    const { messages, conversations } = get();
    const existing = messages[message.conversationId] || [];
    // Dedupe: don't add if a message with this id already exists
    if (existing.some(m => m.id === message.id)) return;
    const updated = [...existing, message];
    const updatedConvs = conversations.map(c =>
      c.id === message.conversationId
        ? { ...c, lastMessage: message.content, lastMessageTime: message.timestamp }
        : c
    );
    set({
      messages: { ...messages, [message.conversationId]: updated },
      conversations: updatedConvs,
    });
  },

  setTyping: (conversationId, userId, isTyping) => {
    const { typingUsers } = get();
    const current = typingUsers[conversationId] || [];
    const updated = isTyping
      ? [...new Set([...current, userId])]
      : current.filter(id => id !== userId);
    set({ typingUsers: { ...typingUsers, [conversationId]: updated } });
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  markRead: (conversationId) => {
    const { conversations } = get();
    set({
      conversations: conversations.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    });
  },

  pinConversation: (conversationId) => {
    const { conversations } = get();
    set({
      conversations: conversations.map(c =>
        c.id === conversationId ? { ...c, isPinned: !c.isPinned } : c
      ),
    });
  },

  deleteConversation: (conversationId) => {
    const { conversations, messages } = get();
    const { [conversationId]: _, ...remainingMessages } = messages;
    set({
      conversations: conversations.filter(c => c.id !== conversationId),
      messages: remainingMessages,
    });
  },
}));
