create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  type              text not null check (type in (
    'match', 'message', 'like', 'follow', 'gift', 'live_start', 'super_like'
  )),
  title             text not null,
  body              text not null,
  data              jsonb default '{}',
  is_read           boolean default false,
  actor_id          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz default now()
);

create index if not exists notifications_user_idx       on public.notifications(user_id);
create index if not exists notifications_unread_idx     on public.notifications(user_id) where is_read = false;
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "System can create notifications"
  on public.notifications for insert
  with check (true);

create policy "Users can mark their notifications as read"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Trigger: create match notifications for both users when a match is created
create or replace function public.notify_on_match()
returns trigger language plpgsql security definer as $$
declare
  u1 public.profiles%rowtype;
  u2 public.profiles%rowtype;
begin
  select * into u1 from public.profiles where id = new.user1_id;
  select * into u2 from public.profiles where id = new.user2_id;

  insert into public.notifications (user_id, type, title, body, actor_id, data)
  values
    (new.user1_id, 'match', 'New Match!', 'You matched with ' || u2.name || '!', new.user2_id, jsonb_build_object('match_id', new.id)),
    (new.user2_id, 'match', 'New Match!', 'You matched with ' || u1.name || '!', new.user1_id, jsonb_build_object('match_id', new.id));

  return new;
end;
$$;

drop trigger if exists on_match_created on public.matches;
create trigger on_match_created
  after insert on public.matches
  for each row execute function public.notify_on_match();
