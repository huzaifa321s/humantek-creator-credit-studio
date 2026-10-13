-- ============================================================
-- MIGRATION 20261013000004: WIPE ALL USERS EXCEPT MASTER ADMIN
-- Preserves ONLY:
--   admin@humantek.art
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- 1. Find master admin ID
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(email) = 'admin@humantek.art' LIMIT 1;

  -- 2. Disable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger DISABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 3. Clean project chat, attachments, and read states
  TRUNCATE TABLE public.project_message_attachments CASCADE;
  TRUNCATE TABLE public.project_messages CASCADE;
  TRUNCATE TABLE public.project_read_states CASCADE;
  TRUNCATE TABLE public.project_status_history CASCADE;
  TRUNCATE TABLE public.project_items CASCADE;
  TRUNCATE TABLE public.project_additions CASCADE;
  TRUNCATE TABLE public.admin_alerts CASCADE;
  TRUNCATE TABLE public.webhook_events CASCADE;
  TRUNCATE TABLE public.orders CASCADE;
  TRUNCATE TABLE public.projects CASCADE;
  TRUNCATE TABLE public.promo_redemptions CASCADE;
  UPDATE public.promo_codes SET used_count = 0;
  TRUNCATE TABLE public.credit_ledger RESTART IDENTITY CASCADE;

  -- 4. Re-enable immutability trigger on credit_ledger
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_block_ledger_mutation'
  ) THEN
    ALTER TABLE public.credit_ledger ENABLE TRIGGER trg_block_ledger_mutation;
  END IF;

  -- 5. Delete all wallets except master admin
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM public.wallets WHERE user_id <> v_admin_id;
    INSERT INTO public.wallets (user_id, balance_purchased, balance_promo, updated_at)
    VALUES (v_admin_id, 10000, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      balance_purchased = 10000,
      balance_promo = 0,
      updated_at = NOW();
  ELSE
    TRUNCATE TABLE public.wallets CASCADE;
  END IF;

  -- 6. Delete all profiles except master admin
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id <> v_admin_id;
    INSERT INTO public.profiles (id, email, role, full_name, created_at)
    VALUES (v_admin_id, 'admin@humantek.art', 'admin', 'Humantek Admin', NOW())
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      full_name = 'Humantek Admin',
      avatar_url = null;
  ELSE
    TRUNCATE TABLE public.profiles CASCADE;
  END IF;

  -- 7. Clean auth schema tables for all users except master admin
  IF v_admin_id IS NOT NULL THEN
    DELETE FROM auth.mfa_factors WHERE user_id <> v_admin_id;
    DELETE FROM auth.identities WHERE user_id <> v_admin_id;
    DELETE FROM auth.sessions WHERE user_id <> v_admin_id;
    DELETE FROM auth.users WHERE id <> v_admin_id;
  END IF;

END $$;
