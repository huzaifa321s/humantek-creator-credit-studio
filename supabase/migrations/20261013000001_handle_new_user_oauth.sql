-- ============================================================
-- MIGRATION: 20261013000001_handle_new_user_oauth.sql
-- Hardened handle_new_user trigger function:
-- 1. Keeps search_path = '' (security definer best practice)
-- 2. Uses plain 'on conflict do nothing' (covers id and lower(email) unique indexes)
-- 3. Sanitizes via POSIX '[[:cntrl:]]' (avoids Postgres \x00 regex issues)
-- 4. Normalizes email via lower(new.email)
-- 5. Caps full_name to 80 chars
-- 6. Hardcodes role strictly to 'client' (never trusts provider metadata)
-- 7. Revokes execute from anon/authenticated
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_name text;
  v_clean_name text;
begin
  -- 1. Extract name from metadata, falling back to email prefix
  v_raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Creator'
  );

  -- 2. Strip POSIX control characters ([[:cntrl:]]) and limit to 80 chars
  v_clean_name := regexp_replace(v_raw_name, '[[:cntrl:]]', '', 'g');
  v_clean_name := substr(trim(v_clean_name), 1, 80);

  if v_clean_name is null or v_clean_name = '' then
    v_clean_name := 'Creator';
  end if;

  -- 3. Insert profile with lower(new.email) and unconstrained on conflict do nothing
  insert into public.profiles (id, email, full_name, role)
  values (new.id, lower(new.email), v_clean_name, 'client')
  on conflict do nothing;

  -- 4. Initialize empty wallet
  insert into public.wallets (user_id, balance_purchased, balance_promo)
  values (new.id, 0, 0)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
