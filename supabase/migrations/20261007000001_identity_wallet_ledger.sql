-- ============================================================
-- MIGRATION 1: IDENTITY, WALLET & APPEND-ONLY CREDIT LEDGER
-- ============================================================

-- 1. Profiles Table (extends auth.users safely)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx 
  on public.profiles (lower(email)) 
  where email is not null;

-- 2. Wallets Table (Dual-bucket with non-negative constraints and stored total)
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  balance_purchased integer not null default 0 check (balance_purchased >= 0),
  balance_promo integer not null default 0 check (balance_promo >= 0),
  balance_credits integer generated always as (balance_purchased + balance_promo) stored,
  updated_at timestamptz not null default now()
);

-- 3. Append-Only Credit Ledger
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  reverses_id bigint unique references public.credit_ledger(id),
  bucket text not null check (bucket in ('purchased', 'promo')),
  delta integer not null check (delta <> 0),
  type text not null check (type in (
    'package_purchase',
    'promo_redeem',
    'service_deduction',
    'refund_wallet',
    'refund_cash',
    'chargeback',
    'admin_adjustment'
  )),
  reference_id text,
  idempotency_key text not null unique,
  description text,
  created_at timestamptz not null default now(),

  -- Strict sign & bucket rules
  check (
    (type = 'package_purchase'  and bucket = 'purchased' and delta > 0) or
    (type = 'promo_redeem'      and bucket = 'promo'     and delta > 0) or
    (type = 'service_deduction' and delta < 0) or
    (type = 'refund_wallet'     and delta > 0) or
    (type = 'refund_cash'       and bucket = 'purchased' and delta < 0) or
    (type = 'chargeback'        and bucket = 'purchased') or
    (type = 'admin_adjustment')
  )
);

create index if not exists credit_ledger_user_created_idx 
  on public.credit_ledger (user_id, created_at desc);

-- 4. Hard Immutability Trigger (Prevent any UPDATE or DELETE on credit_ledger)
create or replace function public.prevent_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only. UPDATE and DELETE are prohibited.';
end;
$$;

drop trigger if exists trg_block_ledger_mutation on public.credit_ledger;
create trigger trg_block_ledger_mutation
before update or delete on public.credit_ledger
for each row execute function public.prevent_ledger_mutation();

-- Revoke dangerous table-level grants explicitly
revoke truncate on table public.credit_ledger from public, anon, authenticated;
revoke truncate on table public.wallets from public, anon, authenticated;
revoke insert, update, delete on table public.credit_ledger from anon, authenticated;
revoke insert, update, delete on table public.wallets from anon, authenticated;

-- 5. Atomic ledger_post Function
create or replace function public.ledger_post(
  p_user uuid,
  p_bucket text,
  p_delta int,
  p_type text,
  p_ref text,
  p_key text,
  p_desc text,
  p_reverses_id bigint default null
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance int;
begin
  -- Idempotency check: insert entry first
  insert into public.credit_ledger(user_id, bucket, delta, type, reference_id, idempotency_key, description, reverses_id)
  values (p_user, p_bucket, p_delta, p_type, p_ref, p_key, p_desc, p_reverses_id)
  on conflict (idempotency_key) do nothing;

  -- Replay detection: check if existing row matches exact payload
  if not found then
    perform 1 from public.credit_ledger
     where idempotency_key = p_key
       and user_id = p_user
       and bucket = p_bucket
       and delta = p_delta
       and type = p_type;
    if not found then
      raise exception 'idempotency key reused with a different payload';
    end if;

    select balance_credits into v_balance from public.wallets where user_id = p_user;
    return v_balance;
  end if;

  -- Update specific bucket. Check constraints (balance >= 0) will abort transaction on overspend
  update public.wallets set
    balance_promo     = balance_promo     + case when p_bucket = 'promo'     then p_delta else 0 end,
    balance_purchased = balance_purchased + case when p_bucket = 'purchased' then p_delta else 0 end,
    updated_at = now()
  where user_id = p_user
  returning balance_credits into v_balance;

  if not found then
    raise exception 'wallet not found for %', p_user;
  end if;

  return v_balance;
end;
$$;

revoke execute on function public.ledger_post(uuid, text, int, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.ledger_post(uuid, text, int, text, text, text, text, bigint) to service_role;

-- 6. Promo-first Atomic spend_credits Function
create or replace function public.spend_credits(
  p_user uuid,
  p_amount int,
  p_ref text,
  p_key text,
  p_desc text
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.wallets;
  v_promo int;
  v_paid int;
  v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'spend amount must be positive';
  end if;

  -- Row-level lock on wallet to serialize user's concurrent spends
  select * into w from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'wallet not found for %', p_user;
  end if;

  -- Replay check for composite key
  if exists (
    select 1 from public.credit_ledger
    where idempotency_key in (p_key || ':promo', p_key || ':purchased')
  ) then
    return w.balance_credits;
  end if;

  if w.balance_credits < p_amount then
    raise exception 'insufficient_credits';
  end if;

  -- Promo-first deduction
  v_promo := least(w.balance_promo, p_amount);
  v_paid  := p_amount - v_promo;

  if v_promo > 0 then
    v_balance := public.ledger_post(p_user, 'promo', -v_promo, 'service_deduction', p_ref, p_key || ':promo', p_desc);
  end if;

  if v_paid > 0 then
    v_balance := public.ledger_post(p_user, 'purchased', -v_paid, 'service_deduction', p_ref, p_key || ':purchased', p_desc);
  end if;

  return v_balance;
end;
$$;

revoke execute on function public.spend_credits(uuid, int, text, text, text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, int, text, text, text) to service_role;

-- 7. Automated User Registration Trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client')
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance_purchased, balance_promo)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8. Row Level Security Policies
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "own wallet" on public.wallets;
create policy "own wallet" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own ledger" on public.credit_ledger;
create policy "own ledger" on public.credit_ledger for select to authenticated using ((select auth.uid()) = user_id);
