-- Cover (banner) photo for profiles
-- Run once in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Optional: ensure the 'avatars' storage bucket holds covers too (no separate bucket needed).
-- Covers are stored under path 'covers/<user_id>.jpg' inside the same bucket.
