-- ============================================================
-- MIGRATION 20261019000001: FRESH DATABASE RESET (PRESERVE ADMINS ONLY)
-- Preserves ONLY:
--   - admin@humantek.art
--   - huzaifa14321furqan@gmail.com
-- ============================================================

DO $$
BEGIN
  -- 1. Temporarily disable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger DISABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 2. Truncate all project, chat, upload, notification, order, and ledger tables
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

  -- 3. Re-enable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger ENABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 4. Keep standard studio promo codes reset to 0 uses
  DELETE FROM public.promo_codes
  WHERE code NOT IN ('HT-50CR-WELCOME', 'HT-150CR-STUDIO');
  UPDATE public.promo_codes SET used_count = 0;

  -- 5. Delete all wallets except preserved admins, and reset admin wallets
  DELETE FROM public.wallets
  WHERE user_id NOT IN (
    SELECT id FROM auth.users
    WHERE lower(email) IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com')
  );

  -- 6. Delete all profiles except preserved admins
  DELETE FROM public.profiles
  WHERE lower(email) NOT IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com');

  -- Ensure preserved profiles are marked as admin
  INSERT INTO public.profiles (id, email, role, full_name, created_at)
  SELECT
    u.id,
    lower(u.email),
    'admin',
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    NOW()
  FROM auth.users u
  WHERE lower(u.email) IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com')
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin';

  -- 7. Delete all non-admin auth records
  DELETE FROM auth.mfa_factors
  WHERE user_id NOT IN (
    SELECT id FROM auth.users
    WHERE lower(email) IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com')
  );
  DELETE FROM auth.identities
  WHERE user_id NOT IN (
    SELECT id FROM auth.users
    WHERE lower(email) IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com')
  );
  DELETE FROM auth.sessions
  WHERE user_id NOT IN (
    SELECT id FROM auth.users
    WHERE lower(email) IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com')
  );
  DELETE FROM auth.users
  WHERE lower(email) NOT IN ('admin@humantek.art', 'huzaifa14321furqan@gmail.com');

END $$;
