create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  match_id            uuid references public.matches(id) on delete set null,
  participant1_id     uuid not null references public.profiles(id) on delete cascade,
  participant2_id     uuid not null references public.profiles(id) on delete cascade,
  last_message        text default '',
  last_message_at     timestamptz default now(),
  unread_count1       int default 0,
  unread_count2       int default 0,
  created_at          timestamptz default now(),
  unique(participant1_id, participant2_id),
  check (participant1_id < participant2_id)
);

create index if not exists conversations_p1_idx          on public.conversations(participant1_id);
create index if not exists conversations_p2_idx          on public.conversations(participant2_id);
create index if not exists conversations_last_msg_at_idx on public.conversations(last_message_at desc);

alter table public.conversations enable row level security;

create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = participant1_id or auth.uid() = participant2_id);

create policy "System can create conversations"
  on public.conversations for insert
  with check (true);

create policy "Participants can update conversation metadata"
  on public.conversations for update
  using (auth.uid() = participant1_id or auth.uid() = participant2_id);
