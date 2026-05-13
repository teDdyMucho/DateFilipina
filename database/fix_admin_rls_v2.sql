-- ════════════════════════════════════════════════════════════════════════════
--  ADMIN RLS — v2: replaces the recursive inline EXISTS with a proper
--  SECURITY DEFINER helper function. This fixes:
--    1. Regular users locked out of profile load ("Could not load profile.")
--    2. Admin not seeing reports / other admin-only tables
--  Run this ONCE in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Helper function ────────────────────────────────────────────────────
-- SECURITY DEFINER + fixed search_path makes the inner profile lookup bypass
-- RLS (avoids infinite recursion when used in a profiles policy).

CREATE OR REPLACE FUNCTION public.user_is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_admin(uuid) TO authenticated, anon;

-- ── 2. Drop the broken inline EXISTS policies ─────────────────────────────
DROP POLICY IF EXISTS "admin_all_profiles"          ON public.profiles;
DROP POLICY IF EXISTS "admin_all_posts"             ON public.posts;
DROP POLICY IF EXISTS "admin_all_post_comments"     ON public.post_comments;
DROP POLICY IF EXISTS "admin_all_post_likes"        ON public.post_likes;
DROP POLICY IF EXISTS "admin_all_live_streams"      ON public.live_streams;
DROP POLICY IF EXISTS "admin_all_coin_transactions" ON public.coin_transactions;
DROP POLICY IF EXISTS "admin_all_follows"           ON public.follows;
DROP POLICY IF EXISTS "admin_select_user_blocks"    ON public.user_blocks;
DROP POLICY IF EXISTS "admin_select_conversations"  ON public.conversations;
DROP POLICY IF EXISTS "admin_all_reports"           ON public.reports;
DROP POLICY IF EXISTS "admin_select_actions"        ON public.admin_actions;
DROP POLICY IF EXISTS "admin_insert_actions"        ON public.admin_actions;
DROP POLICY IF EXISTS "admin_write_settings"        ON public.app_settings;

-- ── 3. Re-create policies using the SECURITY DEFINER function ────────────

CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_posts" ON public.posts
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_post_comments" ON public.post_comments
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_post_likes" ON public.post_likes
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_live_streams" ON public.live_streams
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_coin_transactions" ON public.coin_transactions
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_follows" ON public.follows
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_select_user_blocks" ON public.user_blocks
  FOR SELECT USING (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_select_conversations" ON public.conversations
  FOR SELECT USING (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_all_reports" ON public.reports
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_select_actions" ON public.admin_actions
  FOR SELECT USING (public.user_is_admin(auth.uid()));

CREATE POLICY "admin_insert_actions" ON public.admin_actions
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id AND public.user_is_admin(auth.uid()));

CREATE POLICY "admin_write_settings" ON public.app_settings
  FOR ALL
  USING      (public.user_is_admin(auth.uid()))
  WITH CHECK (public.user_is_admin(auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- After running this:
--   • Joshua and other regular users will be able to load their profile again.
--   • Admin can see all reports / users / posts / streams in the admin panel.
--   • No recursion, no SECURITY DEFINER quirks.
-- ════════════════════════════════════════════════════════════════════════════
