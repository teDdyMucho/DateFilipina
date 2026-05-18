-- ════════════════════════════════════════════════════════════════════════════
--  MY DAY REACTIONS — quick emoji reactions sent from a story viewer to the
--  story owner. One reaction per (story, user) — upserting changes it.
--  Also adds a notification trigger so owners get an entry in their bell.
--  The 'reaction' type is added to the notifications type CHECK constraint.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_reactions_story_idx ON public.story_reactions(story_id);
CREATE INDEX IF NOT EXISTS story_reactions_user_idx  ON public.story_reactions(user_id);

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_reactions_select ON public.story_reactions;
CREATE POLICY story_reactions_select ON public.story_reactions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.stories WHERE id = story_id)
  );

DROP POLICY IF EXISTS story_reactions_insert ON public.story_reactions;
CREATE POLICY story_reactions_insert ON public.story_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS story_reactions_update ON public.story_reactions;
CREATE POLICY story_reactions_update ON public.story_reactions
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS story_reactions_delete ON public.story_reactions;
CREATE POLICY story_reactions_delete ON public.story_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Extend notification types to include 'reaction'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'match', 'message', 'like', 'follow', 'gift',
    'live_start', 'super_like', 'comment', 'share', 'reaction'
  ));

-- Story-reaction → bell notification
CREATE OR REPLACE FUNCTION public.notify_on_story_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  story_owner UUID;
  actor_name  TEXT;
  emoji_char  TEXT;
BEGIN
  SELECT user_id INTO story_owner FROM public.stories WHERE id = NEW.story_id;
  IF story_owner IS NULL OR story_owner = NEW.user_id THEN
    RETURN NEW; -- don't notify yourself / story already deleted
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;

  -- Translate reaction key → emoji for the body text
  emoji_char := CASE NEW.reaction
    WHEN 'cupid'   THEN '💘'
    WHEN 'match'   THEN '💕'
    WHEN 'love'    THEN '❤️'
    WHEN 'crush'   THEN '🥰'
    WHEN 'kiss'    THEN '😘'
    WHEN 'admire'  THEN '😍'
    WHEN 'hot'     THEN '🔥'
    WHEN 'flirt'   THEN '💋'
    WHEN 'romance' THEN '🌹'
    WHEN 'wow'     THEN '😮'
    ELSE '✨'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (
    story_owner,
    'reaction',
    'Story Reaction',
    COALESCE(actor_name, 'Someone') || ' reacted ' || emoji_char || ' to your My Day',
    NEW.user_id,
    jsonb_build_object('story_id', NEW.story_id, 'reaction', NEW.reaction)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_story_reaction_created ON public.story_reactions;
CREATE TRIGGER on_story_reaction_created
  AFTER INSERT ON public.story_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_story_reaction();
