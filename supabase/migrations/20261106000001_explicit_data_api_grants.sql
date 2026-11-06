-- ============================================================
-- MIGRATION: EXPLICIT DATA API GRANTS (SUPABASE OCT 30 POLICY)
-- Ensures all public tables and sequences have explicit grants
-- for service_role, authenticated, and anon while preserving
-- strict least-privilege rules on financial & audit tables.
-- ============================================================

-- 1. Schema usage grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Full backend access for service_role across all tables & sequences
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Public catalog tables (read-only for guests and signed-in users)
REVOKE ALL ON TABLE
  public.packages,
  public.services,
  public.additions
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.packages,
  public.services,
  public.additions
TO anon, authenticated;

-- 4. Financial & audit tables (read-only via RLS for authenticated; all writes strictly via service_role / RPC)
REVOKE ALL ON TABLE
  public.wallets,
  public.credit_ledger,
  public.promo_codes,
  public.promo_redemptions,
  public.orders,
  public.project_status_history,
  public.admin_alerts,
  public.login_history
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.wallets,
  public.credit_ledger,
  public.promo_codes,
  public.promo_redemptions,
  public.orders,
  public.project_status_history,
  public.admin_alerts,
  public.login_history
TO authenticated;

-- 5. Backend-only system tables (service_role only)
REVOKE ALL ON TABLE
  public.webhook_events,
  public.cron_runs
FROM anon, authenticated;

-- 6. Interactive workspace tables (governed by Row Level Security policies for authenticated users)
REVOKE ALL ON TABLE
  public.profiles,
  public.projects,
  public.project_items,
  public.project_additions,
  public.project_messages,
  public.project_read_states,
  public.project_message_attachments,
  public.notifications,
  public.project_uploads
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.projects,
  public.project_items,
  public.project_additions,
  public.project_messages,
  public.project_read_states,
  public.project_message_attachments,
  public.notifications,
  public.project_uploads
TO authenticated;

-- 7. Sequence usage for authenticated inserts where RLS permits
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 8. Lock down helper trigger function on login_history from public execution
REVOKE EXECUTE ON FUNCTION public.cap_login_history_rows() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cap_login_history_rows() TO service_role;
