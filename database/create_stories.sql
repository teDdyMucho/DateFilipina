-- ════════════════════════════════════════════════════════════════════════════
-- MY DAY (Stories) — 24-hour expiring posts visible in the friends ring strip.
-- Anyone authenticated can read non-expired stories; users can only insert /
-- delete their own. Expired rows are filtered at the query level; a separate
-- cleanup job (or pg_cron) can purge them physically.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  TEXT NOT NULL DEFAULT 'photo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS stories_user_id_idx     ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx  ON public.stories(expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stories_select ON public.stories;
CREATE POLICY stories_select ON public.stories
  FOR SELECT
  USING (expires_at > NOW());

DROP POLICY IF EXISTS stories_insert ON public.stories;
CREATE POLICY stories_insert ON public.stories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS stories_delete ON public.stories;
CREATE POLICY stories_delete ON public.stories
  FOR DELETE
  USING (auth.uid() = user_id);
