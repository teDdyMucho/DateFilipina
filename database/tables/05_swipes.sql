create table if not exists public.swipes (
  id          uuid primary key default gen_random_uuid(),
  swiper_id   uuid not null references public.profiles(id) on delete cascade,
  swiped_id   uuid not null references public.profiles(id) on delete cascade,
  direction   text not null check (direction in ('like', 'pass', 'super_like')),
  created_at  timestamptz default now(),
  unique(swiper_id, swiped_id),
  check (swiper_id <> swiped_id)
);

create index if not exists swipes_swiper_idx  on public.swipes(swiper_id);
create index if not exists swipes_swiped_idx  on public.swipes(swiped_id);

alter table public.swipes enable row level security;

create policy "Users can see their own swipes"
  on public.swipes for select
  using (auth.uid() = swiper_id);

create policy "Users can create swipes"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

-- Trigger: auto-create a match when both users liked each other
create or replace function public.create_match_on_mutual_like()
returns trigger language plpgsql security definer as $$
begin
  if new.direction in ('like', 'super_like') then
    if exists (
      select 1 from public.swipes
      where swiper_id = new.swiped_id
        and swiped_id = new.swiper_id
        and direction in ('like', 'super_like')
    ) then
      insert into public.matches (user1_id, user2_id)
      values (least(new.swiper_id, new.swiped_id), greatest(new.swiper_id, new.swiped_id))
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_swipe_check_match on public.swipes;
create trigger on_swipe_check_match
  after insert on public.swipes
  for each row execute function public.create_match_on_mutual_like();
