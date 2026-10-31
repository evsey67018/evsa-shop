-- EVSA SHOP — пополнение баланса через Telegram Stars (XTR).
-- Сайт НЕ может менять баланс: зачисление делает только бот (service role) через stars_credit().
-- Курс: звёзд = round(рубли * 0.8), минимум 1 (скидка 20%). Сумма — целые рубли от 10 до 12 500.

-- ---------- кошелёк (баланс в рублях) ----------
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
revoke all on public.wallets from anon, authenticated;
grant select on public.wallets to authenticated;
create policy wallets_read_own on public.wallets for select to authenticated using (user_id = auth.uid());
-- INSERT/UPDATE/DELETE для клиентов нет вообще.

-- ---------- платежи звёздами ----------
create table public.star_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload text not null unique check (payload ~ '^stars_[0-9a-f]{32}$'),
  amount_rub integer not null check (amount_rub between 10 and 12500),
  stars integer not null check (stars >= 1),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  invoice_link text,
  payer_telegram_id bigint,
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index star_payments_user_idx on public.star_payments(user_id, created_at desc);
alter table public.star_payments enable row level security;
revoke all on public.star_payments from anon, authenticated;
-- пользователь видит только свои пополнения (без служебных id платежа)
grant select (id, user_id, amount_rub, stars, status, created_at, paid_at) on public.star_payments to authenticated;
create policy star_payments_read_own on public.star_payments for select to authenticated using (user_id = auth.uid());

create or replace function public.stars_for_rub(rub integer) returns integer
language sql immutable as $$ select greatest(1, round(rub * 0.8))::integer $$;

-- ---------- создать счёт (только service role: Edge Function create-stars-invoice и бот) ----------
-- p_user_id или p_telegram_id — кому зачислить. Возвращает payload и число звёзд.
create or replace function public.stars_create_payment(p_amount integer, p_user_id uuid default null, p_telegram_id bigint default null)
returns table (payment_id uuid, payload text, amount_rub integer, stars integer, user_id uuid, telegram_id bigint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  prof record;
  pl text := 'stars_' || replace(gen_random_uuid()::text, '-', '');
  pid uuid;
begin
  if p_amount is null or p_amount < 10 or p_amount > 12500 then raise exception 'bad_amount'; end if;
  if p_user_id is not null then
    select p.id, p.telegram_id, p.banned into prof from public.profiles p where p.id = p_user_id;
  else
    select p.id, p.telegram_id, p.banned into prof from public.profiles p where p.telegram_id = p_telegram_id;
  end if;
  if prof.id is null then raise exception 'no_profile'; end if;
  if prof.banned then raise exception 'banned'; end if;
  if (select count(*) from public.star_payments s where s.user_id = prof.id and s.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many';
  end if;
  insert into public.star_payments (user_id, payload, amount_rub, stars)
  values (prof.id, pl, p_amount, public.stars_for_rub(p_amount)) returning id into pid;
  return query select pid, pl, p_amount, public.stars_for_rub(p_amount), prof.id, prof.telegram_id;
end $$;

-- ---------- pre_checkout_query: можно ли принять оплату ----------
create or replace function public.stars_precheck(p_payload text, p_total integer, p_currency text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.star_payments s join public.profiles p on p.id = s.user_id
    where s.payload = p_payload and s.status = 'pending' and p_currency = 'XTR' and s.stars = p_total
      and s.created_at > now() - interval '24 hours' and not p.banned)
$$;

-- ---------- successful_payment: однократное зачисление ----------
-- Результат: credited | duplicate (этот charge_id уже зачислен) | conflict (оплата не подходит — вернуть звёзды)
create or replace function public.stars_credit(p_payload text, p_charge_id text, p_provider_charge_id text,
                                               p_payer_telegram_id bigint, p_total integer, p_currency text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.star_payments%rowtype;
  bal numeric(12,2);
begin
  if p_charge_id is null or p_charge_id = '' then raise exception 'no_charge_id'; end if;
  -- тот же платёж уже обработан (повтор/ретрай) — ничего не делаем
  select * into s from public.star_payments where telegram_payment_charge_id = p_charge_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'amount', s.amount_rub, 'user_id', s.user_id);
  end if;
  select * into s from public.star_payments where payload = p_payload for update;
  if found and s.telegram_payment_charge_id = p_charge_id then  -- параллельный повтор того же платежа
    return jsonb_build_object('status', 'duplicate', 'amount', s.amount_rub, 'user_id', s.user_id);
  end if;
  if not found or s.status <> 'pending' or p_currency <> 'XTR' or s.stars <> p_total then
    return jsonb_build_object('status', 'conflict', 'reason',
      case when not found then 'not_found' when s.status <> 'pending' then 'already_' || s.status else 'amount_mismatch' end);
  end if;
  update public.star_payments set status = 'paid', paid_at = now(), telegram_payment_charge_id = p_charge_id,
    provider_payment_charge_id = p_provider_charge_id, payer_telegram_id = p_payer_telegram_id
  where id = s.id;
  insert into public.wallets (user_id, balance, updated_at) values (s.user_id, s.amount_rub, now())
  on conflict (user_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now()
  returning balance into bal;
  return jsonb_build_object('status', 'credited', 'amount', s.amount_rub, 'balance', bal, 'user_id', s.user_id);
end $$;

-- служебные функции — только для service role
revoke execute on function public.stars_create_payment(integer, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.stars_precheck(text, integer, text) from public, anon, authenticated;
revoke execute on function public.stars_credit(text, text, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function public.stars_create_payment(integer, uuid, bigint) to service_role;
grant execute on function public.stars_precheck(text, integer, text) to service_role;
grant execute on function public.stars_credit(text, text, text, bigint, integer, text) to service_role;

-- баланс обновляется на сайте сразу после оплаты
alter publication supabase_realtime add table public.wallets;
