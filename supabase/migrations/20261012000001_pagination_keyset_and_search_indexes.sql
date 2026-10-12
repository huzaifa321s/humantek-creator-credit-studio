-- ==============================================================================
-- Migration: 20261012000001_pagination_keyset_and_search_indexes.sql
-- Description: Indexes for keyset cursor pagination, filtering, and search performance
-- ==============================================================================

-- 1. Client keyset cursor pagination: (user_id, created_at desc, id desc)
create index if not exists projects_user_id_created_at_id_idx
  on public.projects (user_id, created_at desc, id desc);

-- 2. Admin keyset cursor pagination: (created_at desc, id desc)
create index if not exists projects_created_at_id_idx
  on public.projects (created_at desc, id desc);

-- 3. Projects status filtering with timestamp ordering
create index if not exists projects_status_created_at_idx
  on public.projects (status, created_at desc);

-- 4. Projects payment status filtering
create index if not exists projects_payment_status_created_at_idx
  on public.projects (payment_status, created_at desc);

-- 5. Fast project code lookups (HT-XXXX-YYYY)
create index if not exists projects_project_code_idx
  on public.projects (project_code);

-- 6. Orders table pagination and status index
create index if not exists orders_created_at_id_idx
  on public.orders (created_at desc, id desc);

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);

-- 7. Admin alerts pagination index
create index if not exists admin_alerts_created_at_id_idx
  on public.admin_alerts (created_at desc, id desc);

-- 8. Credit ledger pagination index
create index if not exists credit_ledger_created_at_id_idx
  on public.credit_ledger (created_at desc, id desc);
