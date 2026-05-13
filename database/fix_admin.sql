-- ════════════════════════════════════════════════════════════════════════════
--  ADMIN PANEL MIGRATION
--  Run this ONCE in the Supabase SQL Editor.
--  After running, create Admin@gmail.com via Supabase Auth then run the
--  one-line UPDATE at the bottom to grant admin rights.
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PROFILES — add admin / banned / streaming flags
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason  TEXT,
  ADD COLUMN IF NOT EXISTS can_stream     BOOLEAN DEFAULT true;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. POSTS — add moderation flags
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_posts_hidden ON public.posts(is_hidden) WHERE is_hidden = false;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. REPORTS table — user reports of posts / users / streams / comments
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'stream', 'comment')),
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_status   ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target   ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. ADMIN_ACTIONS — every admin action is logged here
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     UUID,
  details       JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin   ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action  ON public.admin_actions(action);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target  ON public.admin_actions(target_type, target_id);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
-- No regular-user access. Admins access via service role / explicit admin policies below.

-- ──────────────────────────────────────────────────────────────────────────
-- 5. APP_SETTINGS — single key/value table for system config
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can READ settings (needed for maintenance mode / version checks at boot)
DROP POLICY IF EXISTS "settings_select_all" ON public.app_settings;
CREATE POLICY "settings_select_all" ON public.app_settings
  FOR SELECT USING (true);

-- Seed default settings (only inserts if key doesn't exist)
INSERT INTO public.app_settings (key, value) VALUES
  ('maintenance_mode',  'false'::jsonb),
  ('announcement',      'null'::jsonb),
  ('min_app_version',   '"1.0.0"'::jsonb),
  ('interest_tags',     '["Fitness","Gaming","Art","Photography","Cooking","Reading","Movies","Dance","Music","Travel","Sports","Hiking"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RLS — ADMIN BYPASS POLICIES
--    Admins can SELECT / UPDATE / DELETE any row on these tables.
-- ──────────────────────────────────────────────────────────────────────────

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- posts
DROP POLICY IF EXISTS "admin_all_posts" ON public.posts;
CREATE POLICY "admin_all_posts" ON public.posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- post_comments
DROP POLICY IF EXISTS "admin_all_post_comments" ON public.post_comments;
CREATE POLICY "admin_all_post_comments" ON public.post_comments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- post_likes
DROP POLICY IF EXISTS "admin_all_post_likes" ON public.post_likes;
CREATE POLICY "admin_all_post_likes" ON public.post_likes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- live_streams
DROP POLICY IF EXISTS "admin_all_live_streams" ON public.live_streams;
CREATE POLICY "admin_all_live_streams" ON public.live_streams
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- coin_transactions
DROP POLICY IF EXISTS "admin_all_coin_transactions" ON public.coin_transactions;
CREATE POLICY "admin_all_coin_transactions" ON public.coin_transactions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- follows
DROP POLICY IF EXISTS "admin_all_follows" ON public.follows;
CREATE POLICY "admin_all_follows" ON public.follows
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_blocks (read-only for admin; admins shouldn't manipulate user blocks)
DROP POLICY IF EXISTS "admin_select_user_blocks" ON public.user_blocks;
CREATE POLICY "admin_select_user_blocks" ON public.user_blocks
  FOR SELECT USING (public.is_admin());

-- conversations (read-only; we are NOT giving admin access to messages)
DROP POLICY IF EXISTS "admin_select_conversations" ON public.conversations;
CREATE POLICY "admin_select_conversations" ON public.conversations
  FOR SELECT USING (public.is_admin());

-- reports
DROP POLICY IF EXISTS "admin_all_reports" ON public.reports;
CREATE POLICY "admin_all_reports" ON public.reports
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- admin_actions (admins can read all, insert their own)
DROP POLICY IF EXISTS "admin_select_actions" ON public.admin_actions;
CREATE POLICY "admin_select_actions" ON public.admin_actions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_actions" ON public.admin_actions;
CREATE POLICY "admin_insert_actions" ON public.admin_actions
  FOR INSERT WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

-- app_settings (admin write)
DROP POLICY IF EXISTS "admin_write_settings" ON public.app_settings;
CREATE POLICY "admin_write_settings" ON public.app_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- 7. RLS — BANNED USER RESTRICTIONS
--    Banned users cannot post, comment, message, or start live streams.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_banned = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_stream()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND can_stream = true AND is_banned = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Block banned users from posting
DROP POLICY IF EXISTS "no_posts_if_banned" ON public.posts;
CREATE POLICY "no_posts_if_banned" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND NOT public.is_banned()
  );

-- Block banned users from commenting
DROP POLICY IF EXISTS "no_comments_if_banned" ON public.post_comments;
CREATE POLICY "no_comments_if_banned" ON public.post_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND NOT public.is_banned()
  );

-- Block banned users from messaging
DROP POLICY IF EXISTS "no_messages_if_banned" ON public.messages;
CREATE POLICY "no_messages_if_banned" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND NOT public.is_banned()
  );

-- Block banned / no-stream users from going live
DROP POLICY IF EXISTS "no_live_if_blocked" ON public.live_streams;
CREATE POLICY "no_live_if_blocked" ON public.live_streams
  FOR INSERT WITH CHECK (
    auth.uid() = host_id AND public.can_stream()
  );

-- ════════════════════════════════════════════════════════════════════════════
--  AFTER RUNNING THIS SCRIPT:
--    1. Sign up Admin@gmail.com / 123456789 via the app's normal register flow
--       (or via Supabase Dashboard → Authentication → Add user).
--    2. Then run THIS one-liner to grant admin:
--
--    UPDATE public.profiles SET is_admin = true
--    WHERE id = (SELECT id FROM auth.users WHERE email ILIKE 'Admin@gmail.com');
--
--    3. Sign in as Admin@gmail.com in the app — Admin tab appears automatically.
-- ════════════════════════════════════════════════════════════════════════════
