-- ============================================================
-- MIGRATION 8: ENHANCE IS_ADMIN & ADMIN_ID PARAMETERS
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'),
    false
  ) or coalesce(
    (select (current_user = 'service_role' or current_user = 'postgres')),
    false
  ) or coalesce(
    (select role = 'admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Drop older 3-parameter signature
drop function if exists public.update_project_status(text, text, text);

create or replace function public.update_project_status(
  p_project_id text,
  p_new_status text,
  p_notes text default null,
  p_admin_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_caller_is_admin boolean;
  v_caller_id uuid;
begin
  v_caller_is_admin := public.is_admin();
  if not v_caller_is_admin then
    raise exception 'unauthorized_admin_required';
  end if;

  v_caller_id := coalesce(auth.uid(), p_admin_id);

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found';
  end if;

  if v_project.status = p_new_status then
    return jsonb_build_object('success', true, 'status', p_new_status, 'unchanged', true);
  end if;

  if v_project.status in ('declined', 'cancelled') then
    raise exception 'cannot_transition_from_terminal_status';
  end if;

  if p_new_status not in ('pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered', 'declined', 'cancelled') then
    raise exception 'invalid_target_status';
  end if;

  update public.projects set
    status = p_new_status,
    updated_at = now()
  where id = p_project_id;

  insert into public.project_status_history (project_id, from_status, to_status, changed_by, notes)
  values (p_project_id, v_project.status, p_new_status, v_caller_id, p_notes);

  return jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'from_status', v_project.status,
    'to_status', p_new_status,
    'updated_at', now()
  );
end;
$$;

revoke execute on function public.update_project_status(text, text, text, uuid) from public, anon;
grant execute on function public.update_project_status(text, text, text, uuid) to authenticated, service_role;

-- Drop older 4-parameter signature
drop function if exists public.confirm_manual_payment(uuid, text, int, text);

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
  v_fulfill_res jsonb;
  v_caller_id uuid;
begin
  v_caller_is_admin := public.is_admin();
  if not v_caller_is_admin then
    raise exception 'unauthorized_admin_required';
  end if;

  v_caller_id := coalesce(auth.uid(), p_admin_id);

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.provider <> 'manual' then
    raise exception 'order_is_not_manual_provider';
  end if;

  if v_order.status = 'fulfilled' then
    return jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'order_id', p_order_id
    );
  end if;

  if p_amount_cents <> v_order.expected_amount_cents then
    raise exception 'amount_mismatch_expected_%_got_%', v_order.expected_amount_cents, p_amount_cents;
  end if;

  v_fulfill_res := public.fulfill_order(
    p_order_id,
    p_bank_reference,
    p_amount_cents,
    v_order.currency
  );

  if not (v_fulfill_res->>'success')::boolean then
    raise exception 'fulfill_order_failed: %', (v_fulfill_res->>'error');
  end if;

  insert into public.admin_alerts (
    user_id,
    order_id,
    type,
    message,
    metadata
  ) values (
    v_order.user_id,
    p_order_id,
    'manual_payment_confirmed',
    'Admin confirmed manual bank/wire payment for order ' || p_order_id::text,
    jsonb_build_object(
      'bank_reference', p_bank_reference,
      'amount_cents', p_amount_cents,
      'confirmed_by', v_caller_id,
      'notes', p_notes
    )
  );

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'credits_granted', v_order.credits_to_grant,
    'bank_reference', p_bank_reference,
    'amount_cents', p_amount_cents
  );
end;
$$;

revoke execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) from public, anon;
grant execute on function public.confirm_manual_payment(uuid, text, int, text, uuid) to authenticated, service_role;
