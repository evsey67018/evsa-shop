-- Минимальный вывод 50 ₽; владелец (∞) может делать тестовые выводы без списания.
alter table public.withdrawals drop constraint if exists withdrawals_amount_rub_check;
alter table public.withdrawals add constraint withdrawals_amount_rub_check check (amount_rub between 50 and 1000000);

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
  if p_amount < 50 or p_amount > 1000000 then raise exception 'below_min'; end if;
  if prof.telegram_id is null or prof.telegram_id <= 0 then raise exception 'no_telegram'; end if;
  if prof.username is null or prof.username = '' then raise exception 'no_username'; end if;
  if exists (select 1 from public.withdrawals x where x.user_id = me and x.status = 'pending') then
    raise exception 'pending_exists';
  end if;

  -- 3) списание (заморозка) суммы
  res := public.wallet_debit(me, p_amount);
  if res = 'unlimited' then res := 'ok'; end if;  -- владелец с ∞: тестовый вывод, баланс не трогаем
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
