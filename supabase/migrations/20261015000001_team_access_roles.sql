-- ============================================================================
-- Migration: 20261015000001_team_access_roles.sql
-- Purpose: Add granular team_role ('owner' | 'manager' | 'viewer') to profiles
--          while preserving profiles.role = 'admin' for RLS compatibility.
-- ============================================================================

alter table public.profiles
  add column if not exists team_role text
    check (team_role is null or team_role in ('owner', 'manager', 'viewer'));

-- Seed existing admin accounts: earliest / primary owner becomes 'owner', others become 'manager'
with ordered_admins as (
  select
    id,
    email,
    row_number() over (
      order by
        case
          when lower(email) in ('saadahmed7066@gmail.com', 'admin@humantek.art') then 0
          else 1
        end,
        created_at asc
    ) as rn
  from public.profiles
  where role = 'admin'
)
update public.profiles p
set team_role = case when oa.rn = 1 then 'owner' else 'manager' end
from ordered_admins oa
where p.id = oa.id
  and p.team_role is null;
