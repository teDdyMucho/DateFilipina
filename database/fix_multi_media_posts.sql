-- ════════════════════════════════════════════════════════════════════════════
--  Adds per-item media_types array so a single post can mix photos and videos.
--  Optional — the app already works without it; first item's type is used as
--  a fallback for all items if the column is missing.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_types TEXT[] DEFAULT '{}'::text[];
