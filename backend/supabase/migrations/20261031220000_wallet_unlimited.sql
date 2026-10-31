-- Безлимитный баланс (∞) для владельца магазина.
-- Флаг меняется только через service role / SQL: клиентам (anon/authenticated) запись в wallets не выдана.
alter table public.wallets add column if not exists unlimited boolean not null default false;
comment on column public.wallets.unlimited is
  'Безлимитный баланс: любой расход считается достаточным и НЕ уменьшает balance. Только для владельца. Списывать деньги — только через wallet_debit().';

-- Кошелёк владельца (Telegram ID 5327129904): создать при отсутствии и включить безлимит.
insert into public.wallets (user_id)
  select id from public.profiles where telegram_id = 5327129904
  on conflict (user_id) do nothing;
update public.wallets set unlimited = true, updated_at = now()
  where user_id in (select id from public.profiles where telegram_id = 5327129904);

-- Хелперы для будущих покупок с баланса. ЛЮБОЕ списание должно идти через wallet_debit(),
-- чтобы безлимит учитывался: unlimited → всегда достаточно, balance не уменьшается.
create or replace function public.wallet_can_spend(p_user uuid, p_amount numeric) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select w.unlimited or w.balance >= p_amount from public.wallets w where w.user_id = p_user), false)
    and p_amount > 0;
$$;

create or replace function public.wallet_debit(p_user uuid, p_amount numeric) returns text
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w public.wallets;
begin
  if p_amount is null or p_amount <= 0 then return 'bad_amount'; end if;
  select * into w from public.wallets where user_id = p_user for update;
  if not found then return 'insufficient'; end if;
  if w.unlimited then return 'unlimited'; end if;            -- достаточно всегда, баланс не трогаем
  if w.balance < p_amount then return 'insufficient'; end if;
  update public.wallets set balance = balance - p_amount, updated_at = now() where user_id = p_user;
  return 'ok';
end $$;

revoke all on function public.wallet_can_spend(uuid, numeric) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid, numeric) from public, anon, authenticated;
grant execute on function public.wallet_can_spend(uuid, numeric) to service_role;
grant execute on function public.wallet_debit(uuid, numeric) to service_role;
