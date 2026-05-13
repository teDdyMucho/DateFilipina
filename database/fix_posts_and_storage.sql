-- Run this in Supabase SQL Editor

-- 1. Grant post table access
grant all on public.posts to authenticated;
grant all on public.post_likes to authenticated;

-- 2. Create the media storage bucket (public)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 3. Storage RLS: allow authenticated users to upload to their own folder
create policy "Authenticated users can upload media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "Anyone can view media"
  on storage.objects for select
  to public
  using (bucket_id = 'media');

create policy "Users can delete their own media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'posts' and (storage.foldername(name))[2] = auth.uid()::text);
