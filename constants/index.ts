export * from './colors';

export const APP_NAME = 'Date A Filipina';

export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
  spring: { damping: 15, stiffness: 150 },
  springBounce: { damping: 10, stiffness: 200 },
} as const;

export const LAYOUT = {
  cardRadius: 20,
  buttonRadius: 14,
  inputRadius: 12,
  avatarSize: 56,
  tabBarHeight: 80,
} as const;

export const COIN_PACKAGES = [
  { id: 'coins_100', coins: 100, price: '$0.99', bonus: 0, popular: false },
  { id: 'coins_500', coins: 500, price: '$3.99', bonus: 50, popular: false },
  { id: 'coins_1000', coins: 1000, price: '$6.99', bonus: 150, popular: true },
  { id: 'coins_3000', coins: 3000, price: '$17.99', bonus: 600, popular: false },
  { id: 'coins_5000', coins: 5000, price: '$27.99', bonus: 1500, popular: false },
] as const;

export const GIFTS = [
  { id: 'rose', name: 'Rose', emoji: '🌹', coins: 10 },
  { id: 'heart', name: 'Heart', emoji: '❤️', coins: 20 },
  { id: 'diamond', name: 'Diamond', emoji: '💎', coins: 50 },
  { id: 'crown', name: 'Crown', emoji: '👑', coins: 100 },
  { id: 'car', name: 'Car', emoji: '🏎️', coins: 500 },
  { id: 'yacht', name: 'Yacht', emoji: '🛥️', coins: 1000 },
] as const;
