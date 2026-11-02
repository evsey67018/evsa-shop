-- EVSA SHOP: Telegram-бот переезжает с box (Python, long polling) в Edge Function telegram-bot (webhook).
-- Служебное состояние бота (раньше — файлы на box). Доступ только service_role (Edge Function); anon/authenticated — нет.

create table if not exists public.bot_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_chat_state (
  chat_id bigint primary key,
  awaiting_amount boolean not null default false,
  awaiting_lookup boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_start_chats (
  chat_id bigint primary key,
  chat_type text,
  user_id bigint,
  username text,
  first_name text,
  at timestamptz not null default now()
);

-- журнал оплат звёздами + очередь незачисленных (раньше payments.jsonl + pending_credits.json)
create table if not exists public.bot_payment_events (
  charge_id text primary key,
  rec jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  result text,
  attempts int not null default 0,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists bot_payment_events_pending_idx on public.bot_payment_events (created_at) where status = 'pending';

-- дедупликация повторных доставок вебхука (кроме successful_payment — там идемпотентен stars_credit)
create table if not exists public.bot_updates (
  update_id bigint primary key,
  at timestamptz not null default now()
);

create table if not exists public.bot_leases (
  name text primary key,
  until timestamptz not null
);

do $$
declare t text;
begin
  foreach t in array array['bot_state','bot_chat_state','bot_start_chats','bot_payment_events','bot_updates','bot_leases'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create or replace function public.bot_update_seen(p_update_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.bot_updates(update_id) values (p_update_id) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.bot_lease(p_name text, p_ttl_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.bot_leases(name, until) values (p_name, now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update set until = excluded.until where public.bot_leases.until < now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function public.bot_lease_release(p_name text)
returns void language sql security definer set search_path = public as $$
  delete from public.bot_leases where name = p_name;
$$;

revoke all on function public.bot_update_seen(bigint) from public, anon, authenticated;
revoke all on function public.bot_lease(text, int) from public, anon, authenticated;
revoke all on function public.bot_lease_release(text) from public, anon, authenticated;
grant execute on function public.bot_update_seen(bigint) to service_role;
grant execute on function public.bot_lease(text, int) to service_role;
grant execute on function public.bot_lease_release(text) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Расписание (cron.schedule) и секрет для /tick (vault: evsa_bot_cron_secret) задаются отдельно при переключении —
-- см. /workspace/evsa-bot/MIGRATION.md; секрет в репозиторий не попадает.
