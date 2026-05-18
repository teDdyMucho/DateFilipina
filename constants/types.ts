export interface User {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  avatar: string;
  cover?: string;
  photos: string[];
  isOnline: boolean;
  isLive: boolean;
  isVerified: boolean;
  coins: number;
  followers: number;
  following: number;
  likes: number;
  interests: string[];
  occupation: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  canStream?: boolean;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  imageUrl: string;
  duration: number;
  seen: boolean;
  isLive: boolean;
}

export interface FeedPost {
  id: string;
  user: Pick<User, 'id' | 'name' | 'avatar' | 'isVerified' | 'isOnline'>;
  imageUrl: string;
  mediaUrls?: string[];
  mediaTypes?: Array<'photo' | 'video'>;
  mediaType?: 'photo' | 'video';
  caption: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  // Which reaction the current user picked on this post, if any
  // ('love' | 'wow' | 'hot' | 'sexy' | 'sad' | 'angry').
  myReaction?: 'love' | 'wow' | 'hot' | 'sexy' | 'sad' | 'angry' | null;
  timestamp: Date;
  sharedFrom?: { userId: string; userName: string; userAvatar: string };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'gift' | 'voice';
  timestamp: Date;
  read: boolean;
  imageUrl?: string;
  giftId?: string;
  // When set, this message is a reply to a My Day story. The chat bubble shows
  // a thumbnail preview if the story is still active (≤24h, not deleted).
  replyToStoryId?: string;
}

export interface Conversation {
  id: string;
  participant: Pick<User, 'id' | 'name' | 'avatar' | 'isOnline' | 'isVerified'>;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isPinned: boolean;
}

export interface LiveStream {
  id: string;
  host: Pick<User, 'id' | 'name' | 'avatar' | 'isVerified'>;
  title: string;
  thumbnail: string;
  viewerCount: number;
  isLive: boolean;
  category: string;
  giftTotal: number;
}

export interface Notification {
  id: string;
  type: 'like' | 'match' | 'message' | 'gift' | 'follow' | 'live';
  fromUser: Pick<User, 'id' | 'name' | 'avatar'>;
  content: string;
  timestamp: Date;
  read: boolean;
}
