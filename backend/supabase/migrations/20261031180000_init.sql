-- EVSA SHOP — основная схема. RLS включён на каждой таблице.
-- Оплата и балансы НЕ используются.

create or replace function public.storage_prefix() returns text
language sql immutable as $$ select 'https://duotcuunusvnxsektzkj.supabase.co/storage/v1/object/public/product-images/'::text $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_id bigint not null unique,
  username text check (username is null or username ~ '^[A-Za-z0-9_]{3,32}$'),
  name text not null check (char_length(name) between 1 and 64),
  avatar_url text,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint avatar_from_storage check (avatar_url is null or (char_length(avatar_url) <= 400 and avatar_url like public.storage_prefix() || id::text || '/%'))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- telegram_id скрыт от всех клиентов (видно только через my_telegram_id())
grant select (id, username, name, avatar_url, banned, created_at) on public.profiles to anon, authenticated;
grant update (avatar_url) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where id = uid), true)
$$;

create or replace function public.my_telegram_id() returns bigint
language sql stable security definer set search_path = public as $$
  select telegram_id from public.profiles where id = auth.uid()
$$;
revoke execute on function public.my_telegram_id() from public, anon;
grant execute on function public.my_telegram_id() to authenticated;

-- ---------- user_settings ----------
create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;
grant select, insert (user_id, notify_messages), update (notify_messages, updated_at) on public.user_settings to authenticated;
create policy settings_read_own on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy settings_insert_own on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy settings_update_own on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- products ----------
create or replace function public.images_ok(imgs text[], seller uuid) returns boolean
language sql immutable as $$
  select coalesce(array_length(imgs, 1), 0) <= 5
     and not exists (select 1 from unnest(imgs) u
                     where char_length(u) > 400 or u not like public.storage_prefix() || seller::text || '/%')
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('game', 'site')),
  target_id text not null check (target_id ~ '^[a-z0-9-]{1,40}$'),
  category text not null check (category ~ '^[a-z0-9_-]{1,30}$'),
  title text not null check (char_length(btrim(title)) between 4 and 80),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  buyer_msg text not null default '' check (char_length(buyer_msg) <= 1000),
  price numeric(12,2) not null check (price >= 1 and price <= 1000000),
  old_price numeric(12,2) not null default 0 check (old_price = 0 or (old_price > price and old_price <= 1000000)),
  images text[] not null default '{}',
  delivery text not null check (char_length(delivery) between 1 and 60),
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  sales integer not null default 0,
  created_at timestamptz not null default now(),
  constraint images_from_storage check (public.images_ok(images, seller_id))
);
create index products_seller_idx on public.products(seller_id);
create index products_target_idx on public.products(target_type, target_id);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert (id, seller_id, target_type, target_id, category, title, description, buyer_msg, price, old_price, images, delivery)
  on public.products to authenticated;
grant update (status, title, description, buyer_msg, price, old_price, images, delivery) on public.products to authenticated;
create policy products_read on public.products for select to anon, authenticated
  using ((status <> 'removed' and not public.is_banned(seller_id)) or seller_id = auth.uid());
create policy products_insert_own on public.products for insert to authenticated
  with check (seller_id = auth.uid() and status = 'active' and sales = 0 and not public.is_banned(auth.uid()));
create policy products_update_own on public.products for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- ---------- favorites ----------
create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert (user_id, product_id), delete on public.favorites to authenticated;
create policy fav_read_own on public.favorites for select to authenticated using (user_id = auth.uid());
create policy fav_insert_own on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy fav_delete_own on public.favorites for delete to authenticated using (user_id = auth.uid());

-- ---------- chats ----------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  buyer_read_at timestamptz not null default now(),
  seller_read_at timestamptz not null default now(),
  unique (product_id, buyer_id),
  check (buyer_id <> seller_id)
);
alter table public.chats enable row level security;
revoke all on public.chats from anon, authenticated;
grant select, insert (id, product_id, buyer_id, seller_id), update (buyer_read_at, seller_read_at) on public.chats to authenticated;
create policy chats_read_member on public.chats for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy chats_insert_buyer on public.chats for insert to authenticated
  with check (buyer_id = auth.uid() and not public.is_banned(auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.seller_id = chats.seller_id and p.status <> 'removed'));
create policy chats_update_member on public.chats for update to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index messages_chat_idx on public.messages(chat_id, created_at);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert (id, chat_id, sender_id, text) on public.messages to authenticated;
create policy messages_read_member on public.messages for select to authenticated
  using (exists (select 1 from public.chats c where c.id = chat_id and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)));
create policy messages_insert_member on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and not public.is_banned(auth.uid())
    and exists (select 1 from public.chats c where c.id = chat_id and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)));

create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chats set last_message_at = new.created_at,
    buyer_read_at = case when buyer_id = new.sender_id then new.created_at else buyer_read_at end,
    seller_read_at = case when seller_id = new.sender_id then new.created_at else seller_read_at end
  where id = new.chat_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_insert();

-- ---------- orders (без оплаты) ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete set null,
  title text not null check (char_length(title) <= 80),
  price numeric(12,2) not null check (price >= 0),
  status text not null default 'requested' check (status in ('requested', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (buyer_id <> seller_id)
);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select, insert (id, product_id, buyer_id, seller_id, chat_id, title, price) on public.orders to authenticated;
create policy orders_read_member on public.orders for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
-- Создать можно только заявку 'requested'. Завершить заказ клиент не может (нет UPDATE),
-- поэтому отзывы нельзя «накрутить».
create policy orders_insert_buyer on public.orders for insert to authenticated
  with check (buyer_id = auth.uid() and status = 'requested' and not public.is_banned(auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.seller_id = orders.seller_id
                and p.status = 'active' and p.price = orders.price));

-- ---------- reviews ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  text text not null check (char_length(btrim(text)) between 3 and 1000),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (id, order_id, product_id, seller_id, buyer_id, rating, text) on public.reviews to authenticated;
create policy reviews_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert_buyer on public.reviews for insert to authenticated
  with check (buyer_id = auth.uid() and not public.is_banned(auth.uid())
    and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
                and o.seller_id = reviews.seller_id and o.status = 'completed'
                and (reviews.product_id is null or o.product_id = reviews.product_id)));

-- ---------- support_tickets ----------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  category text not null check (char_length(category) between 1 and 60),
  text text not null check (char_length(btrim(text)) between 2 and 1500),
  name text check (char_length(name) <= 40),
  username text check (char_length(username) <= 33),
  contact text check (char_length(contact) <= 80),
  page text check (char_length(page) <= 200),
  ua text check (char_length(ua) <= 200),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index support_created_idx on public.support_tickets(created_at);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;
grant insert (id, user_id, category, text, name, username, contact, page, ua) on public.support_tickets to anon, authenticated;
-- SELECT-политики нет: читать обращения может только service role.
create policy support_insert_anyone on public.support_tickets for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create or replace function public.support_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.support_tickets where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Слишком много обращений, попробуйте позже';
  end if;
  return new;
end $$;
create trigger support_rate_limit before insert on public.support_tickets for each row execute function public.support_rate_limit();

-- ---------- login (только service role) ----------
create table public.login_nonces (
  nonce text primary key check (nonce ~ '^[A-Za-z0-9]{24,48}$'),
  created_at timestamptz not null default now(),
  telegram_id bigint,
  tg_username text,
  tg_first_name text,
  tg_last_name text,
  granted_at timestamptz,
  used_at timestamptz
);
alter table public.login_nonces enable row level security;
revoke all on public.login_nonces from anon, authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "product images: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
              and not public.is_banned(auth.uid()));
create policy "product images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.messages, public.chats;
