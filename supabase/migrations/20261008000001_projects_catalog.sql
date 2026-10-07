-- ============================================================
-- MIGRATION 4: CATALOG, PROJECTS & ATOMIC SPEND/REFUND PIPELINE
-- ============================================================

-- 1. Helper function for RLS: check if current user is admin
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Packages Table
create table if not exists public.packages (
  id text primary key,
  name text not null,
  price_usd numeric(10, 2) not null default 0,
  credits integer not null default 0,
  group_name text,
  best_for text,
  max_level integer not null default 2,
  standard_limit integer,
  elite_limit integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Services Catalog Table
create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  price_tier1 integer not null default 0,
  price_tier2 integer not null default 0,
  price_tier3 integer not null default 0,
  quote_only boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. Additions Catalog Table
create table if not exists public.additions (
  id text primary key,
  name text not null unique,
  credits integer not null check (credits >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed Packages
insert into public.packages (id, name, price_usd, credits, group_name, best_for, max_level, standard_limit, elite_limit)
values
  ('creator-forge', 'Creator Forge', 1500, 660, 'Foundation', 'Basic services plus up to two Standard service units', 1, 2, 0),
  ('studio-momentum', 'Studio Momentum', 2500, 1160, 'Most Popular', 'Basic and Standard services plus up to two Elite service units', 2, null, 2),
  ('signature-collective', 'Signature Collective', 4000, 1920, 'Full Access', 'Full tier access controlled by the available credit balance', 2, null, null),
  ('studio-wallet', 'Studio Wallet Balance', 0, 0, 'Studio Wallet', 'Funded directly from your available global studio credit balance with $0 USD checkout.', 2, null, null)
on conflict (id) do update set
  name = excluded.name,
  price_usd = excluded.price_usd,
  credits = excluded.credits,
  group_name = excluded.group_name,
  best_for = excluded.best_for,
  max_level = excluded.max_level,
  standard_limit = excluded.standard_limit,
  elite_limit = excluded.elite_limit;

-- Seed Additions
insert into public.additions (id, name, credits)
values
  ('extra-revision-round', 'Extra revision round', 20),
  ('additional-size-platform', 'Additional size / platform', 15),
  ('additional-concept', 'Additional concept', 25),
  ('rush-delivery-request', 'Rush delivery request', 50)
on conflict (id) do update set
  name = excluded.name,
  credits = excluded.credits;

-- Seed Services Catalog
insert into public.services (id, name, category, description, price_tier1, price_tier2, price_tier3, quote_only)
values
  ('logo', 'Logo', 'Branding', 'Text, mascot or premium VTuber logo package.', 32, 88, 180, false),
  ('animated-logo', 'Animated Logo', 'Branding', 'A motion-ready version of your identity.', 52, 84, 136, false),
  ('banner', 'Banner', 'Branding', 'A platform-ready branded channel header.', 28, 72, 140, false),
  ('animated-banner', 'Animated Banner', 'Branding', 'A motion banner for supported platforms.', 80, 136, 180, false),
  ('emote', 'Emotes Package', 'Stream', 'A coordinated custom emote bundle.', 24, 64, 128, false),
  ('animated-emote', 'Animated Emotes Package', 'Stream', 'A coordinated animated emote bundle.', 48, 128, 256, false),
  ('alert', 'Alert', 'Stream', 'One static stream alert asset.', 16, 24, 32, false),
  ('animated-alert', 'Animated Alert', 'Stream', 'One animated stream alert asset.', 20, 32, 48, false),
  ('overlays', 'Overlays 3×', 'Stream', 'Face, chat and gameplay overlays.', 40, 84, 120, false),
  ('animated-overlays', 'Animated Overlays 3×', 'Stream', 'Three coordinated animated overlays.', 80, 136, 192, false),
  ('static-screen', 'Static Stream Screen', 'Stream', 'Starting, BRB or ending screen.', 40, 76, 100, false),
  ('animated-screen', '2D Animation Package', 'Animation', 'A scoped 2D or Live2D-ready animation package.', 72, 220, 440, false),
  ('3d-screen', '3D Animation Package', 'Animation', 'A scoped 3D character animation package.', 100, 280, 600, false),
  ('sub-badge', 'Sub Badges Package', 'Stream', 'A coordinated subscriber badge set.', 20, 48, 100, false),
  ('panel', 'Panels Package', 'Stream', 'A coordinated channel panel set.', 24, 60, 120, false),
  ('channel-point', 'Channel Point', 'Stream', 'One custom channel-point icon.', 8, 16, 16, false),
  ('animated-channel-point', 'Animated Channel Point', 'Stream', 'A motion channel-point reward.', 20, 35, 55, false),
  ('lower-third', 'Lower Third Animation', 'Animation', 'Animated name or information graphic.', 48, 104, 160, false),
  ('pngtuber', 'PNGTuber', 'VTuber', 'A reactive illustrated avatar set.', 140, 240, 380, false),
  ('vtuber-2d', 'VTuber Model Package', 'VTuber', 'A 2D or Live2D creator-model package.', 260, 640, 1280, false),
  ('vtuber-3d', '3D Live VTuber Model', 'VTuber', 'A detailed 3D creator model.', 572, 1172, 1800, false),
  ('toggle', 'Model Toggle', 'VTuber', 'One approved model toggle or variation.', 100, 144, 180, false),
  ('illustration', 'Digital Illustration', 'Artwork', 'A polished illustration within approved scope.', 40, 112, 220, false),
  ('stream-avatar', 'Stream Avatar', 'Artwork', 'A channel-ready creator avatar.', 80, 150, 240, false),
  ('character-art', 'Character / Furry Artwork', 'Artwork', 'Character work reviewed against content guidelines.', 0, 0, 0, true),
  ('oc-sheet', 'OC Reference Sheet', 'Artwork', 'A clear multi-view original-character reference.', 220, 360, 520, false),
  ('thumbnail', 'Thumbnail', 'Content', 'A platform-ready video thumbnail.', 20, 35, 55, false),
  ('montage', 'Montage', 'Content', 'Edited montage from supplied footage.', 120, 220, 360, false),
  ('intro', 'Intro', 'Content', 'A branded video or stream introduction.', 90, 160, 260, false),
  ('outro', 'Outro', 'Content', 'A branded closing sequence.', 90, 160, 260, false),
  ('intermission', 'Intermission Screen', 'Content', 'A designed intermission scene.', 60, 100, 150, false),
  ('channel-trailer', 'Channel Trailer', 'Content', 'A concise channel introduction edit.', 180, 320, 520, false),
  ('merch', 'Merch Design', 'Branding', 'Artwork prepared for approved merchandise.', 80, 160, 280, false),
  ('3d-model', '3D Model', '3D', 'Starting scope; complexity requires team review.', 900, 1300, 1800, false),
  ('reels-4', 'Video Editing — 4 Reels', 'Content', 'Four edited reels from supplied footage.', 160, 240, 400, false),
  ('reels-8', 'Video Editing — 8 Reels', 'Content', 'Eight coordinated reels with volume value.', 320, 480, 800, false),
  ('reels-12', 'Video Editing — 12 Reels', 'Content', 'A larger monthly short-form content batch.', 480, 720, 1200, false),
  ('reels-16', 'Video Editing — 16 Reels', 'Content', 'High-volume short-form production for active creators.', 640, 960, 1600, false),
  ('custom', 'Other Custom Request', 'Custom', 'Unlisted work; team review required.', 0, 0, 0, true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  price_tier1 = excluded.price_tier1,
  price_tier2 = excluded.price_tier2,
  price_tier3 = excluded.price_tier3,
  quote_only = excluded.quote_only;

-- 5. Projects Table
create table if not exists public.projects (
  id text primary key,
  project_code text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  package_id text references public.packages(id),
  package_name text not null default '',
  funding_source text not null check (funding_source in ('wallet', 'package', 'hybrid')),
  status text not null default 'pending_review' check (status in ('pending_review', 'payment_confirmed', 'in_production', 'review_round', 'delivered', 'declined', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  payment_method text not null default 'unpaid',
  package_price_usd numeric(10, 2) not null default 0,
  package_credits integer not null default 0,
  total_credits integer not null default 0,
  applied_wallet_credits integer not null default 0,
  client_name text not null,
  channel_name text,
  email text not null,
  platform text,
  style text,
  colors text,
  instructions text,
  uploaded_files jsonb not null default '[]'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_status_idx on public.projects (status);

-- 6. Project Items Table (Immutable Snapshot of Selection & Unit Price at Creation)
create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  service_id text not null references public.services(id),
  service_name text not null,
  tier_level integer not null check (tier_level in (0, 1, 2)),
  quantity integer not null check (quantity >= 1),
  unit_credits integer not null check (unit_credits >= 0),
  total_credits integer not null check (total_credits >= 0),
  created_at timestamptz not null default now()
);

create index if not exists project_items_project_id_idx on public.project_items (project_id);

-- 7. Project Additions Table
create table if not exists public.project_additions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  unit_credits integer not null check (unit_credits >= 0),
  created_at timestamptz not null default now()
);

create index if not exists project_additions_project_id_idx on public.project_additions (project_id);

-- 8. Project Status History Table
create table if not exists public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists project_status_history_project_id_idx on public.project_status_history (project_id, created_at asc);

-- 9. Row Level Security Policies
alter table public.packages enable row level security;
alter table public.services enable row level security;
alter table public.additions enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.project_additions enable row level security;
alter table public.project_status_history enable row level security;

-- Public can read active catalog
drop policy if exists "allow read packages" on public.packages;
create policy "allow read packages" on public.packages for select using (is_active = true);

drop policy if exists "allow read services" on public.services;
create policy "allow read services" on public.services for select using (is_active = true);

drop policy if exists "allow read additions" on public.additions;
create policy "allow read additions" on public.additions for select using (is_active = true);

-- Projects: Users see their own; Admins see all
drop policy if exists "users read own projects or admin" on public.projects;
create policy "users read own projects or admin" on public.projects for select to authenticated
  using ((user_id = (select auth.uid())) or public.is_admin());

-- Project Items: Users see items for their projects or admin
drop policy if exists "users read own project items or admin" on public.project_items;
create policy "users read own project items or admin" on public.project_items for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_items.project_id and (p.user_id = (select auth.uid()) or public.is_admin())));

-- Project Additions: Users see additions for their projects or admin
drop policy if exists "users read own project additions or admin" on public.project_additions;
create policy "users read own project additions or admin" on public.project_additions for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_additions.project_id and (p.user_id = (select auth.uid()) or public.is_admin())));

-- Project Status History: Users see history for their projects or admin
drop policy if exists "users read own project history or admin" on public.project_status_history;
create policy "users read own project history or admin" on public.project_status_history for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_status_history.project_id and (p.user_id = (select auth.uid()) or public.is_admin())));

-- Revoke mutation grants on projects tables from anon/authenticated (all writes go through trusted RPC or service_role)
revoke insert, update, delete on table public.packages from anon, authenticated;
revoke insert, update, delete on table public.services from anon, authenticated;
revoke insert, update, delete on table public.additions from anon, authenticated;
revoke insert, update, delete on table public.projects from anon, authenticated;
revoke insert, update, delete on table public.project_items from anon, authenticated;
revoke insert, update, delete on table public.project_additions from anon, authenticated;
revoke insert, update, delete on table public.project_status_history from anon, authenticated;

-- 10. Atomic Project Creation & Spend Function (Database Authoritative Pricing)
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
  v_standard_units integer := 0;
  v_elite_units integer := 0;
  v_sel jsonb;
  v_svc public.services;
  v_unit_credits integer;
  v_line_total integer;
  v_add_name text;
  v_add_record public.additions;
  v_status text := 'pending_review';
  v_payment_status text := 'unpaid';
  v_payment_method text := 'unpaid';
  v_applied_wallet_credits integer := 0;
  v_package_price numeric(10, 2) := 0;
  v_package_credits integer := 0;
  v_wallet_to_spend integer := 0;
  v_new_wallet_balance integer := 0;
  v_existing_id text;
  v_existing_proj record;
begin
  -- 1. Idempotency Replay Check
  if p_idempotency_key is not null and p_idempotency_key <> '' then
    select id, project_code, status, payment_status, total_credits
    into v_existing_proj
    from public.projects
    where idempotency_key = p_idempotency_key;

    if found then
      -- Replay: return existing project representation
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

  -- 2. Validate Package
  if p_package_id is not null and p_package_id <> '' then
    select * into v_pkg from public.packages where id = p_package_id and is_active = true;
    if not found then
      raise exception 'invalid_package: %', p_package_id;
    end if;
    v_package_price := v_pkg.price_usd;
    v_package_credits := v_pkg.credits;
  else
    if p_funding_source <> 'wallet' then
      raise exception 'missing_package';
    end if;
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

    if (v_sel->>'level')::int not in (0, 1, 2) then
      raise exception 'invalid_tier_level';
    end if;

    if (v_sel->>'quantity')::int < 1 or (v_sel->>'quantity')::int > 20 then
      raise exception 'quantity_out_of_range';
    end if;

    -- Tier restrictions
    if (v_sel->>'level')::int > v_pkg.max_level then
      raise exception 'tier_exceeds_package_level';
    end if;

    if (v_sel->>'level')::int = 1 then
      v_standard_units := v_standard_units + (v_sel->>'quantity')::int;
    elsif (v_sel->>'level')::int = 2 then
      v_elite_units := v_elite_units + (v_sel->>'quantity')::int;
    end if;

    -- Compute credits strictly from catalog prices
    if v_svc.quote_only then
      v_unit_credits := 0;
    elsif (v_sel->>'level')::int = 0 then
      v_unit_credits := v_svc.price_tier1;
    elsif (v_sel->>'level')::int = 1 then
      v_unit_credits := v_svc.price_tier2;
    else
      v_unit_credits := v_svc.price_tier3;
    end if;

    v_line_total := v_unit_credits * (v_sel->>'quantity')::int;
    v_services_credits := v_services_credits + v_line_total;
  end loop;

  -- Check package standard/elite limits if not pure wallet funding
  if p_funding_source <> 'wallet' then
    if v_pkg.standard_limit is not null and v_standard_units > v_pkg.standard_limit then
      raise exception 'standard_tier_limit_exceeded';
    end if;
    if v_pkg.elite_limit is not null and v_elite_units > v_pkg.elite_limit then
      raise exception 'elite_tier_limit_exceeded';
    end if;
  end if;

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

  -- 5. Funding Source & Credits Settlement
  if p_funding_source = 'wallet' then
    v_wallet_to_spend := v_total_credits;
    v_applied_wallet_credits := v_total_credits;
    v_package_price := 0;
    v_status := 'pending_review';
    v_payment_status := 'paid';
    v_payment_method := 'credits';

    -- Spend credits atomically: Insufficient balance or error rolls back transaction!
    if v_wallet_to_spend > 0 then
      v_new_wallet_balance := public.spend_credits(
        p_user_id,
        v_wallet_to_spend,
        p_project_code,
        p_idempotency_key || ':spend',
        'Credits spent for order ' || p_project_code
      );
    end if;
  elsif p_funding_source = 'package' then
    if v_total_credits > v_package_credits then
      raise exception 'credits_exceed_package_budget';
    end if;
    v_status := 'pending_review';
    v_payment_status := 'unpaid';
    v_payment_method := 'unpaid';
  elsif p_funding_source = 'hybrid' then
    -- Hybrid: Package covers up to v_package_credits; surplus covered by wallet
    v_wallet_to_spend := greatest(0, v_total_credits - v_package_credits);
    v_applied_wallet_credits := v_wallet_to_spend;
    v_status := 'pending_review';
    v_payment_status := 'unpaid';
    v_payment_method := 'unpaid';

    if v_wallet_to_spend > 0 then
      v_new_wallet_balance := public.spend_credits(
        p_user_id,
        v_wallet_to_spend,
        p_project_code,
        p_idempotency_key || ':spend',
        'Wallet credits applied to project ' || p_project_code
      );
    end if;
  else
    raise exception 'invalid_funding_source: %', p_funding_source;
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
    p_funding_source, v_status, v_payment_status, v_payment_method,
    v_package_price, v_package_credits, v_total_credits, v_applied_wallet_credits,
    p_client_name, p_channel_name, p_email, p_platform, p_style, p_colors, p_instructions,
    coalesce(p_uploaded_files, '[]'::jsonb), p_idempotency_key, now(), now()
  );

  -- 7. Insert Project Items (Snapshots)
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
  if p_additions is not null and jsonb_array_length(p_additions) > 0 then
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
    'applied_wallet_credits', v_applied_wallet_credits,
    'new_wallet_balance', v_new_wallet_balance
  );
end;
$$;

revoke execute on function public.create_project_and_spend_credits from public, anon, authenticated;
grant execute on function public.create_project_and_spend_credits to service_role;

-- 11. Atomic Project Cancellation & Credit Restoration Function
create or replace function public.cancel_project_and_refund(
  p_project_id text,
  p_user_id uuid,
  p_reason text default 'Cancelled by client'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proj public.projects;
  v_r record;
  v_refunded_credits integer := 0;
  v_is_caller_admin boolean;
  v_new_payment_status text;
begin
  -- Lock project row to serialize cancellations
  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found';
  end if;

  -- Authorization: User must own the project or be an admin
  select exists (
    select 1 from public.profiles where id = p_user_id and role = 'admin'
  ) into v_is_caller_admin;

  if v_proj.user_id <> p_user_id and not v_is_caller_admin then
    raise exception 'unauthorized';
  end if;

  -- Idempotency: Second cancellation is a safe no-op
  if v_proj.status = 'cancelled' then
    return jsonb_build_object(
      'success', true,
      'already_cancelled', true,
      'project_id', v_proj.id,
      'status', v_proj.status,
      'payment_status', v_proj.payment_status
    );
  end if;

  -- Delivered projects cannot be cancelled
  if v_proj.status = 'delivered' then
    raise exception 'cannot_cancel_delivered_project';
  end if;

  -- Restore deducted credits to their EXACT original bucket (promo vs purchased)
  for v_r in (
    select id, bucket, delta, idempotency_key
    from public.credit_ledger
    where user_id = v_proj.user_id
      and reference_id = v_proj.project_code
      and type = 'service_deduction'
      and id not in (
        select reverses_id from public.credit_ledger where reverses_id is not null
      )
  ) loop
    -- Post reversal restoring exact bucket
    perform public.ledger_post(
      p_user := v_proj.user_id,
      p_bucket := v_r.bucket,
      p_delta := -v_r.delta, -- restores positive delta
      p_type := 'refund_wallet',
      p_ref := v_proj.project_code,
      p_key := 'refund:' || v_r.idempotency_key,
      p_desc := 'Refund for cancelled project ' || v_proj.project_code,
      p_reverses_id := v_r.id
    );
    v_refunded_credits := v_refunded_credits + (-v_r.delta);
  end loop;

  v_new_payment_status := case
    when v_proj.payment_status = 'paid' then 'refunded'
    else v_proj.payment_status
  end;

  -- Update project status
  update public.projects set
    status = 'cancelled',
    payment_status = v_new_payment_status,
    updated_at = now()
  where id = p_project_id;

  -- Record status history
  insert into public.project_status_history (
    project_id, old_status, new_status, changed_by, reason
  ) values (
    p_project_id, v_proj.status, 'cancelled', p_user_id, p_reason
  );

  return jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'project_id', p_project_id,
    'project_code', v_proj.project_code,
    'status', 'cancelled',
    'payment_status', v_new_payment_status,
    'refunded_credits', v_refunded_credits
  );
end;
$$;

revoke execute on function public.cancel_project_and_refund from public, anon, authenticated;
grant execute on function public.cancel_project_and_refund to service_role;
