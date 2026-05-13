import {
  MOCK_USERS, MOCK_FEED, MOCK_STORIES, MOCK_CONVERSATIONS,
  MOCK_MESSAGES, MOCK_LIVE_STREAMS, MOCK_DISCOVER_USERS,
  MOCK_NOTIFICATIONS, MOCK_CURRENT_USER,
} from './mockData';
import { User, FeedPost, Story, Conversation, Message, LiveStream, Notification } from '@/constants/types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const api = {
  auth: {
    login: async (email: string, _password: string) => {
      await delay(1200);
      if (!email) throw new Error('Invalid credentials');
      return { user: MOCK_CURRENT_USER, token: 'mock_token_xyz' };
    },
    register: async (_data: Partial<User>) => {
      await delay(1500);
      return { user: MOCK_CURRENT_USER, token: 'mock_token_xyz' };
    },
    logout: async () => {
      await delay(300);
      return true;
    },
  },

  feed: {
    getPosts: async (page = 1): Promise<FeedPost[]> => {
      await delay(800);
      return MOCK_FEED;
    },
    likePost: async (postId: string): Promise<boolean> => {
      await delay(200);
      return true;
    },
  },

  stories: {
    getStories: async (): Promise<Story[]> => {
      await delay(500);
      return MOCK_STORIES;
    },
  },

  discover: {
    getProfiles: async (): Promise<User[]> => {
      await delay(600);
      return MOCK_DISCOVER_USERS;
    },
    swipeRight: async (userId: string): Promise<{ isMatch: boolean }> => {
      await delay(300);
      return { isMatch: Math.random() > 0.7 };
    },
    swipeLeft: async (userId: string): Promise<void> => {
      await delay(100);
    },
  },

  messages: {
    getConversations: async (): Promise<Conversation[]> => {
      await delay(600);
      return MOCK_CONVERSATIONS;
    },
    getMessages: async (conversationId: string): Promise<Message[]> => {
      await delay(400);
      return MOCK_MESSAGES.filter(m => m.conversationId === conversationId);
    },
    sendMessage: async (conversationId: string, content: string, type = 'text'): Promise<Message> => {
      await delay(200);
      return {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId: 'me',
        content,
        type: type as Message['type'],
        timestamp: new Date(),
        read: false,
      };
    },
  },

  live: {
    getStreams: async (): Promise<LiveStream[]> => {
      await delay(500);
      return MOCK_LIVE_STREAMS;
    },
    joinStream: async (streamId: string) => {
      await delay(300);
      return { token: 'agora_token_mock', channel: streamId };
    },
    sendGift: async (streamId: string, giftId: string) => {
      await delay(200);
      return true;
    },
  },

  users: {
    getProfile: async (userId: string): Promise<User> => {
      await delay(400);
      return MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];
    },
    updateProfile: async (data: Partial<User>): Promise<User> => {
      await delay(600);
      return { ...MOCK_CURRENT_USER, ...data };
    },
    follow: async (userId: string) => {
      await delay(200);
      return true;
    },
  },

  wallet: {
    getBalance: async (): Promise<number> => {
      await delay(300);
      return MOCK_CURRENT_USER.coins;
    },
    purchaseCoins: async (packageId: string): Promise<number> => {
      await delay(1000);
      const amounts: Record<string, number> = {
        coins_100: 100,
        coins_500: 550,
        coins_1000: 1150,
        coins_3000: 3600,
        coins_5000: 6500,
      };
      return amounts[packageId] || 100;
    },
  },

  notifications: {
    getAll: async (): Promise<Notification[]> => {
      await delay(400);
      return MOCK_NOTIFICATIONS;
    },
    markRead: async (id: string) => {
      await delay(100);
      return true;
    },
  },
};
