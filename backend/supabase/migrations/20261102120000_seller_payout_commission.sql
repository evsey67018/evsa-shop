-- EVSA SHOP — зачисление продавцу при подтверждении получения + комиссия площадки.
-- order_confirm(): в одной транзакции, под блокировкой заказа, только при переходе paid → completed:
--   продавцу на баланс = floor(price × (1 − ставка) до копеек), остаток = комиссия площадки (platform_revenue).
-- Ставка — одна настройка: platform_settings.commission_rate (по умолчанию 0.10).
-- Все движения баланса, кроме покупок/пополнений/выводов, пишутся в wallet_ledger.

-- ---------- настройки площадки ----------
create table if not exists public.platform_settings (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings for select to anon, authenticated using (true);
insert into public.platform_settings (key, value) values ('commission_rate', 0.10) on conflict (key) do nothing;

create or replace function public.commission_rate() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select least(greatest(value, 0), 1) from public.platform_settings where key = 'commission_rate'), 0.10)
$$;
grant execute on function public.commission_rate() to anon, authenticated, service_role;

-- ---------- журнал движений баланса ----------
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  kind text not null check (kind in ('sale_payout', 'order_refund', 'admin_adjust')),
  order_id uuid references public.orders(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  idem_key text unique,
  balance_after numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger(user_id, created_at desc);
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;
grant select on public.wallet_ledger to authenticated;
drop policy if exists wallet_ledger_read_own on public.wallet_ledger;
create policy wallet_ledger_read_own on public.wallet_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_shop_owner());

-- ---------- доход площадки (комиссия) ----------
create table if not exists public.platform_revenue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders(id) on delete set null,
  gross numeric(12,2) not null,
  rate numeric not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
alter table public.platform_revenue enable row level security;
revoke all on public.platform_revenue from anon, authenticated;
grant select on public.platform_revenue to authenticated;
drop policy if exists platform_revenue_read_owner on public.platform_revenue;
create policy platform_revenue_read_owner on public.platform_revenue for select to authenticated using (public.is_shop_owner());

-- ---------- заказ: сколько получил продавец ----------
alter table public.orders add column if not exists commission_rate numeric;
alter table public.orders add column if not exists commission_amount numeric(12,2);
alter table public.orders add column if not exists seller_amount numeric(12,2);
alter table public.orders add column if not exists refunded_at timestamptz;

-- внутреннее зачисление на кошелёк (только из других функций)
create or replace function public.wallet_credit(p_user uuid, p_amount numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare bal numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  insert into public.wallets (user_id, balance, updated_at) values (p_user, p_amount, now())
  on conflict (user_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now()
  returning balance into bal;
  return bal;
end $$;
revoke all on function public.wallet_credit(uuid, numeric) from public, anon, authenticated;
grant execute on function public.wallet_credit(uuid, numeric) to service_role;

-- ---------- покупатель подтверждает получение → выплата продавцу ----------
create or replace function public.order_confirm(p_order_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  r numeric := public.commission_rate();
  payout numeric(12,2);
  fee numeric(12,2);
  bal numeric(12,2);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into o from public.orders where id = p_order_id for update;   -- блокировка строки заказа
  if not found or o.buyer_id <> auth.uid() then raise exception 'not_found'; end if;
  if o.status = 'completed' then return 'already'; end if;
  if o.status <> 'paid' then raise exception 'bad_status'; end if;

  payout := floor(o.price * (1 - r) * 100) / 100;
  fee := o.price - payout;

  update public.orders set status = 'completed', completed_at = now(),
    commission_rate = r, commission_amount = fee, seller_amount = payout
  where id = o.id and status = 'paid';

  if payout > 0 then
    bal := public.wallet_credit(o.seller_id, payout);
    insert into public.wallet_ledger (user_id, amount, kind, order_id, note, idem_key, balance_after)
    values (o.seller_id, payout, 'sale_payout', o.id, 'Оплата заказа (комиссия ' || round(r * 100, 2)::text || '%)',
            'sale_payout:' || o.id::text, bal);
  end if;
  insert into public.platform_revenue (order_id, gross, rate, amount) values (o.id, o.price, r, fee);
  return 'ok';
end $$;
revoke execute on function public.order_confirm(uuid) from public, anon;
grant execute on function public.order_confirm(uuid) to authenticated;

-- ---------- владелец (service role): возврат по спору ----------
-- Только для заказа в статусе paid (до подтверждения) → cancelled, деньги покупателю.
-- Завершённый заказ вернуть нельзя (продавцу уже зачислено) → 'conflict'.
create or replace function public.order_refund(p_order_id uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  w public.wallets%rowtype;
  bal numeric(12,2);
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if o.status = 'cancelled' then return jsonb_build_object('status', 'already', 'order_status', o.status); end if;
  if o.status <> 'paid' then return jsonb_build_object('status', 'conflict', 'order_status', o.status); end if;
  update public.orders set status = 'cancelled', refunded_at = now() where id = o.id and status = 'paid';
  select * into w from public.wallets where user_id = o.buyer_id for update;
  if found and w.unlimited then   -- безлимит: при покупке баланс не списывался — возвращать нечего
    return jsonb_build_object('status', 'ok', 'order_status', 'cancelled', 'refunded', 0);
  end if;
  if o.price > 0 then
    bal := public.wallet_credit(o.buyer_id, o.price);
    insert into public.wallet_ledger (user_id, amount, kind, order_id, note, idem_key, balance_after)
    values (o.buyer_id, o.price, 'order_refund', o.id, coalesce(left(p_note, 500), 'Возврат по заказу'), 'order_refund:' || o.id::text, bal);
  end if;
  return jsonb_build_object('status', 'ok', 'order_status', 'cancelled', 'refunded', o.price, 'balance', bal);
end $$;
revoke all on function public.order_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.order_refund(uuid, text) to service_role;

-- ---------- владелец (service role / SQL): ручная корректировка баланса ----------
-- p_key — ключ идемпотентности: повтор с тем же ключом ничего не меняет ('duplicate').
create or replace function public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_note text, p_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.wallets%rowtype;
  l public.wallet_ledger%rowtype;
  bal numeric(12,2);
begin
  if p_user is null or p_amount is null or p_amount = 0 or p_key is null or btrim(p_key) = '' then raise exception 'bad_request'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('status', 'not_found'); end if;
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user for update;
  select * into l from public.wallet_ledger where idem_key = 'admin:' || p_key;
  if found then return jsonb_build_object('status', 'duplicate', 'balance', w.balance, 'ledger_id', l.id); end if;
  if p_amount < 0 and w.balance + p_amount < 0 then return jsonb_build_object('status', 'insufficient', 'balance', w.balance); end if;
  update public.wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user returning balance into bal;
  insert into public.wallet_ledger (user_id, amount, kind, note, idem_key, balance_after)
  values (p_user, p_amount, 'admin_adjust', left(p_note, 500), 'admin:' || p_key, bal) returning * into l;
  return jsonb_build_object('status', 'ok', 'balance_before', w.balance, 'balance', bal, 'ledger_id', l.id);
end $$;
revoke all on function public.admin_wallet_adjust(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.admin_wallet_adjust(uuid, numeric, text, text) to service_role;
