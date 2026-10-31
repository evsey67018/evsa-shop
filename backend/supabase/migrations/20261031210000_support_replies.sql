-- Поддержка: ответы владельца из бота, статус прочтения, история для пользователя на сайте.
-- Одна таблица = переписка: kind='user' (пишет пользователь: сайт или ответ в боте), kind='reply' (ответ поддержки).
alter table public.support_tickets
  add column if not exists kind text not null default 'user',
  add column if not exists source text not null default 'site',
  add column if not exists seen_at timestamptz,
  add column if not exists delivered boolean,
  add column if not exists error text;
alter table public.support_tickets drop constraint if exists support_tickets_kind_check;
alter table public.support_tickets add constraint support_tickets_kind_check check (kind in ('user', 'reply'));
alter table public.support_tickets drop constraint if exists support_tickets_source_check;
alter table public.support_tickets add constraint support_tickets_source_check check (source in ('site', 'bot'));
alter table public.support_tickets drop constraint if exists support_tickets_error_check;
alter table public.support_tickets add constraint support_tickets_error_check check (char_length(error) <= 200);
alter table public.support_tickets drop constraint if exists support_tickets_text_check;
alter table public.support_tickets add constraint support_tickets_text_check check (
  char_length(btrim(text)) >= case when kind = 'reply' then 1 else 2 end
  and char_length(text) <= case when kind = 'reply' then 3500 else 1500 end);
create index if not exists support_user_idx on public.support_tickets(user_id, created_at);

-- anon/authenticated по-прежнему могут вставлять только свои обращения (новые колонки им не выданы → kind='user', source='site').
drop policy if exists support_insert_anyone on public.support_tickets;
create policy support_insert_anyone on public.support_tickets for insert to anon, authenticated
  with check ((user_id is null or user_id = auth.uid()) and kind = 'user' and source = 'site' and seen_at is null and delivered is null);

-- Вошедший пользователь видит только свою переписку (без служебных полей).
grant select (id, user_id, category, text, kind, created_at) on public.support_tickets to authenticated;
drop policy if exists support_select_own on public.support_tickets;
create policy support_select_own on public.support_tickets for select to authenticated
  using (user_id is not null and user_id = auth.uid());

-- Лимит считает только сообщения пользователей; ответы поддержки не ограничиваются.
create or replace function public.support_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'user' and (select count(*) from public.support_tickets
      where kind = 'user' and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Слишком много обращений, попробуйте позже';
  end if;
  return new;
end $$;
