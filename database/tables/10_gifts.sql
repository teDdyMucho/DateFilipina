create table if not exists public.gifts (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  gift_type    text not null,
  gift_emoji   text not null,
  coin_cost    int not null check (coin_cost > 0),
  message      text default '',
  created_at   timestamptz default now(),
  check (sender_id <> receiver_id)
);

create index if not exists gifts_sender_idx   on public.gifts(sender_id);
create index if not exists gifts_receiver_idx on public.gifts(receiver_id);

alter table public.gifts enable row level security;

create policy "Users can see gifts they sent or received"
  on public.gifts for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send gifts"
  on public.gifts for insert
  with check (auth.uid() = sender_id);

-- Trigger: deduct coins from sender and log the transaction
create or replace function public.process_gift_payment()
returns trigger language plpgsql security definer as $$
declare
  sender_coins int;
begin
  select coins into sender_coins from public.profiles where id = new.sender_id;

  if sender_coins < new.coin_cost then
    raise exception 'Insufficient coins';
  end if;

  update public.profiles set coins = coins - new.coin_cost where id = new.sender_id;

  insert into public.coin_transactions (user_id, amount, transaction_type, reference_id, description)
  values (new.sender_id, -new.coin_cost, 'gift_sent', new.id, 'Sent ' || new.gift_emoji || ' gift');

  return new;
end;
$$;

drop trigger if exists on_gift_sent on public.gifts;
create trigger on_gift_sent
  before insert on public.gifts
  for each row execute function public.process_gift_payment();
