
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_super BOOLEAN := NEW.email IN ('supportethinksmart@gmail.com', 'suportethinksmart@gmail.com');
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'member');
  initial_status public.account_status;
  initial_role public.app_role;
BEGIN
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
$function$;

-- Protect super admins from role changes/deletion
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot remove super_admin role';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Cannot downgrade super_admin role';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_role_trg ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- Protect super admin profile from suspension/deletion
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = COALESCE(OLD.user_id, NEW.user_id) AND role = 'super_admin') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete super_admin profile';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status <> 'active' THEN
      RAISE EXCEPTION 'Cannot change super_admin status';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_profile_trg ON public.user_profiles;
CREATE TRIGGER protect_super_admin_profile_trg
BEFORE UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();
