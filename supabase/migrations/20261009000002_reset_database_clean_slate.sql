-- ============================================================
-- MIGRATION 20261009000002: HARD RESET TO CLEAN SLATE (OPTION 1)
-- Preserves only:
--   1. Admin: huzaifafurqan22@gmail.com (0c6802ea-01b2-441a-b9a1-83bd628a4305)
--   2. Client: huzaifa14321furqan@gmail.com (add8f799-5e3b-49d1-bf9a-89738f483db7)
--   3. Catalog & Promo Codes (18 promo codes preserved, usage reset to 0)
-- ============================================================

DO $$
BEGIN
  -- 1. Disable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger DISABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 2. Clean project chat, attachments, and read states
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_message_attachments') THEN
    TRUNCATE TABLE public.project_message_attachments CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_messages') THEN
    TRUNCATE TABLE public.project_messages CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_read_states') THEN
    TRUNCATE TABLE public.project_read_states CASCADE;
  END IF;

  -- 3. Clean project status history and child items
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_status_history') THEN
    TRUNCATE TABLE public.project_status_history CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_items') THEN
    TRUNCATE TABLE public.project_items CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_additions') THEN
    TRUNCATE TABLE public.project_additions CASCADE;
  END IF;

  -- 4. Clean alerts, webhooks, orders, and projects
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

  -- 5. Clean promo redemptions and reset promo code usage
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'promo_redemptions') THEN
    TRUNCATE TABLE public.promo_redemptions CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'promo_codes') THEN
    UPDATE public.promo_codes SET used_count = 0;
  END IF;

  -- 6. Clean credit_ledger
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_ledger') THEN
    TRUNCATE TABLE public.credit_ledger RESTART IDENTITY CASCADE;
  END IF;

  -- 7. Re-enable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger ENABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 8. Clean wallets (preserve only Huzaifa admin & client)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets') THEN
    DELETE FROM public.wallets
    WHERE user_id NOT IN (
      '0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid,
      'add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid
    );

    UPDATE public.wallets
    SET balance_purchased = 0,
        balance_promo = 0,
        updated_at = NOW()
    WHERE user_id IN (
      '0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid,
      'add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid
    );

    INSERT INTO public.wallets (user_id, balance_purchased, balance_promo, updated_at)
    VALUES
      ('0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid, 0, 0, NOW()),
      ('add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid, 0, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance_purchased = 0,
      balance_promo = 0,
      updated_at = NOW();
  END IF;

  -- 9. Clean profiles (preserve only Huzaifa admin & client)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    DELETE FROM public.profiles
    WHERE id NOT IN (
      '0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid,
      'add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid
    );

    INSERT INTO public.profiles (id, email, role, created_at)
    VALUES
      ('0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid, 'huzaifafurqan22@gmail.com', 'admin', NOW()),
      ('add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid, 'huzaifa14321furqan@gmail.com', 'client', NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role;
  END IF;

  -- 10. Clean auth.users (preserve only Huzaifa admin & client)
  DELETE FROM auth.users
  WHERE id NOT IN (
    '0c6802ea-01b2-441a-b9a1-83bd628a4305'::uuid,
    'add8f799-5e3b-49d1-bf9a-89738f483db7'::uuid
  );

END $$;
