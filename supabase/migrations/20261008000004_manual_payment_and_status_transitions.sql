-- ============================================================
-- MIGRATION 7: MANUAL PAYMENT CONFIRMATION & AUDITED STATUS TRANSITIONS
-- ============================================================

-- 0. Universal is_admin Function (Supports service_role backend calls and user sessions)
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

-- 1. Project Status History Audit Table
create table if not exists public.project_status_history (
  id bigint generated always as identity primary key,
  project_id text not null references public.projects(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  changed_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists project_status_history_project_id_idx 
  on public.project_status_history (project_id, created_at desc);

alter table public.project_status_history enable row level security;

drop policy if exists "users read own project status history or admin" on public.project_status_history;
create policy "users read own project status history or admin" on public.project_status_history for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_status_history.project_id
        and (p.user_id = auth.uid() or public.is_admin())
    )
  );

revoke insert, update, delete, truncate on table public.project_status_history from anon, authenticated;

-- 2. Audited Project Status State Machine
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

  -- Validate state machine: terminal states cannot transition
  if v_project.status in ('declined', 'cancelled') then
    raise exception 'cannot_transition_from_terminal_status';
  end if;

  if p_new_status not in ('pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered', 'declined', 'cancelled') then
    raise exception 'invalid_target_status';
  end if;

  -- Update project status & timestamp
  update public.projects set
    status = p_new_status,
    updated_at = now()
  where id = p_project_id;

  -- Write audit history row in same transaction
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

revoke execute on function public.update_project_status from public, anon;
grant execute on function public.update_project_status to authenticated, service_role;

-- 3. Upgrade fulfill_order ledger description for non-paypal providers
create or replace function public.fulfill_order(
  p_order_id uuid,
  p_capture_id text,
  p_amount_cents int,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_pkg public.packages;
  v_new_balance int;
  v_desc text;
begin
  -- 1. Lock the order row
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- 2. Idempotency: If already fulfilled, return cleanly
  if v_order.status = 'fulfilled' then
    select balance_credits into v_new_balance from public.wallets where user_id = v_order.user_id;
    return jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'order_id', v_order.id,
      'credits_granted', v_order.credits_to_grant,
      'new_balance', v_new_balance
    );
  end if;

  -- 3. Verify captured amount and currency match expected catalog numbers
  if p_amount_cents <> v_order.expected_amount_cents or upper(p_currency) <> upper(v_order.currency) then
    update public.orders set
      status = 'failed',
      captured_amount_cents = p_amount_cents,
      provider_capture_id = p_capture_id
    where id = p_order_id;

    insert into public.admin_alerts (user_id, order_id, type, message, metadata)
    values (
      v_order.user_id,
      p_order_id,
      'amount_mismatch',
      'Captured amount or currency mismatch on order ' || p_order_id::text,
      jsonb_build_object(
        'expected_amount_cents', v_order.expected_amount_cents,
        'captured_amount_cents', p_amount_cents,
        'expected_currency', v_order.currency,
        'captured_currency', p_currency
      )
    );

    return jsonb_build_object(
      'success', false,
      'error', 'amount_mismatch',
      'order_id', p_order_id
    );
  end if;

  -- 4. Get package name for description
  select * into v_pkg from public.packages where id = v_order.package_id;

  if v_order.provider = 'manual' then
    v_desc := 'Manual bank/wire deposit for ' || coalesce(v_pkg.name, v_order.package_id);
  else
    v_desc := initcap(v_order.provider) || ' purchase of ' || coalesce(v_pkg.name, v_order.package_id);
  end if;

  -- 5. Atomic ledger_post (purchased bucket, positive delta)
  v_new_balance := public.ledger_post(
    v_order.user_id,
    'purchased',
    v_order.credits_to_grant,
    'package_purchase',
    v_order.id::text,
    'order:' || v_order.id::text || ':grant',
    v_desc
  );

  -- 6. Mark order fulfilled
  update public.orders set
    status = 'fulfilled',
    provider_capture_id = p_capture_id,
    captured_amount_cents = p_amount_cents,
    fulfilled_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'credits_granted', v_order.credits_to_grant,
    'new_balance', v_new_balance
  );
end;
$$;

revoke execute on function public.fulfill_order from public, anon;
grant execute on function public.fulfill_order to authenticated, service_role;

-- 4. Audited Manual Payment Confirmation Function
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

  -- Verify amount meets expected
  if p_amount_cents <> v_order.expected_amount_cents then
    raise exception 'amount_mismatch_expected_%_got_%', v_order.expected_amount_cents, p_amount_cents;
  end if;

  -- Fulfill via official order fulfillment
  v_fulfill_res := public.fulfill_order(
    p_order_id,
    p_bank_reference,
    p_amount_cents,
    v_order.currency
  );

  if not (v_fulfill_res->>'success')::boolean then
    raise exception 'fulfill_order_failed: %', (v_fulfill_res->>'error');
  end if;

  -- Log high-importance audit alert
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

revoke execute on function public.confirm_manual_payment from public, anon;
grant execute on function public.confirm_manual_payment to authenticated, service_role;
