-- ============================================================
-- MIGRATION 20261021000001: PRODUCTION CLEAN WIPE (PRESERVE ONLY admin-credits@humantekart.com)
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- 1. Find master admin ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE lower(email) IN ('admin-credits@humantekart.com', 'admin@humantek.art')
  LIMIT 1;

  -- Ensure master admin email in auth.users is admin-credits@humantekart.com
  IF v_admin_id IS NOT NULL THEN
    UPDATE auth.users
    SET email = 'admin-credits@humantekart.com',
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin","team_role":"owner"}'::jsonb
    WHERE id = v_admin_id;
  END IF;

  -- 2. Temporarily disable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger DISABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 3. Truncate all project, chat, upload, notification, order, and ledger tables
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_message_attachments') THEN
    TRUNCATE TABLE public.project_message_attachments CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_messages') THEN
    TRUNCATE TABLE public.project_messages CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_read_states') THEN
    TRUNCATE TABLE public.project_read_states CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_status_history') THEN
    TRUNCATE TABLE public.project_status_history CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_items') THEN
    TRUNCATE TABLE public.project_items CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_additions') THEN
    TRUNCATE TABLE public.project_additions CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_uploads') THEN
    TRUNCATE TABLE public.project_uploads CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    TRUNCATE TABLE public.notifications CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_alerts') THEN
    TRUNCATE TABLE public.admin_alerts CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'webhook_events') THEN
    TRUNCATE TABLE public.webhook_events CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    TRUNCATE TABLE public.orders CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects') THEN
    TRUNCATE TABLE public.projects CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'promo_redemptions') THEN
    TRUNCATE TABLE public.promo_redemptions CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_ledger') THEN
    TRUNCATE TABLE public.credit_ledger RESTART IDENTITY CASCADE;
  END IF;

  -- 4. Re-enable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger ENABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 5. Keep standard studio promo codes reset to 0 uses
  DELETE FROM public.promo_codes
  WHERE code NOT IN ('HT-50CR-WELCOME', 'HT-150CR-STUDIO');
  UPDATE public.promo_codes SET used_count = 0;

  -- 6. Delete all wallets except master admin, and reset admin wallet to 0 CR
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM public.wallets WHERE user_id <> v_admin_id;
    INSERT INTO public.wallets (user_id, balance_purchased, balance_promo, is_frozen, updated_at)
    VALUES (v_admin_id, 0, 0, false, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance_purchased = 0,
      balance_promo = 0,
      is_frozen = false,
      updated_at = NOW();
  ELSE
    TRUNCATE TABLE public.wallets CASCADE;
  END IF;

  -- 7. Delete all profiles except master admin
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id <> v_admin_id;
    INSERT INTO public.profiles (id, email, role, team_role, full_name, created_at)
    VALUES (v_admin_id, 'admin-credits@humantekart.com', 'admin', 'owner', 'Humantek Admin', NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = 'admin-credits@humantekart.com',
      role = 'admin',
      team_role = 'owner',
      full_name = 'Humantek Admin',
      avatar_url = null;
  ELSE
    TRUNCATE TABLE public.profiles CASCADE;
  END IF;

  -- 8. Delete all non-admin auth records
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM auth.mfa_factors WHERE user_id <> v_admin_id;
    DELETE FROM auth.identities WHERE user_id <> v_admin_id;
    DELETE FROM auth.sessions WHERE user_id <> v_admin_id;
    DELETE FROM auth.users WHERE id <> v_admin_id;
  END IF;

END $$;
