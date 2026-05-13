-- Run in Supabase SQL Editor

grant all on public.swipes to authenticated;
grant all on public.matches to authenticated;

-- Allow system trigger to insert matches
drop policy if exists "System can insert matches" on public.matches;
create policy "System can insert matches"
  on public.matches for insert
  with check (true);

-- Allow users to update their own online status (drop first to avoid duplicate error)
drop policy if exists "Users can update own online status" on public.profiles;
create policy "Users can update own online status"
  on public.profiles for update
  using (auth.uid() = id);
