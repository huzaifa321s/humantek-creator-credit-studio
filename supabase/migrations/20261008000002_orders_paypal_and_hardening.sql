-- ============================================================
-- MIGRATION 5: ORDERS, PAYPAL WEBHOOKS & SYSTEM HARDENING
-- ============================================================

-- 1. Hardening Wallets: Add is_frozen flag for chargeback / dispute defense
alter table public.wallets add column if not exists is_frozen boolean not null default false;

-- 2. Update spend_credits: Check wallet freeze status before any deduction
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

  -- Security check: Frozen wallet defense
  if w.is_frozen then
    raise exception 'wallet_is_frozen';
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

-- 3. Hardening Projects: Update create_project_and_spend_credits with scoped idempotency, pure wallet funding, and quantity validation
create or replace function public.create_project_and_spend_credits(
  p_project_id text,
  p_project_code text,
  p_user_id uuid,
  p_package_id text,
  p_funding_source text,
  p_client_name text,
  p_channel_name text,
  p_email text,
  p_platform text,
  p_style text,
  p_colors text,
  p_instructions text,
  p_uploaded_files jsonb,
  p_selections jsonb,
  p_additions jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pkg public.packages;
  v_services_credits integer := 0;
  v_additions_credits integer := 0;
  v_total_credits integer := 0;
  v_sel jsonb;
  v_svc public.services;
  v_unit_credits integer;
  v_line_total integer;
  v_add_name text;
  v_add_record public.additions;
  v_status text := 'pending_review';
  v_payment_status text := 'paid';
  v_payment_method text := 'credits';
  v_new_wallet_balance integer := 0;
  v_existing_proj record;
  v_qty_num numeric;
  v_qty_int integer;
begin
  -- 1. Idempotency Replay Check (Strictly Scoped to Calling User)
  if p_idempotency_key is not null and p_idempotency_key <> '' then
    select id, project_code, status, payment_status, total_credits, user_id
    into v_existing_proj
    from public.projects
    where idempotency_key = p_idempotency_key;

    if found then
      -- If the key exists but belongs to a different user, reject as unauthorized reuse
      if v_existing_proj.user_id <> p_user_id then
        raise exception 'idempotency_key_belongs_to_another_user';
      end if;

      return jsonb_build_object(
        'success', true,
        'replayed', true,
        'project_id', v_existing_proj.id,
        'project_code', v_existing_proj.project_code,
        'status', v_existing_proj.status,
        'payment_status', v_existing_proj.payment_status,
        'total_credits', v_existing_proj.total_credits
      );
    end if;
  end if;

  -- 2. Pure Wallet Funding Invariant
  -- PayPal captures deposit purchased credits in the wallet. Projects spend strictly from the wallet.
  if p_funding_source <> 'wallet' then
    raise exception 'invalid_funding_source_must_be_wallet';
  end if;

  select * into v_pkg from public.packages where id = coalesce(p_package_id, 'studio-wallet');
  if not found then
    select * into v_pkg from public.packages where id = 'studio-wallet';
  end if;

  -- 3. Validate and Calculate Selections strictly from Database
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'no_services_selected';
  end if;

  for v_sel in select * from jsonb_array_elements(p_selections) loop
    select * into v_svc from public.services
    where id = (v_sel->>'id') and is_active = true;

    if not found then
      raise exception 'unknown_service: %', (v_sel->>'id');
    end if;

    if (v_sel->>'level') is null or (v_sel->>'level')::int not in (0, 1, 2) then
      raise exception 'invalid_tier_level';
    end if;

    -- Strict quantity validation: integer only, between 1 and 20
    begin
      v_qty_num := (v_sel->>'quantity')::numeric;
      v_qty_int := (v_sel->>'quantity')::int;
    exception when others then
      raise exception 'invalid_quantity_format';
    end;

    if v_qty_num <> v_qty_int or v_qty_int < 1 or v_qty_int > 20 then
      raise exception 'quantity_out_of_range';
    end if;

    -- Compute credits strictly from database catalog prices
    if v_svc.quote_only then
      v_unit_credits := 0;
    elsif (v_sel->>'level')::int = 0 then
      v_unit_credits := v_svc.price_tier1;
    elsif (v_sel->>'level')::int = 1 then
      v_unit_credits := v_svc.price_tier2;
    else
      v_unit_credits := v_svc.price_tier3;
    end if;

    v_line_total := v_unit_credits * v_qty_int;
    v_services_credits := v_services_credits + v_line_total;
  end loop;

  -- 4. Validate and Price Additions strictly from Database
  if p_additions is not null and jsonb_typeof(p_additions) = 'array' and jsonb_array_length(p_additions) > 0 then
    for v_add_name in select jsonb_array_elements_text(p_additions) loop
      select * into v_add_record from public.additions where name = v_add_name and is_active = true;
      if not found then
        raise exception 'unknown_addition: %', v_add_name;
      end if;
      v_additions_credits := v_additions_credits + v_add_record.credits;
    end loop;
  end if;

  v_total_credits := v_services_credits + v_additions_credits;

  -- 5. Spend Credits Atomically from Wallet
  if v_total_credits > 0 then
    v_new_wallet_balance := public.spend_credits(
      p_user_id,
      v_total_credits,
      p_project_code,
      p_idempotency_key || ':spend',
      'Credits spent for order ' || p_project_code
    );
  else
    select balance_credits into v_new_wallet_balance from public.wallets where user_id = p_user_id;
  end if;

  -- 6. Insert Project Record
  insert into public.projects (
    id, project_code, user_id, package_id, package_name,
    funding_source, status, payment_status, payment_method,
    package_price_usd, package_credits, total_credits, applied_wallet_credits,
    client_name, channel_name, email, platform, style, colors, instructions,
    uploaded_files, idempotency_key, created_at, updated_at
  ) values (
    p_project_id, p_project_code, p_user_id, v_pkg.id, v_pkg.name,
    'wallet', v_status, v_payment_status, v_payment_method,
    0, 0, v_total_credits, v_total_credits,
    p_client_name, p_channel_name, p_email, p_platform, p_style, p_colors, p_instructions,
    coalesce(p_uploaded_files, '[]'::jsonb), p_idempotency_key, now(), now()
  );

  -- 7. Insert Project Items (Immutable Snapshots)
  for v_sel in select * from jsonb_array_elements(p_selections) loop
    select * into v_svc from public.services where id = (v_sel->>'id');

    if v_svc.quote_only then
      v_unit_credits := 0;
    elsif (v_sel->>'level')::int = 0 then
      v_unit_credits := v_svc.price_tier1;
    elsif (v_sel->>'level')::int = 1 then
      v_unit_credits := v_svc.price_tier2;
    else
      v_unit_credits := v_svc.price_tier3;
    end if;

    insert into public.project_items (
      project_id, service_id, service_name, tier_level, quantity, unit_credits, total_credits
    ) values (
      p_project_id, v_svc.id, v_svc.name, (v_sel->>'level')::int, (v_sel->>'quantity')::int,
      v_unit_credits, v_unit_credits * (v_sel->>'quantity')::int
    );
  end loop;

  -- 8. Insert Project Additions
  if p_additions is not null and jsonb_typeof(p_additions) = 'array' and jsonb_array_length(p_additions) > 0 then
    for v_add_name in select jsonb_array_elements_text(p_additions) loop
      select * into v_add_record from public.additions where name = v_add_name;
      insert into public.project_additions (project_id, name, unit_credits)
      values (p_project_id, v_add_record.name, v_add_record.credits);
    end loop;
  end if;

  -- 9. Record Initial Status History
  insert into public.project_status_history (project_id, old_status, new_status, changed_by, reason)
  values (p_project_id, null, v_status, p_user_id, 'Project created');

  return jsonb_build_object(
    'success', true,
    'replayed', false,
    'project_id', p_project_id,
    'project_code', p_project_code,
    'status', v_status,
    'payment_status', v_payment_status,
    'payment_method', v_payment_method,
    'total_credits', v_total_credits,
    'applied_wallet_credits', v_total_credits,
    'new_wallet_balance', v_new_wallet_balance
  );
end;
$$;

revoke execute on function public.create_project_and_spend_credits from public, anon, authenticated;
grant execute on function public.create_project_and_spend_credits to service_role;

-- 4. Orders Table (PayPal Orders & Package Purchases)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'paypal',
  package_id text not null references public.packages(id),
  credits_to_grant integer not null check (credits_to_grant > 0),
  expected_amount_cents integer not null check (expected_amount_cents > 0),
  currency text not null default 'USD',
  status text not null default 'created' check (status in
    ('created','approved','capture_pending','fulfilled','denied','failed','refunded','reversed')),
  provider_order_id   text unique,
  provider_capture_id text unique,
  captured_amount_cents integer,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_provider_order_id_idx on public.orders (provider_order_id);

-- 5. Webhook Events Table (Append-Only Ingestion Log)
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'paypal',
  event_id text not null unique,
  event_type text not null,
  order_id uuid references public.orders(id),
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists webhook_events_order_id_idx on public.webhook_events (order_id);

-- 6. Admin Alerts Table (Security alerts, chargebacks, and shortfalls)
create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  order_id uuid references public.orders(id),
  type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. Row Level Security Policies
alter table public.orders enable row level security;
alter table public.webhook_events enable row level security;
alter table public.admin_alerts enable row level security;

-- Orders: users read own orders; admins read all
drop policy if exists "users read own orders or admin" on public.orders;
create policy "users read own orders or admin" on public.orders for select to authenticated
  using ((user_id = (select auth.uid())) or public.is_admin());

-- Webhook events: zero client access; admins only
drop policy if exists "admin read webhook events" on public.webhook_events;
create policy "admin read webhook events" on public.webhook_events for select to authenticated
  using (public.is_admin());

-- Admin alerts: admins only
drop policy if exists "admin read alerts" on public.admin_alerts;
create policy "admin read alerts" on public.admin_alerts for select to authenticated
  using (public.is_admin());

-- Revoke mutation grants explicitly from client roles
revoke insert, update, delete, truncate on table public.orders from anon, authenticated;
revoke insert, update, delete, truncate on table public.webhook_events from anon, authenticated;
revoke insert, update, delete, truncate on table public.admin_alerts from anon, authenticated;

-- 8. Order Fulfillment Function (The ONLY place purchase credits are granted)
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
begin
  -- 1. Lock the order row
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- 2. Idempotency: If already fulfilled, return cleanly (safe for webhook / capture race conditions)
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

  -- 5. Atomic ledger_post (purchased bucket, positive delta)
  v_new_balance := public.ledger_post(
    v_order.user_id,
    'purchased',
    v_order.credits_to_grant,
    'package_purchase',
    v_order.id::text,
    'order:' || v_order.id::text || ':grant',
    'PayPal purchase of ' || coalesce(v_pkg.name, v_order.package_id)
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
    'already_fulfilled', false,
    'order_id', v_order.id,
    'credits_granted', v_order.credits_to_grant,
    'new_balance', v_new_balance
  );
end;
$$;

revoke execute on function public.fulfill_order from public, anon, authenticated;
grant execute on function public.fulfill_order to service_role;

-- 9. Refund Handler Function
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
  v_ledger_success boolean := false;
  v_idemp_key text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'refunded' then
    return jsonb_build_object('success', true, 'already_refunded', true, 'order_id', p_order_id);
  end if;

  v_idemp_key := 'order:' || v_order.id::text || ':refund:' || p_refund_id;

  -- Attempt posting refund_cash (negative delta in purchased bucket)
  begin
    perform public.ledger_post(
      v_order.user_id,
      'purchased',
      -v_order.credits_to_grant,
      'refund_cash',
      v_order.id::text,
      v_idemp_key,
      'Refund for PayPal order ' || v_order.id::text
    );
    v_ledger_success := true;
  exception when others then
    -- CHECK constraint blocked clawback because user already spent the credits
    v_ledger_success := false;
  end;

  if not v_ledger_success then
    -- Freeze the wallet, log alert for admin review, and allow handler to succeed
    update public.wallets set is_frozen = true where user_id = v_order.user_id;

    insert into public.admin_alerts (user_id, order_id, type, message, metadata)
    values (
      v_order.user_id,
      p_order_id,
      'refund_shortfall',
      'Refund clawback blocked because credits were already spent. Wallet frozen.',
      jsonb_build_object(
        'credits_to_grant', v_order.credits_to_grant,
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
    'clawback_success', v_ledger_success,
    'wallet_frozen', not v_ledger_success
  );
end;
$$;

revoke execute on function public.handle_refund from public, anon, authenticated;
grant execute on function public.handle_refund to service_role;

-- 10. Reversal / Chargeback Handler Function
create or replace function public.handle_reversal(
  p_order_id uuid,
  p_reversal_id text,
  p_reason text default 'PayPal dispute reversal'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_ledger_success boolean := false;
  v_idemp_key text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'reversed' then
    return jsonb_build_object('success', true, 'already_reversed', true, 'order_id', p_order_id);
  end if;

  v_idemp_key := 'order:' || v_order.id::text || ':reversal:' || p_reversal_id;

  -- Attempt posting chargeback (negative delta in purchased bucket)
  begin
    perform public.ledger_post(
      v_order.user_id,
      'purchased',
      -v_order.credits_to_grant,
      'chargeback',
      v_order.id::text,
      v_idemp_key,
      'Chargeback for order ' || v_order.id::text
    );
    v_ledger_success := true;
  exception when others then
    v_ledger_success := false;
  end;

  -- Chargebacks immediately freeze the wallet and alert admin
  update public.wallets set is_frozen = true where user_id = v_order.user_id;

  insert into public.admin_alerts (user_id, order_id, type, message, metadata)
  values (
    v_order.user_id,
    p_order_id,
    'chargeback_alert',
    'Chargeback received. Wallet frozen for security review.',
    jsonb_build_object(
      'reversal_id', p_reversal_id,
      'clawback_success', v_ledger_success,
      'reason', p_reason
    )
  );

  update public.orders set
    status = 'reversed'
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'clawback_success', v_ledger_success,
    'wallet_frozen', true
  );
end;
$$;

revoke execute on function public.handle_reversal from public, anon, authenticated;
grant execute on function public.handle_reversal to service_role;
