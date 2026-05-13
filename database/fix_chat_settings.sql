-- Chat settings: per-user conversation clear + user blocking
-- Run this once in the Supabase SQL Editor.

-- Per-user "clear conversation" — hides messages older than this timestamp
-- for the specific participant only (the other participant still sees them).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS cleared_at_p1 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cleared_at_p2 TIMESTAMPTZ;

-- User blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select_own" ON public.user_blocks;
CREATE POLICY "blocks_select_own" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON public.user_blocks;
CREATE POLICY "blocks_insert_own" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON public.user_blocks;
CREATE POLICY "blocks_delete_own" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Server-side rule: blocked users cannot insert messages into conversations
-- where the OTHER participant has blocked them.
DROP POLICY IF EXISTS "messages_insert_unless_blocked" ON public.messages;
CREATE POLICY "messages_insert_unless_blocked" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      JOIN public.conversations c ON c.id = messages.conversation_id
      WHERE b.blocked_id = auth.uid()
        AND b.blocker_id IN (c.participant1_id, c.participant2_id)
        AND b.blocker_id <> auth.uid()
    )
  );
