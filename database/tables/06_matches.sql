create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  user1_id   uuid not null references public.profiles(id) on delete cascade,
  user2_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user1_id, user2_id),
  check (user1_id < user2_id)
);

create index if not exists matches_user1_idx on public.matches(user1_id);
create index if not exists matches_user2_idx on public.matches(user2_id);

alter table public.matches enable row level security;

create policy "Users can view their own matches"
  on public.matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "System can insert matches"
  on public.matches for insert
  with check (true);
