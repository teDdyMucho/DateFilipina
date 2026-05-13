-- Add shared-from columns to posts so we can track repost origins
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS shared_from_user_id   UUID,
  ADD COLUMN IF NOT EXISTS shared_from_user_name  TEXT,
  ADD COLUMN IF NOT EXISTS shared_from_user_avatar TEXT;
