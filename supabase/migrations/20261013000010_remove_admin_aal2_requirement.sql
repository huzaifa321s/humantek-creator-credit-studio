-- ============================================================
-- MIGRATION: 20261013000010_remove_admin_aal2_requirement.sql
-- Reverts is_admin() to check profiles.role = 'admin' directly,
-- completely removing any Authenticator Assurance Level (AAL2 / MFA) requirement.
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'),
    false
  ) or (
    coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
