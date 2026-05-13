-- Call sessions table — tracks live call state for signaling
create table if not exists public.call_sessions (
  id           uuid primary key default gen_random_uuid(),
  caller_id    uuid not null references public.profiles(id) on delete cascade,
  callee_id    uuid not null references public.profiles(id) on delete cascade,
  call_type    text not null check (call_type in ('video', 'audio')),
  status       text not null default 'ringing'
               check (status in ('ringing', 'answered', 'declined', 'ended', 'missed')),
  started_at   timestamptz default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  check (caller_id <> callee_id)
);

create index if not exists call_sessions_callee_idx  on public.call_sessions(callee_id, status);
create index if not exists call_sessions_caller_idx  on public.call_sessions(caller_id, status);

alter table public.call_sessions enable row level security;

create policy "Participants can view their calls"
  on public.call_sessions for select
  using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "Callers can create calls"
  on public.call_sessions for insert
  with check (auth.uid() = caller_id);

create policy "Participants can update call status"
  on public.call_sessions for update
  using (auth.uid() = caller_id or auth.uid() = callee_id);

grant all on public.call_sessions to authenticated;

-- Enable realtime so both caller and callee receive live updates
alter publication supabase_realtime add table public.call_sessions;
