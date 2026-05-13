export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
export const AGORA_TEMP_TOKEN = process.env.EXPO_PUBLIC_AGORA_TEMP_TOKEN || '';
export const AGORA_TEST_CHANNEL = 'channel';

export function getRoomName(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('').replace(/-/g, '').substring(0, 64);
}
