-- ============================================================
-- HUMANTEK CREATOR CREDIT STUDIO - SUPABASE POSTGRESQL SCHEMA
-- ============================================================

-- 1. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'manager', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Wallets Table (Tracks available account credits)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance_credits INT NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Credit Ledger / Transactions (Audited credit movement)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('package_purchase', 'service_deduction', 'manual_topup', 'redeem_code', 'refund')),
  credits_delta INT NOT NULL,
  usd_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_price DECIMAL(10, 2) NOT NULL,
  package_credits INT NOT NULL,
  used_credits INT NOT NULL,
  remaining_credits INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review',
    'payment_confirmed',
    'in_production',
    'review_round',
    'delivered',
    'declined'
  )),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  paypal_order_id TEXT,
  client_name TEXT NOT NULL,
  channel_name TEXT,
  email TEXT NOT NULL,
  platform TEXT,
  style TEXT,
  colors TEXT,
  instructions TEXT NOT NULL,
  redeem_code TEXT,
  additions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Project Items (Selected services within project)
CREATE TABLE IF NOT EXISTS public.project_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier_level INT NOT NULL CHECK (tier_level IN (0, 1, 2)),
  quantity INT NOT NULL DEFAULT 1,
  credits_per_unit INT NOT NULL,
  total_credits INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Project Uploads (Visual reference files)
CREATE TABLE IF NOT EXISTS public.project_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Redeem Codes (Vouchers & Promotional Balances)
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  credits INT NOT NULL,
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Project Messages Table (Project-isolated communications & history)
CREATE TABLE IF NOT EXISTS public.project_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('client', 'agent', 'system')),
  sender_name TEXT NOT NULL,
  sender_role TEXT,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  order_card JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON public.project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON public.project_messages(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view & update their own profile; Admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Wallets: Users can view own wallet
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Projects: Users can view own projects; anonymous creation allowed for order guest flow
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id OR email = auth.jwt() ->> 'email');

CREATE POLICY "Anyone can create projects" ON public.projects
  FOR INSERT WITH CHECK (true);

-- Project Items: Anyone can insert, viewers must own project
CREATE POLICY "Anyone can insert project items" ON public.project_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own project items" ON public.project_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_items.project_id AND (projects.user_id = auth.uid() OR projects.email = auth.jwt() ->> 'email'))
  );

-- Project Messages: Viewers and senders must belong to the project or be managers/admins
CREATE POLICY "Users can view own project messages" ON public.project_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_messages.project_id
        AND (projects.user_id = auth.uid() OR projects.email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Users can send messages to own project" ON public.project_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_messages.project_id
        AND (projects.user_id = auth.uid() OR projects.email = auth.jwt() ->> 'email')
    )
  );


-- Function to handle new user registration automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'client'
  );

  INSERT INTO public.wallets (user_id, balance_credits)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
