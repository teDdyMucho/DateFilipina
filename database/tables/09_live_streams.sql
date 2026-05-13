create table if not exists public.live_streams (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references public.profiles(id) on delete cascade,
  title         text default 'Live',
  thumbnail_url text default '',
  viewer_count  int default 0,
  is_active     boolean default true,
  started_at    timestamptz default now(),
  ended_at      timestamptz
);

create index if not exists live_streams_host_idx    on public.live_streams(host_id);
create index if not exists live_streams_active_idx  on public.live_streams(is_active) where is_active = true;
create index if not exists live_streams_started_idx on public.live_streams(started_at desc);

alter table public.live_streams enable row level security;

create policy "Anyone can view live streams"
  on public.live_streams for select using (true);

create policy "Users can create their own live stream"
  on public.live_streams for insert
  with check (auth.uid() = host_id);

create policy "Users can update their own live stream"
  on public.live_streams for update
  using (auth.uid() = host_id);

-- Trigger: sync profiles.is_live with active streams
create or replace function public.sync_profile_is_live()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set is_live = true where id = new.host_id;
  elsif tg_op = 'UPDATE' and new.is_active = false and old.is_active = true then
    update public.profiles set is_live = false where id = new.host_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_live_stream_change on public.live_streams;
create trigger on_live_stream_change
  after insert or update on public.live_streams
  for each row execute function public.sync_profile_is_live();
