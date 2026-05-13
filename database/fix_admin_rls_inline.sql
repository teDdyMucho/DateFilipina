-- ════════════════════════════════════════════════════════════════════════════
--  ADMIN RLS HARDENING — re-creates admin policies using an inline EXISTS check
--  instead of the is_admin() function, which can be flaky under SECURITY DEFINER.
--  Run this ONCE in Supabase SQL Editor if reports / admin queries return empty.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop the function-based policies
DROP POLICY IF EXISTS "admin_all_profiles"           ON public.profiles;
DROP POLICY IF EXISTS "admin_all_posts"              ON public.posts;
DROP POLICY IF EXISTS "admin_all_post_comments"      ON public.post_comments;
DROP POLICY IF EXISTS "admin_all_post_likes"         ON public.post_likes;
DROP POLICY IF EXISTS "admin_all_live_streams"       ON public.live_streams;
DROP POLICY IF EXISTS "admin_all_coin_transactions"  ON public.coin_transactions;
DROP POLICY IF EXISTS "admin_all_follows"            ON public.follows;
DROP POLICY IF EXISTS "admin_select_user_blocks"     ON public.user_blocks;
DROP POLICY IF EXISTS "admin_select_conversations"   ON public.conversations;
DROP POLICY IF EXISTS "admin_all_reports"            ON public.reports;
DROP POLICY IF EXISTS "admin_select_actions"         ON public.admin_actions;
DROP POLICY IF EXISTS "admin_insert_actions"         ON public.admin_actions;
DROP POLICY IF EXISTS "admin_write_settings"         ON public.app_settings;

-- Re-create with inline EXISTS — no function dependency
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_posts" ON public.posts
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_post_comments" ON public.post_comments
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_post_likes" ON public.post_likes
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_live_streams" ON public.live_streams
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_coin_transactions" ON public.coin_transactions
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_follows" ON public.follows
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_select_user_blocks" ON public.user_blocks
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_select_conversations" ON public.conversations
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_all_reports" ON public.reports
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_select_actions" ON public.admin_actions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "admin_insert_actions" ON public.admin_actions
  FOR INSERT
  WITH CHECK (
    auth.uid() = admin_id
    AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true)
  );

CREATE POLICY "admin_write_settings" ON public.app_settings
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.is_admin = true));

-- ════════════════════════════════════════════════════════════════════════════
--  After running this, the admin Reports queue (and all other admin tables)
--  should see every row again. No code changes needed.
-- ════════════════════════════════════════════════════════════════════════════
