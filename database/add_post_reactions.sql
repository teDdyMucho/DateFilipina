-- ════════════════════════════════════════════════════════════════════════════
--  POST REACTIONS — Facebook-style multi-emotion reactions on posts.
--  Each user can pick one of: love | wow | hot | sexy | sad | angry.
--  We re-use the existing post_likes table — adding a `reaction` column lets
--  every existing "like" remain valid as a 'love' reaction.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.post_likes
  ADD COLUMN IF NOT EXISTS reaction TEXT NOT NULL DEFAULT 'love';

-- Tighten with a check so a typo can't insert a bogus value.
ALTER TABLE public.post_likes
  DROP CONSTRAINT IF EXISTS post_likes_reaction_check;
ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_reaction_check
  CHECK (reaction IN ('love', 'wow', 'hot', 'sexy', 'sad', 'angry'));

CREATE INDEX IF NOT EXISTS post_likes_reaction_idx ON public.post_likes(post_id, reaction);
