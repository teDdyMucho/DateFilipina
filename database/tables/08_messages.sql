create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  message_type    text default 'text' check (message_type in ('text', 'image', 'gift', 'voice')),
  media_url       text default '',
  is_read         boolean default false,
  created_at      timestamptz default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id);
create index if not exists messages_sender_idx       on public.messages(sender_id);
create index if not exists messages_created_at_idx   on public.messages(created_at desc);

alter table public.messages enable row level security;

create policy "Participants can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

create policy "Sender can delete their messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

-- Trigger: update conversation last_message and unread count on new message
create or replace function public.update_conversation_on_message()
returns trigger language plpgsql security definer as $$
declare
  conv public.conversations%rowtype;
begin
  select * into conv from public.conversations where id = new.conversation_id;

  if conv.participant1_id = new.sender_id then
    update public.conversations set
      last_message    = new.content,
      last_message_at = new.created_at,
      unread_count2   = unread_count2 + 1
    where id = new.conversation_id;
  else
    update public.conversations set
      last_message    = new.content,
      last_message_at = new.created_at,
      unread_count1   = unread_count1 + 1
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute function public.update_conversation_on_message();
