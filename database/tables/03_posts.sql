create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  caption     text default '',
  media_urls  text[] default '{}',
  media_type  text default 'photo' check (media_type in ('photo', 'video')),
  likes_count int default 0,
  comments_count int default 0,
  created_at  timestamptz default now()
);

create index if not exists posts_user_idx       on public.posts(user_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

alter table public.posts enable row level security;

create policy "Anyone can view posts"
  on public.posts for select using (true);

create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);
