-- ════════════════════════════════════════════════════════════════════════════
--  MULTI-REACTION SUPPORT — a user can now apply multiple DIFFERENT reactions
--  to the same story (love + hot + cupid all at once). Tapping the SAME
--  reaction twice still toggles it off (one entry per type max).
--
--  Also adds notification throttling so toggling a reaction on/off rapidly
--  doesn't spam the story owner's bell.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop the old "one reaction per user per story" constraint (whatever
-- auto-generated name it has — try common variants).
ALTER TABLE public.story_reactions
  DROP CONSTRAINT IF EXISTS story_reactions_story_id_user_id_key;
ALTER TABLE public.story_reactions
  DROP CONSTRAINT IF EXISTS story_reactions_user_id_story_id_key;

-- Add new constraint allowing one row per (story, user, reaction type).
-- Postgres has no `IF NOT EXISTS` for ADD CONSTRAINT but DROP first is safe.
ALTER TABLE public.story_reactions
  DROP CONSTRAINT IF EXISTS story_reactions_story_user_reaction_key;
ALTER TABLE public.story_reactions
  ADD CONSTRAINT story_reactions_story_user_reaction_key
  UNIQUE (story_id, user_id, reaction);

-- Replace the notification trigger with one that throttles: only one bell
-- notification per (story, actor) per hour, regardless of how many times
-- they add/remove reactions in that window. This kills the spam from
-- rapidly toggling reactions.
CREATE OR REPLACE FUNCTION public.notify_on_story_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  story_owner   UUID;
  actor_name    TEXT;
  emoji_char    TEXT;
  recent_count  INT;
BEGIN
  SELECT user_id INTO story_owner FROM public.stories WHERE id = NEW.story_id;
  IF story_owner IS NULL OR story_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Throttle: skip if this actor has already notified this owner about this
  -- story in the last hour.
  SELECT COUNT(*) INTO recent_count
  FROM public.notifications
  WHERE user_id = story_owner
    AND actor_id = NEW.user_id
    AND type = 'reaction'
    AND (data->>'story_id') = NEW.story_id::text
    AND created_at > NOW() - INTERVAL '1 hour';
  IF recent_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;

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
