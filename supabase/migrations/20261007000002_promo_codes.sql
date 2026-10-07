-- ============================================================
-- MIGRATION 2: PROMO CODES & ATOMIC REDEMPTION ENGINE
-- ============================================================

-- 1. Promo Codes Catalog (Only grants promo bucket credits, no mutable bucket column)
create table if not exists public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  credits integer not null check (credits > 0),
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  expires_at timestamptz,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes(code);

-- 2. Promo Redemptions Audit Log
create table if not exists public.promo_redemptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, promo_code_id)
);

create index if not exists promo_redemptions_user_idx on public.promo_redemptions(user_id);

-- 3. Security: Revoke public/client write and truncate grants
revoke truncate on table public.promo_codes from public, anon, authenticated;
revoke truncate on table public.promo_redemptions from public, anon, authenticated;
revoke insert, update, delete on table public.promo_codes from anon, authenticated;
revoke insert, update, delete on table public.promo_redemptions from anon, authenticated;

-- 4. Atomic Single-Transaction redeem_promo Function
create or replace function public.redeem_promo(
  p_user uuid,
  p_raw_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_raw_code));
  v_promo public.promo_codes;
  v_balance int;
  v_key text;
begin
  if v_code is null or v_code = '' then
    raise exception 'invalid_code';
  end if;

  -- Step 1: Guarded update on promo_codes (atomically increments used_count if valid and within limits)
  update public.promo_codes
  set used_count = used_count + 1
  where code = v_code
    and is_active = true
    and (expires_at is null or expires_at > now())
    and used_count < max_uses
  returning * into v_promo;

  if not found then
    raise exception 'invalid_or_exhausted_code';
  end if;

  -- Step 2: Record user redemption (unique constraint on (user_id, promo_code_id) stops double-dipping)
  begin
    insert into public.promo_redemptions (user_id, promo_code_id)
    values (p_user, v_promo.id);
  exception when unique_violation then
    raise exception 'already_redeemed';
  end;

  -- Step 3: Post credits to promo bucket via ledger_post with deterministic idempotency key
  v_key := 'promo:' || v_promo.id::text || ':' || p_user::text;
  v_balance := public.ledger_post(
    p_user,
    'promo',
    v_promo.credits,
    'promo_redeem',
    v_promo.code,
    v_key,
    'Redeemed promotional voucher ' || v_promo.code
  );

  return jsonb_build_object(
    'success', true,
    'credits_granted', v_promo.credits,
    'new_balance', v_balance,
    'code', v_promo.code
  );
end;
$$;

revoke execute on function public.redeem_promo(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_promo(uuid, text) to service_role;

-- 5. Row Level Security Policies
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Client can only view their own redemptions
drop policy if exists "own redemptions" on public.promo_redemptions;
create policy "own redemptions" on public.promo_redemptions 
  for select to authenticated using ((select auth.uid()) = user_id);

-- promo_codes has no client SELECT policy (clients must not be able to scrape/dump unredeemed codes).
