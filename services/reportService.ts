import { supabase } from './supabase';

export type ReportTargetType = 'user' | 'post' | 'stream' | 'comment';

export const reportService = {
  /**
   * Submit a report. Called by regular users from the report sheet on
   * posts, profiles, streams, and comments.
   */
  async submitReport(targetType: ReportTargetType, targetId: string, reason: string): Promise<void> {
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw new Error(`Auth error: ${authErr.message}`);
    const reporterId = userRes.user?.id;
    if (!reporterId) throw new Error('You must be signed in to report.');

    const { error, status } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim(),
      status: 'pending',
    });

    if (error) {
      // Surface the actual database error so we can diagnose RLS / constraint issues
      console.log('[reports.insert] error', { status, error });
      const msg = error.message
        || (error as any).details
        || (error as any).hint
        || `HTTP ${status}: insert failed`;
      throw new Error(msg);
    }
  },
};

// Standard report reasons shown in the action sheet
export const REPORT_REASONS = [
  'Spam or scam',
  'Harassment or bullying',
  'Hate speech',
  'Nudity or sexual content',
  'Violence or threats',
  'Fake or impersonation',
  'Self-harm',
  'Underage user',
  'Other',
];
