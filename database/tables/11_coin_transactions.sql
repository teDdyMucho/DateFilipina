create table if not exists public.coin_transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  amount           int not null,
  transaction_type text not null check (transaction_type in (
    'purchase', 'gift_sent', 'gift_received', 'welcome_bonus',
    'daily_bonus', 'refund', 'admin_adjustment'
  )),
  reference_id     uuid,
  description      text default '',
  created_at       timestamptz default now()
);

create index if not exists coin_tx_user_idx       on public.coin_transactions(user_id);
create index if not exists coin_tx_created_at_idx on public.coin_transactions(created_at desc);
create index if not exists coin_tx_type_idx       on public.coin_transactions(transaction_type);

alter table public.coin_transactions enable row level security;

create policy "Users can view their own transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

create policy "System can insert transactions"
  on public.coin_transactions for insert
  with check (true);
