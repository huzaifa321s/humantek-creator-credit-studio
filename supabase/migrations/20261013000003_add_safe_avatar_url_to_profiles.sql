-- ============================================================
-- MIGRATION: 20261013000003_add_safe_avatar_url_to_profiles.sql
-- 1. Adds avatar_url column to public.profiles
-- 2. Enforces strict check constraint:
--    - Maximum 512 characters
--    - HTTPS strictly on Google's image domain (*.googleusercontent.com)
--    - Zero control characters or data: / javascript: schemes
-- 3. Updates handle_new_user() trigger to only save avatar when provider is Google
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- Remove prior constraint if exists
alter table public.profiles
  drop constraint if exists check_safe_avatar_url;

-- Enforce strict database validation: only verified Google CDN HTTPS URLs allowed
alter table public.profiles
  add constraint check_safe_avatar_url check (
    avatar_url is null or (
      length(avatar_url) <= 512 and
      avatar_url ~ '^https://lh[0-9]*\.googleusercontent\.com/' and
      avatar_url !~ '[\r\n\t\x00-\x1F\x7F]'
    )
  );

-- Update handle_new_user() trigger function
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_name text;
  v_clean_name text;
  v_raw_avatar text;
  v_clean_avatar text := null;
  v_provider text;
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

  -- 3. Safely extract avatar_url ONLY when authentication provider is Google
  v_provider := coalesce(
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'provider',
    ''
  );

  if v_provider = 'google' or new.raw_user_meta_data->>'iss' = 'https://accounts.google.com' then
    v_raw_avatar := coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    );
    -- Enforce HTTPS on Google CDN and max length 512
    if v_raw_avatar is not null and
       v_raw_avatar ~ '^https://lh[0-9]*\.googleusercontent\.com/' and
       length(v_raw_avatar) <= 512 then
      v_clean_avatar := regexp_replace(v_raw_avatar, '[[:cntrl:]]', '', 'g');
    end if;
  end if;

  -- 4. Insert profile with lower(new.email), sanitized full_name, and safe avatar_url
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, lower(new.email), v_clean_name, v_clean_avatar, 'client')
  on conflict (id) do update set
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  -- 5. Initialize empty wallet
  insert into public.wallets (user_id, balance_purchased, balance_promo)
  values (new.id, 0, 0)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
