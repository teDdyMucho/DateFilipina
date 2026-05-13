-- Run this in Supabase SQL Editor to fix RLS policies for messages tab

-- Allow authenticated users to create conversations with themselves as a participant
drop policy if exists "System can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (
    auth.uid() = participant1_id or auth.uid() = participant2_id
  );

-- Allow participants to update conversations (for marking read, last_message update via trigger)
drop policy if exists "Participants can update conversation metadata" on public.conversations;
create policy "Participants can update conversation metadata"
  on public.conversations for update
  using (auth.uid() = participant1_id or auth.uid() = participant2_id)
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

-- Allow participants to mark messages as read (update is_read)
drop policy if exists "Participants can mark messages read" on public.messages;
create policy "Participants can mark messages read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

-- Grant table access to authenticated role
grant all on public.conversations to authenticated;
grant all on public.messages to authenticated;
