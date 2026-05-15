export const Colors = {
  background: '#0F0F14',
  card: '#1A1A22',
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.08)',
  primary: '#D61A4E',
  primaryDark: '#5A0A1E',
  primaryMid: '#8A0F2A',
  primaryLight: '#FF3D6E',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B8',
  textMuted: '#6E6E73',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  tabBar: '#12121A',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(15,15,20,0.85)',
  separator: 'rgba(255,255,255,0.06)',
} as const;

// LinearGradient (expo-linear-gradient) requires a readonly tuple with at least
// two color stops. `as const` preserves the literal tuple shape required by the
// `[ColorValue, ColorValue, ...ColorValue[]]` type, instead of widening to string[].
export const Gradients = {
  primary: ['#5A0A1E', '#8A0F2A', '#D61A4E', '#FF3D6E'],
  primaryReverse: ['#FF3D6E', '#D61A4E', '#8A0F2A', '#5A0A1E'],
  card: ['#1A1A22', '#12121A'],
  overlay: ['transparent', 'rgba(15,15,20,0.95)'],
  liveOverlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'],
} as const;
