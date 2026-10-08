-- ============================================================
-- MIGRATION 6: PARTIAL CLAWBACKS, SHORTFALLS & DISPUTE FREEZE
-- ============================================================

-- 1. Improved Refund Handler: Claw back available purchased balance and record shortfall alert
create or replace function public.handle_refund(
  p_order_id uuid,
  p_refund_id text,
  p_refund_amount_cents int,
  p_reason text default 'PayPal refund'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  w public.wallets;
  v_clawback int := 0;
  v_shortfall int := 0;
  v_idemp_key text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'refunded' then
    return jsonb_build_object('success', true, 'already_refunded', true, 'order_id', p_order_id);
  end if;

  -- Row lock on wallet
  select * into w from public.wallets where user_id = v_order.user_id for update;

  -- Claw back whatever purchased balance is available up to the order credits
  v_clawback := least(greatest(0, w.balance_purchased), v_order.credits_to_grant);
  v_shortfall := v_order.credits_to_grant - v_clawback;

  v_idemp_key := 'order:' || v_order.id::text || ':refund:' || p_refund_id;

  if v_clawback > 0 then
    perform public.ledger_post(
      v_order.user_id,
      'purchased',
      -v_clawback,
      'refund_cash',
      v_order.id::text,
      v_idemp_key,
      'Refund for PayPal order ' || v_order.id::text
    );
  end if;

  if v_shortfall > 0 then
    -- Shortfall detected: user already spent some or all credits. Freeze wallet & log alert.
    update public.wallets set is_frozen = true where user_id = v_order.user_id;

    insert into public.admin_alerts (user_id, order_id, type, message, metadata)
    values (
      v_order.user_id,
      p_order_id,
      'refund_shortfall',
      'Refund clawback had shortfall of ' || v_shortfall::text || ' CR. Wallet frozen.',
      jsonb_build_object(
        'credits_to_grant', v_order.credits_to_grant,
        'clawed_back', v_clawback,
        'shortfall', v_shortfall,
        'refund_id', p_refund_id,
        'refund_amount_cents', p_refund_amount_cents
      )
    );
  end if;

  update public.orders set
    status = 'refunded'
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'clawed_back', v_clawback,
    'shortfall', v_shortfall,
    'wallet_frozen', (v_shortfall > 0)
  );
end;
$$;

revoke execute on function public.handle_refund from public, anon, authenticated;
grant execute on function public.handle_refund to service_role;

-- 2. Improved Reversal Handler: Claw back available purchased balance and record shortfall alert
create or replace function public.handle_reversal(
  p_order_id uuid,
  p_reversal_id text,
  p_reason text default 'PayPal chargeback / dispute reversal'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  w public.wallets;
  v_clawback int := 0;
  v_shortfall int := 0;
  v_idemp_key text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'reversed' then
    return jsonb_build_object('success', true, 'already_reversed', true, 'order_id', p_order_id);
  end if;

  -- Row lock on wallet
  select * into w from public.wallets where user_id = v_order.user_id for update;

  v_clawback := least(greatest(0, w.balance_purchased), v_order.credits_to_grant);
  v_shortfall := v_order.credits_to_grant - v_clawback;

  v_idemp_key := 'order:' || v_order.id::text || ':reversal:' || p_reversal_id;

  if v_clawback > 0 then
    perform public.ledger_post(
      v_order.user_id,
      'purchased',
      -v_clawback,
      'chargeback',
      v_order.id::text,
      v_idemp_key,
      'Chargeback for order ' || v_order.id::text
    );
  end if;

  -- Chargebacks always freeze the wallet
  update public.wallets set is_frozen = true where user_id = v_order.user_id;

  insert into public.admin_alerts (user_id, order_id, type, message, metadata)
  values (
    v_order.user_id,
    p_order_id,
    'chargeback_alert',
    'Chargeback processed. Clawed back ' || v_clawback::text || ' CR, shortfall: ' || v_shortfall::text || ' CR. Wallet frozen.',
    jsonb_build_object(
      'credits_to_grant', v_order.credits_to_grant,
      'clawed_back', v_clawback,
      'shortfall', v_shortfall,
      'reversal_id', p_reversal_id,
      'reason', p_reason
    )
  );

  update public.orders set
    status = 'reversed'
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'clawed_back', v_clawback,
    'shortfall', v_shortfall,
    'wallet_frozen', true
  );
end;
$$;

revoke execute on function public.handle_reversal from public, anon, authenticated;
grant execute on function public.handle_reversal to service_role;

-- 3. Early Dispute Freeze Handler (Freezes early on CUSTOMER.DISPUTE.CREATED)
create or replace function public.handle_dispute(
  p_order_id uuid,
  p_dispute_id text,
  p_reason text default 'PayPal dispute created'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Freeze wallet immediately on dispute notice
  update public.wallets set is_frozen = true where user_id = v_order.user_id;

  insert into public.admin_alerts (user_id, order_id, type, message, metadata)
  values (
    v_order.user_id,
    p_order_id,
    'dispute_opened',
    'Customer dispute opened on PayPal (' || p_dispute_id || '). Wallet frozen pending resolution.',
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'wallet_frozen', true
  );
end;
$$;

revoke execute on function public.handle_dispute from public, anon, authenticated;
grant execute on function public.handle_dispute to service_role;
