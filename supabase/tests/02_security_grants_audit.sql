-- ============================================================
-- HUMANTEK STUDIO: SECURITY, RLS & RPC GRANTS AUDIT SUITE
-- Verifies zero unauthorized public/anon/authenticated access
-- ============================================================

do $$
declare
  r record;
  v_vuln_count int := 0;
  v_table_count int := 0;
begin
  raise notice '====================================================';
  raise notice 'RUNNING SECURITY & GRANTS AUDIT';
  raise notice '====================================================';

  -- -----------------------------------------------------------
  -- 1. FUNCTION PRIVILEGE AUDIT: Every public function must be false / false
  -- -----------------------------------------------------------
  raise notice 'Auditing function execute privileges for anon and authenticated...';
  for r in (
    select 
      p.proname,
      has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can_run,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_can_run
    from pg_proc p 
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ) loop
    if r.anon_can_run or r.authed_can_run then
      raise warning '[SECURITY RISK] Function % has public execute privileges! anon: %, authed: %',
        r.proname, r.anon_can_run, r.authed_can_run;
      v_vuln_count := v_vuln_count + 1;
    else
      raise notice '[PASS] Function % is locked (anon: false, authed: false)', r.proname;
    end if;
  end loop;

  if v_vuln_count > 0 then
    raise exception '[FAIL] % functions in schema public have exposed execute grants!', v_vuln_count;
  end if;

  -- -----------------------------------------------------------
  -- 2. ROW LEVEL SECURITY (RLS) AUDIT: Every public table must have relrowsecurity = true
  -- -----------------------------------------------------------
  raise notice 'Auditing Row Level Security (RLS) on public tables...';
  for r in (
    select 
      c.relname as table_name,
      c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in ('schema_migrations')
  ) loop
    v_table_count := v_table_count + 1;
    if not r.rls_enabled then
      raise warning '[SECURITY RISK] Table % does NOT have RLS enabled (relrowsecurity = false)!', r.table_name;
      v_vuln_count := v_vuln_count + 1;
    else
      raise notice '[PASS] Table % has RLS enabled (relrowsecurity = true)', r.table_name;
    end if;
  end loop;

  if v_table_count = 0 then
    raise exception '[FAIL] No public tables found to audit!';
  end if;

  if v_vuln_count > 0 then
    raise exception '[FAIL] % public tables lack Row Level Security!', v_vuln_count;
  end if;

  -- -----------------------------------------------------------
  -- 3. MUTATION AUDIT ON FINANCIAL TABLES
  -- Anon and Authenticated must have NO direct INSERT, UPDATE, DELETE on ledger & promo_codes
  -- -----------------------------------------------------------
  for r in (
    select unnest(array['credit_ledger', 'promo_codes']) as tbl
  ) loop
    if has_table_privilege('authenticated', 'public.' || r.tbl, 'INSERT') or
       has_table_privilege('authenticated', 'public.' || r.tbl, 'UPDATE') or
       has_table_privilege('authenticated', 'public.' || r.tbl, 'DELETE') or
       has_table_privilege('anon', 'public.' || r.tbl, 'INSERT') or
       has_table_privilege('anon', 'public.' || r.tbl, 'UPDATE') or
       has_table_privilege('anon', 'public.' || r.tbl, 'DELETE') then
      raise exception '[FAIL] Authenticated or anon roles have direct write privileges on sensitive table %!', r.tbl;
    else
      raise notice '[PASS] Sensitive table % writes are completely blocked from anon/authenticated', r.tbl;
    end if;
  end loop;

  raise notice '====================================================';
  raise notice 'ALL SECURITY AUDIT CHECKS PASSED (Zero public endpoints, RLS on all tables)';
  raise notice '====================================================';
end;
$$;
