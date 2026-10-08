-- ============================================================
-- MIGRATION: AUDIT DATABASE GRANTS HELPER
-- ============================================================

create or replace function public.audit_database_grants()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funcs jsonb;
  v_tables jsonb;
begin
  if not public.is_admin() then
    raise exception 'unauthorized_admin_required';
  end if;

  select jsonb_agg(jsonb_build_object(
    'routine_name', p.proname,
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )) into v_funcs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'fulfill_order', 'handle_refund', 'handle_reversal', 'confirm_manual_payment',
      'update_project_status', 'spend_credits', 'redeem_promo', 'ledger_post', 'is_admin'
    );

  select jsonb_agg(jsonb_build_object(
    'table_name', tablename,
    'anon_select', has_table_privilege('anon', 'public.' || tablename, 'SELECT'),
    'anon_insert', has_table_privilege('anon', 'public.' || tablename, 'INSERT'),
    'anon_update', has_table_privilege('anon', 'public.' || tablename, 'UPDATE'),
    'anon_delete', has_table_privilege('anon', 'public.' || tablename, 'DELETE'),
    'authenticated_select', has_table_privilege('authenticated', 'public.' || tablename, 'SELECT'),
    'authenticated_insert', has_table_privilege('authenticated', 'public.' || tablename, 'INSERT'),
    'authenticated_update', has_table_privilege('authenticated', 'public.' || tablename, 'UPDATE'),
    'authenticated_delete', has_table_privilege('authenticated', 'public.' || tablename, 'DELETE')
  )) into v_tables
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'wallets', 'credit_ledger', 'orders', 'projects', 'promo_codes', 
      'admin_alerts', 'webhook_events', 'project_status_history'
    );

  return jsonb_build_object('functions', v_funcs, 'tables', v_tables);
end;
$$;

revoke execute on function public.audit_database_grants from public, anon, authenticated;
grant execute on function public.audit_database_grants to service_role;
