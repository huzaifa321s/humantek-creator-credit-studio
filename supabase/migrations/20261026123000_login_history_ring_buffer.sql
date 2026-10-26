-- 1. Add lightweight last-login tracking columns directly onto public.profiles (0 extra rows)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_ip text,
  ADD COLUMN IF NOT EXISTS last_login_device text;

-- 2. Create rolling public.login_history table (capped at 500 rows max -> ~90 KB forever)
CREATE TABLE IF NOT EXISTS public.login_history (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client',
  auth_method text NOT NULL,
  ip_address text,
  location text,
  device text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON public.login_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON public.login_history (email);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'login_history' AND policyname = 'Admins can view login_history'
  ) THEN
    CREATE POLICY "Admins can view login_history"
      ON public.login_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

-- 3. Automatic ring-buffer trigger: keeps at most the newest 500 login records
CREATE OR REPLACE FUNCTION public.cap_login_history_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_history
  WHERE id IN (
    SELECT id
    FROM public.login_history
    ORDER BY created_at DESC, id DESC
    OFFSET 500
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cap_login_history_500'
  ) THEN
    CREATE TRIGGER trg_cap_login_history_500
      AFTER INSERT ON public.login_history
      FOR EACH STATEMENT
      EXECUTE FUNCTION public.cap_login_history_rows();
  END IF;
END $$;
