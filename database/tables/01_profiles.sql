-- ============================================================
-- TABLE: profiles
-- Run this FIRST — all other tables reference this one
-- Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  name            text not null,
  age             int not null check (age >= 18),
  bio             text default '',
  location        text default '',
  occupation      text default '',
  avatar_url      text default '',
  photos          text[] default '{}',
  interests       text[] default '{}',
  coins           int default 100,
  is_online       boolean default false,
  is_live         boolean default false,
  is_verified     boolean default false,
  followers_count int default 0,
  following_count int default 0,
  likes_count     int default 0,
  last_seen_at    timestamptz default now(),
  created_at      timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;

create policy "Anyone can view profiles"
  on public.profiles for select using (true);

-- Allow insert from the app (user just signed up, session is fresh)
-- and from security definer triggers (auth.uid() may be null in triggers,
-- so we allow insert when id matches a real auth.users row)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    auth.uid() = id
    or exists (select 1 from auth.users where auth.users.id = profiles.id)
  );

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
