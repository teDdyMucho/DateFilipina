-- Migration: Update live_streams and gifts tables for live streaming feature
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to live_streams
alter table public.live_streams
  add column if not exists category text default 'Chat',
  add column if not exists is_live boolean default true,
  add column if not exists gift_total int default 0;

-- Copy is_active into is_live for existing rows
update public.live_streams set is_live = is_active;

-- 2. Create live_comments table
create table if not exists public.live_comments (
  id         uuid primary key default gen_random_uuid(),
  stream_id  uuid not null references public.live_streams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);

create index if not exists live_comments_stream_idx on public.live_comments(stream_id);
create index if not exists live_comments_created_idx on public.live_comments(created_at desc);

alter table public.live_comments enable row level security;

create policy "Anyone can read live comments"
  on public.live_comments for select using (true);

create policy "Authenticated users can insert comments"
  on public.live_comments for insert
  with check (auth.uid() = user_id);

-- 3. Enable realtime on live_comments and live_streams
alter publication supabase_realtime add table public.live_comments;
alter publication supabase_realtime add table public.live_streams;

-- 4. Add stream_id, gift_id, gift_name columns to gifts table (for live gifts)
alter table public.gifts
  add column if not exists stream_id uuid references public.live_streams(id) on delete set null,
  add column if not exists gift_id   text default '',
  add column if not exists gift_name text default '';

-- Make receiver_id nullable for live gifts (host may not have profile row link)
-- We will just relax the constraint by allowing NULL receiver when stream_id is set
-- Actually: keep receiver_id but set it to host_id. The liveService will need to pass it.
-- So we just add the columns; liveService.sendGift already inserts stream_id.

-- 5. RPC: increment_viewer_count
create or replace function public.increment_viewer_count(stream_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.live_streams set viewer_count = viewer_count + 1 where id = stream_id;
end;
$$;

-- 6. RPC: decrement_viewer_count
create or replace function public.decrement_viewer_count(stream_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.live_streams set viewer_count = greatest(0, viewer_count - 1) where id = stream_id;
end;
$$;

-- 7. RPC: add_gift_total
create or replace function public.add_gift_total(stream_id uuid, amount int)
returns void language plpgsql security definer as $$
begin
  update public.live_streams set gift_total = coalesce(gift_total, 0) + amount where id = stream_id;
end;
$$;

-- 8. Fix sync_profile_is_live trigger to use is_live column
create or replace function public.sync_profile_is_live()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set is_live = true where id = new.host_id;
  elsif tg_op = 'UPDATE' and new.is_live = false and old.is_live = true then
    update public.profiles set is_live = false where id = new.host_id;
  end if;
  return new;
end;
$$;

-- 9. Create avatars storage bucket (run separately if needed)
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
-- on conflict do nothing;

-- 10. Fix avatar_url: reset broken file:// paths AND fix svg -> png for Android compatibility
update public.profiles
  set avatar_url = 'https://api.dicebear.com/7.x/avataaars/png?seed=' || id
  where avatar_url like 'file://%'
     or avatar_url like '%avataaars/svg%'
     or avatar_url is null
     or avatar_url = '';
