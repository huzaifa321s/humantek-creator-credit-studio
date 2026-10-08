-- ============================================================
-- MIGRATION: CRITICAL SECURITY FIX FOR IS_ADMIN & FUNCTION GRANTS
-- ============================================================

-- 1. Fix is_admin(): Remove current_user = 'postgres' check which evaluates to true
-- for all users inside a SECURITY DEFINER function owned by postgres.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'),
    false
  ) or coalesce(
    (select role = 'admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Revoke execute on sensitive financial & admin functions from anon & authenticated.
-- ONLY service_role (the Next.js server) may execute these sensitive functions!
revoke execute on function public.fulfill_order(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid, text, int, text) to service_role;

revoke execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) from public, anon, authenticated;
grant execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) to service_role;

revoke execute on function public.update_project_status(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.update_project_status(text, text, text, uuid) to service_role;

-- 3. Add bank_reference column to orders if not exists
alter table public.orders add column if not exists bank_reference text;

-- Add unique index on bank_reference for fulfilled manual orders
create unique index if not exists orders_bank_reference_unique_idx
  on public.orders (bank_reference)
  where bank_reference is not null and status in ('fulfilled', 'processing', 'created');

-- 4. Enforce non-empty reason/notes and duplicate bank reference check in confirm_manual_payment
create or replace function public.confirm_manual_payment(
  p_order_id uuid,
  p_bank_reference text,
  p_amount_cents int,
  p_notes text default null,
  p_admin_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_caller_is_admin boolean;
  v_admin_user_id uuid;
  v_existing_ref_order uuid;
begin
  -- Must be called by service_role or verified admin session
  v_caller_is_admin := public.is_admin();
  if not v_caller_is_admin then
    raise exception 'unauthorized_admin_required';
  end if;

  -- Require non-empty reason / notes
  if p_notes is null or trim(p_notes) = '' then
    raise exception 'admin_notes_required';
  end if;

  -- Require non-empty bank reference
  if p_bank_reference is null or trim(p_bank_reference) = '' then
    raise exception 'bank_reference_required';
  end if;

  v_admin_user_id := coalesce(auth.uid(), p_admin_id);

  -- Row lock the order
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.provider <> 'manual' then
    raise exception 'not_a_manual_order';
  end if;

  -- Already fulfilled: idempotent return
  if v_order.status = 'fulfilled' then
    return jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'already_fulfilled', true,
      'credits_granted', v_order.credits_to_grant
    );
  end if;

  if v_order.status in ('cancelled', 'failed', 'refunded', 'reversed') then
    raise exception 'order_cannot_be_confirmed_in_status_%', v_order.status;
  end if;

  -- Amount verification
  if p_amount_cents <> v_order.expected_amount_cents then
    insert into public.admin_alerts (user_id, order_id, type, message, metadata)
    values (
      v_order.user_id,
      p_order_id,
      'amount_mismatch',
      'Manual payment amount mismatch. Expected ' || v_order.expected_amount_cents::text || ', received ' || p_amount_cents::text,
      jsonb_build_object(
        'expected_amount_cents', v_order.expected_amount_cents,
        'received_amount_cents', p_amount_cents,
        'bank_reference', trim(p_bank_reference)
      )
    );
    raise exception 'amount_mismatch';
  end if;

  -- Prevent duplicate bank reference across orders
  select id into v_existing_ref_order
  from public.orders
  where bank_reference = trim(p_bank_reference)
    and id <> p_order_id
    and status in ('fulfilled', 'processing');

  if found then
    raise exception 'bank_reference_already_used_by_order_%', v_existing_ref_order;
  end if;

  -- Update order with bank reference and notes
  update public.orders set
    bank_reference = trim(p_bank_reference),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'admin_notes', trim(p_notes),
      'confirmed_by_admin_id', v_admin_user_id,
      'confirmed_at', now()
    )
  where id = p_order_id;

  -- Call fulfill_order atomically
  perform public.fulfill_order(
    p_order_id,
    'manual-ref:' || trim(p_bank_reference),
    p_amount_cents,
    v_order.currency
  );

  -- Log security audit alert
  insert into public.admin_alerts (user_id, order_id, type, message, metadata)
  values (
    v_order.user_id,
    p_order_id,
    'manual_payment_confirmed',
    'Admin confirmed manual bank/wire payment for order ' || p_order_id::text,
    jsonb_build_object(
      'admin_user_id', v_admin_user_id,
      'bank_reference', trim(p_bank_reference),
      'amount_cents', p_amount_cents,
      'notes', trim(p_notes)
    )
  );

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'credits_granted', v_order.credits_to_grant,
    'status', 'fulfilled'
  );
end;
$$;

revoke execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) from public, anon, authenticated;
grant execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) to service_role;
