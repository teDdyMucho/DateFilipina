// Supabase Edge Function: agora-token
// Generates fresh Agora RTC tokens on demand using the App Certificate.
//
// POST /functions/v1/agora-token
//   Body: { channel: string, uid?: number, role?: 'publisher' | 'subscriber', expirySeconds?: number }
//   Returns: { token: string, appId: string, channel: string, uid: number, expiresAt: number }
//
// Deploy: supabase functions deploy agora-token --no-verify-jwt
// Secrets required:
//   AGORA_APP_ID            — your Agora App ID
//   AGORA_APP_CERTIFICATE   — your Agora App Certificate (keep secret!)

// deno-lint-ignore-file no-explicit-any
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.5';

const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '';
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!APP_ID || !APP_CERTIFICATE) {
    return json({ error: 'Server not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE secrets.' }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const channel = String(body.channel ?? '').trim();
  if (!channel) {
    return json({ error: 'channel is required' }, 400);
  }

  const uid = Number(body.uid ?? 0);
  const role = body.role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const expirySeconds = Math.max(60, Math.min(86400, Number(body.expirySeconds ?? 3600)));
  const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      uid,
      role,
      expiresAt,
      expiresAt, // privilegeExpiredTs same as token expiry
    );
    return json({ token, appId: APP_ID, channel, uid, expiresAt });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Failed to generate token' }, 500);
  }
});
