-- Account status enum
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  church_name TEXT,
  status public.account_status NOT NULL DEFAULT 'pending',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  page_accessed TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Helper: super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Helper: active staff (any staff role + active status)
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('super_admin', 'admin', 'church_admin', 'finance_manager')
      AND up.status = 'active'
  )
$$;

-- RLS: user_profiles
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can update all profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete profiles"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: activity_logs
CREATE POLICY "Users can view their own logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert their own logs"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Update user_roles policies: allow super admins to manage all
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Replace members/payments/subscriptions policies to require ACTIVE staff
DROP POLICY IF EXISTS "Staff can view members" ON public.members;
DROP POLICY IF EXISTS "Staff can create members" ON public.members;
DROP POLICY IF EXISTS "Staff can update members" ON public.members;
DROP POLICY IF EXISTS "Staff can delete members" ON public.members;

CREATE POLICY "Active staff can view members" ON public.members FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can create members" ON public.members FOR INSERT TO authenticated WITH CHECK (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can update members" ON public.members FOR UPDATE TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can delete members" ON public.members FOR DELETE TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can create payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can update payments" ON public.payments;

CREATE POLICY "Active staff can view payments" ON public.payments FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Staff can create subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Staff can update subscriptions" ON public.subscriptions;

CREATE POLICY "Active staff can view subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can create subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (public.is_active_staff(auth.uid()));
CREATE POLICY "Active staff can update subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (public.is_active_staff(auth.uid()));

-- Trigger: create profile + auto-promote super admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_super BOOLEAN := NEW.email = 'supportethinksmart@gmail.com';
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'member');
  initial_status public.account_status;
  initial_role public.app_role;
BEGIN
  -- Status: super admin or member -> active; staff roles -> pending
  IF is_super OR requested_role = 'member' THEN
    initial_status := 'active';
  ELSE
    initial_status := 'pending';
  END IF;

  INSERT INTO public.user_profiles (user_id, full_name, email, phone, church_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'church_name',
    initial_status
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign role
  IF is_super THEN
    initial_role := 'super_admin';
  ELSIF requested_role IN ('admin', 'church_admin', 'finance_manager', 'member') THEN
    initial_role := requested_role::public.app_role;
  ELSE
    initial_role := 'member';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();