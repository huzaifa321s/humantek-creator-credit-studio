-- ============================================================
-- MIGRATION: 20261014000001_update_package_credits.sql
-- Update Package 2 (Studio Momentum) to 1200 CR and Package 3 (Signature Collective) to 2000 CR
-- ============================================================

update public.packages
set credits = 1200
where id = 'studio-momentum';

update public.packages
set credits = 2000
where id = 'signature-collective';
