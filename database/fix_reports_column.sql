-- ════════════════════════════════════════════════════════════════════════════
--  Adds the missing `resolution_note` column to reports.
--  Optional — the app already works without it. Run this if you want admins
--  to be able to attach a written note when resolving / ignoring a report.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;
