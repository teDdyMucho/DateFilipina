import { supabase } from './supabase';

export type CallType = 'video' | 'audio';
export type CallStatus = 'ringing' | 'answered' | 'declined' | 'ended' | 'missed';

export interface CallSession {
  id: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  status: CallStatus;
  startedAt: Date;
  answeredAt?: Date;
}

export const callService = {
  // Caller initiates a call — creates a call_session row
  async startCall(callerId: string, calleeId: string, callType: CallType): Promise<CallSession> {
    // End any existing active calls from this caller first
    await supabase
      .from('call_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('caller_id', callerId)
      .in('status', ['ringing', 'answered']);

    const { data, error } = await supabase
      .from('call_sessions')
      .insert({ caller_id: callerId, callee_id: calleeId, call_type: callType, status: 'ringing' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      id: data.id,
      callerId: data.caller_id,
      calleeId: data.callee_id,
      callType: data.call_type,
      status: data.status,
      startedAt: new Date(data.started_at),
    };
  },

  // Callee answers
  async answerCall(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ status: 'answered', answered_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  // Callee declines
  async declineCall(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  // Either side ends the call
  async endCall(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  // Caller cancels while still ringing
  async cancelCall(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ status: 'missed', ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) throw new Error(error.message);
  },

  // Subscribe to call status changes (used by both caller and callee)
  subscribeToCall(sessionId: string, onUpdate: (status: CallStatus) => void) {
    return supabase
      .channel(`call:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        onUpdate((payload.new as any).status as CallStatus);
      })
      .subscribe();
  },

  // Callee subscribes to incoming calls targeting them
  subscribeToIncomingCalls(calleeId: string, onIncoming: (session: CallSession & { callerName: string; callerAvatar: string }) => void) {
    return supabase
      .channel(`incoming_calls:${calleeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_sessions',
        filter: `callee_id=eq.${calleeId}`,
      }, async (payload) => {
        const row = payload.new as any;
        if (row.status !== 'ringing') return;

        // Fetch caller profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', row.caller_id)
          .single();

        onIncoming({
          id: row.id,
          callerId: row.caller_id,
          calleeId: row.callee_id,
          callType: row.call_type,
          status: row.status,
          startedAt: new Date(row.started_at),
          callerName: profile?.name || 'Unknown',
          callerAvatar: profile?.avatar_url || '',
        });
      })
      .subscribe();
  },

  // Store push token for a user
  async savePushToken(userId: string, token: string): Promise<void> {
    await supabase
      .from('profiles')
      .update({ push_token: token } as any)
      .eq('id', userId);
  },
};
