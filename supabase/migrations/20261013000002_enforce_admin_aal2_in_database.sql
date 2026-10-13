-- ============================================================
-- MIGRATION: 20261013000002_enforce_admin_aal2_in_database.sql
-- Strictly enforces Authenticator Assurance Level 2 (AAL2) in database RLS.
-- User sessions with profiles.role = 'admin' are NOT granted admin access
-- in PostgreSQL RLS policies unless their session JWT proves 'aal2'.
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'),
    false
  ) or (
    coalesce((select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal') = 'aal2'), false)
    and
    coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
