-- Additional cross-table triggers and utility functions
-- (table-level triggers are defined in each table's own file)

-- Auto-create a profile row when a new auth.users entry is created
-- (backup in case the app fails to insert the profile after signUp)
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name, age)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce((new.raw_user_meta_data->>'age')::int, 18)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Function to award daily login bonus coins (call from app or cron)
create or replace function public.claim_daily_bonus(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  last_bonus timestamptz;
  bonus_amount int := 10;
begin
  select created_at into last_bonus
  from public.coin_transactions
  where user_id = p_user_id and transaction_type = 'daily_bonus'
  order by created_at desc
  limit 1;

  if last_bonus is not null and last_bonus > now() - interval '20 hours' then
    return 0;
  end if;

  update public.profiles set coins = coins + bonus_amount where id = p_user_id;

  insert into public.coin_transactions (user_id, amount, transaction_type, description)
  values (p_user_id, bonus_amount, 'daily_bonus', 'Daily login bonus');

  return bonus_amount;
end;
$$;

-- Function to get unread notification count for a user
create or replace function public.get_unread_notification_count(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from public.notifications
  where user_id = p_user_id and is_read = false;
  return cnt;
end;
$$;

-- Function to mark all notifications as read for a user
create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.notifications
  set is_read = true
  where user_id = p_user_id and is_read = false;
end;
$$;
