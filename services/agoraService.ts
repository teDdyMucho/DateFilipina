import { supabase } from './supabase';

export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
// Static token fallback — only used if the token server is unreachable.
// Once the Supabase Edge Function is deployed this can stay blank.
export const AGORA_TEMP_TOKEN = process.env.EXPO_PUBLIC_AGORA_TEMP_TOKEN || '';
export const AGORA_TEST_CHANNEL = 'channel';

export function getRoomName(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('').replace(/-/g, '').substring(0, 64);
}

// ── Token server integration ────────────────────────────────────────────────
// Cache tokens per (channel + uid). Refresh 60s before expiry.

interface CachedToken {
  token: string;
  expiresAt: number; // unix seconds
}

const tokenCache = new Map<string, CachedToken>();

function cacheKey(channel: string, uid: number): string {
  return `${channel}:${uid}`;
}

/**
 * Fetch a fresh Agora RTC token from the Supabase Edge Function.
 * Falls back to the static EXPO_PUBLIC_AGORA_TEMP_TOKEN if the function fails
 * or isn't configured (so dev still works while the function is being set up).
 */
export async function getAgoraToken(channel: string, uid = 0, role: 'publisher' | 'subscriber' = 'publisher'): Promise<string> {
  const key = cacheKey(channel, uid);
  const cached = tokenCache.get(key);
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if more than 60s of life left
  if (cached && cached.expiresAt - now > 60) {
    return cached.token;
  }

  try {
    const { data, error } = await supabase.functions.invoke('agora-token', {
      body: { channel, uid, role, expirySeconds: 3600 },
    });
    if (error) throw new Error(error.message);
    if (!data?.token) throw new Error('No token in response');

    tokenCache.set(key, { token: data.token, expiresAt: data.expiresAt });
    return data.token;
  } catch (e) {
    console.log('[agora] token server unreachable, using fallback', (e as any)?.message);
    if (!AGORA_TEMP_TOKEN) throw new Error('No Agora token available. Deploy the agora-token Edge Function or set EXPO_PUBLIC_AGORA_TEMP_TOKEN in .env');
    return AGORA_TEMP_TOKEN;
  }
}
