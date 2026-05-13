import { User, Story, FeedPost, Conversation, Message, LiveStream, Notification } from '@/constants/types';

const FILIPINA_NAMES = [
  'Maria Santos', 'Ana Reyes', 'Rosa Cruz', 'Elena Flores', 'Carmen Lopez',
  'Isabel Garcia', 'Luz Mendoza', 'Dolores Rivera', 'Consuelo Morales', 'Pilar Ramos',
  'Marites Dela Cruz', 'Rowena Bautista', 'Jasmine Villanueva', 'Lovely Castillo', 'Angel Fernandez',
];

const LOCATIONS = [
  'Manila', 'Cebu City', 'Davao', 'Quezon City', 'Makati',
  'Taguig', 'Pasig', 'Caloocan', 'Iloilo', 'Bacolod',
];

const OCCUPATIONS = [
  'Nurse', 'Teacher', 'Accountant', 'Engineer', 'Designer',
  'Doctor', 'Entrepreneur', 'Model', 'Artist', 'Student',
];

const INTERESTS = [
  'Cooking', 'Dancing', 'Singing', 'Travel', 'Reading',
  'Fitness', 'Photography', 'Fashion', 'Music', 'Movies',
  'Food', 'Nature', 'Family', 'Faith', 'Art',
];

const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400',
  'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=400',
  'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=400',
  'https://images.unsplash.com/photo-1521146764736-56c929d59c83?w=400',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=400',
  'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=400',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400',
  'https://images.unsplash.com/photo-1513379733131-47fc74b45fc7?w=400',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export const MOCK_CURRENT_USER: User = {
  id: 'me',
  name: 'John Smith',
  age: 32,
  location: 'Los Angeles, USA',
  bio: 'Looking for a genuine connection ❤️',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  photos: [],
  isOnline: true,
  isLive: false,
  isVerified: true,
  coins: 1250,
  followers: 0,
  following: 0,
  likes: 0,
  interests: ['Travel', 'Fitness', 'Music'],
  occupation: 'Software Engineer',
};

export const MOCK_USERS: User[] = FILIPINA_NAMES.map((name, i) => ({
  id: `user_${i + 1}`,
  name,
  age: 20 + Math.floor(Math.random() * 12),
  location: randomItem(LOCATIONS),
  bio: `Sweet ${name.split(' ')[0]} from ${randomItem(LOCATIONS)} 🌺 Love to cook, travel, and meet new friends!`,
  avatar: PHOTO_URLS[i] || PHOTO_URLS[0],
  photos: randomItems(PHOTO_URLS, 3),
  isOnline: Math.random() > 0.4,
  isLive: i < 3,
  isVerified: Math.random() > 0.6,
  coins: 0,
  followers: Math.floor(Math.random() * 50000),
  following: Math.floor(Math.random() * 500),
  likes: Math.floor(Math.random() * 100000),
  interests: randomItems(INTERESTS, 4),
  occupation: randomItem(OCCUPATIONS),
}));

export const MOCK_STORIES: Story[] = [
  {
    id: 'story_live_1',
    userId: MOCK_USERS[0].id,
    userName: MOCK_USERS[0].name,
    userAvatar: MOCK_USERS[0].avatar,
    imageUrl: MOCK_USERS[0].avatar,
    duration: 15,
    seen: false,
    isLive: true,
  },
  ...MOCK_USERS.slice(1, 10).map((u, i) => ({
    id: `story_${i}`,
    userId: u.id,
    userName: u.name,
    userAvatar: u.avatar,
    imageUrl: u.photos[0] || u.avatar,
    duration: 15,
    seen: i > 4,
    isLive: false,
  })),
];

export const MOCK_FEED: FeedPost[] = MOCK_USERS.slice(0, 10).map((u, i) => ({
  id: `post_${i}`,
  user: { id: u.id, name: u.name, avatar: u.avatar, isVerified: u.isVerified, isOnline: u.isOnline },
  imageUrl: PHOTO_URLS[(i + 5) % PHOTO_URLS.length],
  caption: [
    'Beautiful day in Manila! 🌸',
    'Missing the beach 🏖️ Cebu forever ❤️',
    'Sunday family lunch 🍚 Nothing beats home cooking!',
    'Dance practice today 💃 Loving every moment!',
    'Sunset views from BGC ✨ So blessed!',
    'Morning coffee and good vibes ☕',
    'Weekend getaway 🌴 Feeling refreshed!',
    'New day, new blessings 🙏',
    'Throwback to Boracay 🏝️',
    'Smile always 😊 Life is beautiful!',
  ][i],
  likes: Math.floor(Math.random() * 5000) + 100,
  comments: Math.floor(Math.random() * 200),
  isLiked: i % 3 === 0,
  timestamp: new Date(Date.now() - i * 3600000),
}));

export const MOCK_CONVERSATIONS: Conversation[] = MOCK_USERS.slice(0, 8).map((u, i) => ({
  id: `conv_${i}`,
  participant: { id: u.id, name: u.name, avatar: u.avatar, isOnline: u.isOnline, isVerified: u.isVerified },
  lastMessage: [
    'Hi! How are you? 😊',
    'I love your profile!',
    'Are you free this weekend?',
    'Thank you for the gift! 🌹',
    'Can we video call?',
    'You are so sweet ❤️',
    'Good morning!',
    'Miss you already 🥺',
  ][i],
  lastMessageTime: new Date(Date.now() - i * 3600000 * Math.random() * 5),
  unreadCount: i < 3 ? Math.floor(Math.random() * 5) + 1 : 0,
  isPinned: i === 0,
}));

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg_1',
    conversationId: 'conv_0',
    senderId: MOCK_USERS[0].id,
    content: 'Hi! I saw your profile and I think you are really nice 😊',
    type: 'text',
    timestamp: new Date(Date.now() - 7200000),
    read: true,
  },
  {
    id: 'msg_2',
    conversationId: 'conv_0',
    senderId: 'me',
    content: 'Thank you! Your profile is beautiful too ❤️',
    type: 'text',
    timestamp: new Date(Date.now() - 6900000),
    read: true,
  },
  {
    id: 'msg_3',
    conversationId: 'conv_0',
    senderId: MOCK_USERS[0].id,
    content: 'Where are you from?',
    type: 'text',
    timestamp: new Date(Date.now() - 6600000),
    read: true,
  },
  {
    id: 'msg_4',
    conversationId: 'conv_0',
    senderId: 'me',
    content: "I'm from the USA. You?",
    type: 'text',
    timestamp: new Date(Date.now() - 6300000),
    read: true,
  },
  {
    id: 'msg_5',
    conversationId: 'conv_0',
    senderId: MOCK_USERS[0].id,
    content: 'I am from Manila! I hope we can get to know each other more 🌸',
    type: 'text',
    timestamp: new Date(Date.now() - 6000000),
    read: true,
  },
  {
    id: 'msg_6',
    conversationId: 'conv_0',
    senderId: 'me',
    content: 'I would love that! Would you like to video call sometime?',
    type: 'text',
    timestamp: new Date(Date.now() - 5700000),
    read: true,
  },
  {
    id: 'msg_7',
    conversationId: 'conv_0',
    senderId: MOCK_USERS[0].id,
    content: 'Yes! I would like that 😍',
    type: 'text',
    timestamp: new Date(Date.now() - 300000),
    read: false,
  },
];

export const MOCK_LIVE_STREAMS: LiveStream[] = MOCK_USERS.filter(u => u.isLive).map((u, i) => ({
  id: `live_${i}`,
  host: { id: u.id, name: u.name, avatar: u.avatar, isVerified: u.isVerified },
  title: ['Dance Party 💃', 'Cooking Filipino Food 🍚', 'Q&A Time ❤️'][i] || 'Live Now',
  thumbnail: u.avatar,
  viewerCount: Math.floor(Math.random() * 5000) + 100,
  isLive: true,
  category: ['Dance', 'Food', 'Chat'][i] || 'General',
  giftTotal: Math.floor(Math.random() * 50000),
}));

export const MOCK_DISCOVER_USERS: User[] = [...MOCK_USERS].sort(() => Math.random() - 0.5);

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_1',
    type: 'match',
    fromUser: { id: MOCK_USERS[0].id, name: MOCK_USERS[0].name, avatar: MOCK_USERS[0].avatar },
    content: 'You matched with Maria Santos! Start chatting now 💕',
    timestamp: new Date(Date.now() - 300000),
    read: false,
  },
  {
    id: 'notif_2',
    type: 'like',
    fromUser: { id: MOCK_USERS[1].id, name: MOCK_USERS[1].name, avatar: MOCK_USERS[1].avatar },
    content: 'Ana Reyes liked your profile ❤️',
    timestamp: new Date(Date.now() - 1800000),
    read: false,
  },
  {
    id: 'notif_3',
    type: 'gift',
    fromUser: { id: MOCK_USERS[2].id, name: MOCK_USERS[2].name, avatar: MOCK_USERS[2].avatar },
    content: 'Rosa Cruz sent you a Rose 🌹',
    timestamp: new Date(Date.now() - 3600000),
    read: true,
  },
  {
    id: 'notif_4',
    type: 'live',
    fromUser: { id: MOCK_USERS[0].id, name: MOCK_USERS[0].name, avatar: MOCK_USERS[0].avatar },
    content: 'Maria Santos just went LIVE! Join now 📺',
    timestamp: new Date(Date.now() - 7200000),
    read: true,
  },
];
