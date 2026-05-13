create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);

create index if not exists post_comments_post_idx on public.post_comments(post_id);
create index if not exists post_comments_user_idx on public.post_comments(user_id);

alter table public.post_comments enable row level security;

create policy "Anyone can view comments" on public.post_comments for select using (true);
create policy "Users can add comments" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.post_comments for delete using (auth.uid() = user_id);

grant all on public.post_comments to authenticated;

-- keep comments_count in sync
create or replace function public.update_post_comments_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_comment_change on public.post_comments;
create trigger on_post_comment_change
  after insert or delete on public.post_comments
  for each row execute function public.update_post_comments_count();
