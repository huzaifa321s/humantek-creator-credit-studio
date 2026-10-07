-- Migration: 20261007000003_redeem_promo_verified_email.sql
-- Enforce that only users with confirmed email addresses can redeem promotional vouchers

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

  -- Step 0: Ensure user exists and has a confirmed email address to prevent promo farming
  if not exists (
    select 1 from auth.users
    where id = p_user and email_confirmed_at is not null
  ) then
    raise exception 'email_not_confirmed';
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
