-- Run in Supabase SQL Editor
-- Replace the swipes SELECT policy so users can also see swipes made ON them
-- (needed to show "Likes Me" tab in Messages)

drop policy if exists "Users can see their own swipes" on public.swipes;
drop policy if exists "Users can see swipes on them" on public.swipes;

create policy "Users can see relevant swipes"
  on public.swipes for select
  using (auth.uid() = swiper_id or auth.uid() = swiped_id);
