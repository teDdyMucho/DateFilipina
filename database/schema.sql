-- ============================================================
-- DATE A FILIPINA — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- 2. FOLLOWS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(follower_id, following_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. POSTS (feed)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  image_url   text not null,
  caption     text default '',
  likes_count int default 0,
  comments_count int default 0,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. LIKES (posts)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. SWIPES (discover)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.swipes (
  id          uuid primary key default gen_random_uuid(),
  swiper_id   uuid not null references public.profiles(id) on delete cascade,
  swiped_id   uuid not null references public.profiles(id) on delete cascade,
  direction   text not null check (direction in ('left','right','super')),
  created_at  timestamptz default now(),
  unique(swiper_id, swiped_id)
);

-- ─────────────────────────────────────────────────────────────
-- 6. MATCHES
-- ─────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  user1_id    uuid not null references public.profiles(id) on delete cascade,
  user2_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user1_id, user2_id)
);

-- ─────────────────────────────────────────────────────────────
-- 7. CONVERSATIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user1_id        uuid not null references public.profiles(id) on delete cascade,
  user2_id        uuid not null references public.profiles(id) on delete cascade,
  last_message    text default '',
  last_message_at timestamptz default now(),
  created_at      timestamptz default now(),
  unique(user1_id, user2_id)
);

-- ─────────────────────────────────────────────────────────────
-- 8. MESSAGES
-- ─────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  type            text default 'text' check (type in ('text','image','gift','voice')),
  image_url       text,
  gift_id         text,
  is_read         boolean default false,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 9. LIVE STREAMS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.live_streams (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  thumbnail_url text default '',
  category      text default 'Chat',
  viewer_count  int default 0,
  gift_total    int default 0,
  is_live       boolean default true,
  started_at    timestamptz default now(),
  ended_at      timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 10. GIFTS (sent in live / chat)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.gifts (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  stream_id   uuid references public.live_streams(id) on delete set null,
  gift_type   text not null,
  coins_spent int not null,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 11. COIN TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coin_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      int not null,
  type        text not null check (type in ('purchase','spend','earn','bonus')),
  description text default '',
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  type        text not null check (type in ('like','match','message','gift','follow','live')),
  content     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_posts_user on public.posts(user_id, created_at desc);
create index if not exists idx_swipes_swiper on public.swipes(swiper_id);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_conversations_users on public.conversations(user1_id, user2_id);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────

-- Auto-create match when both users swipe right on each other
create or replace function public.check_mutual_swipe()
returns trigger as $$
begin
  if new.direction = 'right' then
    if exists (
      select 1 from public.swipes
      where swiper_id = new.swiped_id
        and swiped_id = new.swiper_id
        and direction = 'right'
    ) then
      insert into public.matches (user1_id, user2_id)
      values (least(new.swiper_id, new.swiped_id), greatest(new.swiper_id, new.swiped_id))
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_swipe_create
  after insert on public.swipes
  for each row execute function public.check_mutual_swipe();

-- Update follower/following counts
create or replace function public.update_follow_counts()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = following_count - 1 where id = old.follower_id;
    update public.profiles set followers_count = followers_count - 1 where id = old.following_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_follow_change
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

-- Deduct coins when sending gift
create or replace function public.deduct_coins_for_gift()
returns trigger as $$
begin
  update public.profiles set coins = coins - new.coins_spent where id = new.sender_id;
  update public.profiles set coins = coins + (new.coins_spent * 0.7)::int where id = new.receiver_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_gift_sent
  after insert on public.gifts
  for each row execute function public.deduct_coins_for_gift();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.notifications enable row level security;
alter table public.coin_transactions enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Messages: only conversation participants can read/write
create policy "Participants can read messages"
  on public.messages for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

create policy "Participants can send messages"
  on public.messages for insert with check (sender_id = auth.uid());

-- Notifications: only owner can read
create policy "Users read own notifications"
  on public.notifications for select using (user_id = auth.uid());

-- Coin transactions: only owner can read
create policy "Users read own transactions"
  on public.coin_transactions for select using (user_id = auth.uid());