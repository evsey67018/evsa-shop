-- Дата регистрации аккаунта: неизменяемая.
-- Источник истины: auth.users.created_at (момент первого входа через Telegram).

-- 1) Бэкфилл существующих профилей (до установки триггера на UPDATE)
update public.profiles p
   set created_at = u.created_at
  from auth.users u
 where u.id = p.id and u.created_at is not null and p.created_at is distinct from u.created_at;

alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;

-- 2) INSERT: значение от клиента/функции игнорируется — берём из auth.users (или now())
create or replace function public.profiles_created_at_on_insert() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  new.created_at := coalesce((select u.created_at from auth.users u where u.id = new.id), now());
  return new;
end $$;

-- 3) UPDATE: created_at всегда остаётся прежним
create or replace function public.profiles_created_at_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := old.created_at;
  return new;
end $$;

revoke execute on function public.profiles_created_at_on_insert() from public, anon, authenticated;
revoke execute on function public.profiles_created_at_immutable() from public, anon, authenticated;

drop trigger if exists profiles_created_at_ins on public.profiles;
create trigger profiles_created_at_ins before insert on public.profiles
  for each row execute function public.profiles_created_at_on_insert();

drop trigger if exists profiles_created_at_upd on public.profiles;
create trigger profiles_created_at_upd before update on public.profiles
  for each row execute function public.profiles_created_at_immutable();

-- 4) Клиентам — только чтение (повторно фиксируем гранты: никакого insert/update created_at)
revoke insert, update (created_at) on public.profiles from anon, authenticated;
