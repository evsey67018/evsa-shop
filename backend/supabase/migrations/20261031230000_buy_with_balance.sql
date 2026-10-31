-- EVSA SHOP — покупка товара с баланса сайта.
-- Деньги списываются ТОЛЬКО через buy_listing() (SECURITY DEFINER) → wallet_debit() (учитывает безлимит владельца).
-- Заказ создаётся сразу со статусом 'paid'; товар продавец передаёт вручную в чате сделки,
-- покупатель подтверждает получение (order_confirm → 'completed', после этого доступен отзыв).
-- Выплата продавцу и возвраты — вручную (владелец/SQL).

-- ---------- товары: необязательный остаток (null = без ограничения) ----------
alter table public.products add column if not exists stock integer;
alter table public.products drop constraint if exists products_stock_check;
alter table public.products add constraint products_stock_check check (stock is null or (stock >= 0 and stock <= 100000));
grant insert (stock), update (stock) on public.products to authenticated;

-- ---------- заказы ----------
alter table public.orders add column if not exists client_request_id uuid;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists notified_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('requested', 'paid', 'completed', 'cancelled'));
create unique index if not exists orders_buyer_request_uq on public.orders(buyer_id, client_request_id);
drop index if exists public.orders_unnotified_idx;
create index orders_unnotified_idx on public.orders(created_at) where notified_at is null and status in ('paid', 'completed');
create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders(seller_id, created_at desc);

-- Клиенты больше не создают заказы напрямую: только через buy_listing().
drop policy if exists orders_insert_buyer on public.orders;
revoke insert on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

create or replace function public.is_shop_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and telegram_id = 5327129904)
$$;
revoke execute on function public.is_shop_owner() from public, anon;
grant execute on function public.is_shop_owner() to authenticated;

drop policy if exists orders_read_member on public.orders;
create policy orders_read_member on public.orders for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_shop_owner());

-- ---------- покупка ----------
-- Результат jsonb: {status: ok|duplicate|insufficient|..., order_id, price, balance, unlimited}
-- Ошибки (raise): not_signed_in, banned, bad_request, not_found, not_active, own_listing, seller_banned, price_changed, out_of_stock
create or replace function public.buy_listing(p_product_id uuid, p_expected_price numeric, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w public.wallets%rowtype;
  p public.products%rowtype;
  o public.orders%rowtype;
  cid uuid;
  res text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_product_id is null or p_request_id is null or p_expected_price is null then raise exception 'bad_request'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;

  -- 1) блокируем кошелёк покупателя: все покупки одного пользователя идут строго по очереди
  select * into w from public.wallets where user_id = me for update;

  -- 2) повторный клик / повтор запроса с тем же id → тот же заказ, без второго списания
  select * into o from public.orders where buyer_id = me and client_request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'order_id', o.id, 'price', o.price, 'chat_id', o.chat_id,
                              'balance', coalesce(w.balance, 0), 'unlimited', coalesce(w.unlimited, false));
  end if;

  -- 3) блокируем товар и проверяем его
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'not_found'; end if;
  if p.status <> 'active' then raise exception 'not_active'; end if;
  if p.seller_id = me then raise exception 'own_listing'; end if;
  if public.is_banned(p.seller_id) then raise exception 'seller_banned'; end if;
  if p.price <> p_expected_price then raise exception 'price_changed'; end if;
  if p.stock is not null and p.stock < 1 then raise exception 'out_of_stock'; end if;

  -- 4) списание (безлимит владельца: достаточно всегда, баланс не меняется)
  res := public.wallet_debit(me, p.price);
  if res not in ('ok', 'unlimited') then
    return jsonb_build_object('status', res, 'price', p.price,
                              'balance', coalesce(w.balance, 0), 'unlimited', coalesce(w.unlimited, false));
  end if;

  -- 5) чат сделки (для передачи товара) и заказ
  insert into public.chats (product_id, buyer_id, seller_id) values (p.id, me, p.seller_id)
    on conflict (product_id, buyer_id) do nothing;
  select id into cid from public.chats where product_id = p.id and buyer_id = me;

  insert into public.orders (product_id, buyer_id, seller_id, chat_id, title, price, status, client_request_id, paid_at)
  values (p.id, me, p.seller_id, cid, left(p.title, 80), p.price, 'paid', p_request_id, now())
  returning * into o;

  update public.products set sales = sales + 1,
    stock = case when stock is null then null else stock - 1 end,
    status = case when stock is not null and stock - 1 <= 0 then 'sold' else status end
  where id = p.id;

  select * into w from public.wallets where user_id = me;
  return jsonb_build_object('status', 'ok', 'order_id', o.id, 'price', o.price, 'chat_id', cid,
                            'balance', w.balance, 'unlimited', w.unlimited);
end $$;
revoke execute on function public.buy_listing(uuid, numeric, uuid) from public, anon;
grant execute on function public.buy_listing(uuid, numeric, uuid) to authenticated;

-- ---------- покупатель подтверждает получение ----------
create or replace function public.order_confirm(p_order_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'not_found'; end if;
  if o.status = 'completed' then return 'already'; end if;
  if o.status <> 'paid' then raise exception 'bad_status'; end if;
  update public.orders set status = 'completed', completed_at = now() where id = o.id;
  return 'ok';
end $$;
revoke execute on function public.order_confirm(uuid) from public, anon;
grant execute on function public.order_confirm(uuid) to authenticated;

-- новые заказы сразу видны покупателю/продавцу на сайте
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
