-- EVSA SHOP — ручной вывод средств подарком за звёзды Telegram.
-- Поток: пользователь на сайте нажимает «Вывести» → request_withdrawal() сразу списывает (замораживает) сумму
-- и создаёт заявку 'pending' → бот (service role) присылает владельцу профиль и сумму → владелец вручную дарит
-- пользователю подарок за звёзды в Telegram и жмёт «✅ Вывод завершён» (withdrawal_complete) или
-- «❌ Отклонить» (withdrawal_reject — деньги возвращаются на баланс).
-- Реквизиты не собираются: выплата идёт на Telegram-аккаунт, к которому привязан вход на сайт.
-- Оценка звёзд — тот же курс, что у пополнения: stars_for_rub(rub) = round(rub * 0.8).

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_rub integer not null check (amount_rub between 100 and 1000000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  tg_id bigint not null check (tg_id > 0),
  tg_username text,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  notified_at timestamptz
);
create unique index if not exists withdrawals_user_request_uq on public.withdrawals(user_id, client_request_id);
-- не больше одной заявки «В ожидании» на пользователя (страховка поверх проверки в RPC)
create unique index if not exists withdrawals_one_pending_uq on public.withdrawals(user_id) where status = 'pending';
create index if not exists withdrawals_user_idx on public.withdrawals(user_id, created_at desc);
create index if not exists withdrawals_unnotified_idx on public.withdrawals(created_at) where notified_at is null and status = 'pending';

alter table public.withdrawals enable row level security;
revoke all on public.withdrawals from anon, authenticated;
grant select on public.withdrawals to authenticated;
-- INSERT/UPDATE/DELETE для клиентов нет: только через RPC ниже.
drop policy if exists withdrawals_read on public.withdrawals;
create policy withdrawals_read on public.withdrawals for select to authenticated
  using (user_id = auth.uid() or public.is_shop_owner());

-- ---------- заявка на вывод (пользователь сайта) ----------
-- Результат jsonb: {status: ok|duplicate|insufficient, withdrawal_id, amount, balance}
-- Ошибки (raise): not_signed_in, bad_request, banned, below_min, owner_unlimited, no_telegram, no_username, pending_exists
create or replace function public.request_withdrawal(p_amount integer, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prof public.profiles%rowtype;
  w public.wallets%rowtype;
  d public.withdrawals%rowtype;
  res text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_amount is null or p_request_id is null then raise exception 'bad_request'; end if;

  -- 1) кошелёк под замок: заявки и покупки одного пользователя идут строго по очереди
  select * into w from public.wallets where user_id = me for update;

  -- 2) повтор того же запроса → та же заявка, без второго списания
  select * into d from public.withdrawals where user_id = me and client_request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'withdrawal_id', d.id, 'amount', d.amount_rub,
                              'withdrawal_status', d.status, 'balance', coalesce(w.balance, 0));
  end if;

  select * into prof from public.profiles where id = me;
  if not found or prof.banned then raise exception 'banned'; end if;
  if w.unlimited or prof.telegram_id = 5327129904 then raise exception 'owner_unlimited'; end if;
  if p_amount < 100 or p_amount > 1000000 then raise exception 'below_min'; end if;
  if prof.telegram_id is null or prof.telegram_id <= 0 then raise exception 'no_telegram'; end if;
  if prof.username is null or prof.username = '' then raise exception 'no_username'; end if;
  if exists (select 1 from public.withdrawals x where x.user_id = me and x.status = 'pending') then
    raise exception 'pending_exists';
  end if;

  -- 3) списание (заморозка) суммы
  res := public.wallet_debit(me, p_amount);
  if res <> 'ok' then
    return jsonb_build_object('status', case when res = 'unlimited' then 'owner_unlimited' else res end,
                              'amount', p_amount, 'balance', coalesce(w.balance, 0));
  end if;

  insert into public.withdrawals (user_id, amount_rub, tg_id, tg_username, client_request_id)
  values (me, p_amount, prof.telegram_id, prof.username, p_request_id)
  returning * into d;

  select * into w from public.wallets where user_id = me;
  return jsonb_build_object('status', 'ok', 'withdrawal_id', d.id, 'amount', d.amount_rub,
                            'withdrawal_status', d.status, 'balance', w.balance);
end $$;
revoke execute on function public.request_withdrawal(integer, uuid) from public, anon;
grant execute on function public.request_withdrawal(integer, uuid) to authenticated;

-- ---------- владелец (бот, service role): завершить / отклонить ----------
-- Результат jsonb: {status: ok|already|conflict|not_found, withdrawal_status, amount, user_id, tg_id, balance}
create or replace function public.withdrawal_complete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.withdrawals%rowtype;
begin
  select * into d from public.withdrawals where id = p_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if d.status = 'completed' then
    return jsonb_build_object('status', 'already', 'withdrawal_status', d.status, 'amount', d.amount_rub, 'user_id', d.user_id, 'tg_id', d.tg_id);
  end if;
  if d.status <> 'pending' then
    return jsonb_build_object('status', 'conflict', 'withdrawal_status', d.status, 'amount', d.amount_rub, 'user_id', d.user_id, 'tg_id', d.tg_id);
  end if;
  update public.withdrawals set status = 'completed', processed_at = now() where id = d.id;
  return jsonb_build_object('status', 'ok', 'withdrawal_status', 'completed', 'amount', d.amount_rub, 'user_id', d.user_id, 'tg_id', d.tg_id);
end $$;

create or replace function public.withdrawal_reject(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.withdrawals%rowtype;
  bal numeric(12,2);
begin
  select * into d from public.withdrawals where id = p_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if d.status = 'rejected' then
    return jsonb_build_object('status', 'already', 'withdrawal_status', d.status, 'amount', d.amount_rub, 'user_id', d.user_id, 'tg_id', d.tg_id);
  end if;
  if d.status <> 'pending' then
    return jsonb_build_object('status', 'conflict', 'withdrawal_status', d.status, 'amount', d.amount_rub, 'user_id', d.user_id, 'tg_id', d.tg_id);
  end if;
  update public.withdrawals set status = 'rejected', processed_at = now() where id = d.id;
  -- возврат замороженной суммы
  insert into public.wallets (user_id, balance, updated_at) values (d.user_id, d.amount_rub, now())
  on conflict (user_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now()
  returning balance into bal;
  return jsonb_build_object('status', 'ok', 'withdrawal_status', 'rejected', 'amount', d.amount_rub, 'user_id', d.user_id,
                            'tg_id', d.tg_id, 'balance', bal);
end $$;

revoke execute on function public.withdrawal_complete(uuid) from public, anon, authenticated;
revoke execute on function public.withdrawal_reject(uuid) from public, anon, authenticated;
grant execute on function public.withdrawal_complete(uuid) to service_role;
grant execute on function public.withdrawal_reject(uuid) to service_role;
grant select, update (notified_at) on public.withdrawals to service_role;

-- статус заявки обновляется на сайте сразу
do $$ begin
  alter publication supabase_realtime add table public.withdrawals;
exception when duplicate_object then null; end $$;
