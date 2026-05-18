-- ════════════════════════════════════════════════════════════════════════════
--  Adds reply_to_story_id to messages so a reply sent from the My Day viewer
--  can show the original story thumbnail in the chat bubble. The reference
--  is intentionally non-FK: when a story is deleted or expires past 24h,
--  the column keeps the id but the lookup returns nothing, so the bubble
--  silently falls back to plain text.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_story_id UUID;
