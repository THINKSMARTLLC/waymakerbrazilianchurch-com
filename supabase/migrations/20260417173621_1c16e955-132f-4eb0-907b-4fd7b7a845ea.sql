-- 1. Add user_id link on members (nullable, unique when present)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_key
  ON public.members (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS members_email_lower_idx
  ON public.members (lower(email));

-- 2. Extend handle_new_user to also create / link a member row + log activity
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
  full_name_val TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  phone_val TEXT := NEW.raw_user_meta_data->>'phone';
  existing_member_id uuid;
  new_member_id uuid;
BEGIN
  IF is_super OR requested_role = 'member' THEN
    initial_status := 'active';
  ELSE
    initial_status := 'pending';
  END IF;

  INSERT INTO public.user_profiles (user_id, full_name, email, phone, church_name, status)
  VALUES (
    NEW.id,
    full_name_val,
    NEW.email,
    phone_val,
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

  -- Auto-create or link member record (skip super admins / staff — only for actual members)
  IF initial_role = 'member' AND NEW.email IS NOT NULL THEN
    SELECT id INTO existing_member_id
    FROM public.members
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF existing_member_id IS NOT NULL THEN
      -- Link existing member to this user if not yet linked
      UPDATE public.members
      SET user_id = NEW.id
      WHERE id = existing_member_id AND user_id IS NULL;
      new_member_id := existing_member_id;
    ELSE
      INSERT INTO public.members (name, email, phone, status, payment_type, weekly_contribution_usd, user_id)
      VALUES (full_name_val, NEW.email, phone_val, 'active', 'cash', 0, NEW.id)
      RETURNING id INTO new_member_id;
    END IF;

    -- Log signup for admin banner
    INSERT INTO public.activity_logs (user_id, user_email, action, metadata)
    VALUES (
      NEW.id,
      NEW.email,
      'new_member_registered',
      jsonb_build_object(
        'member_id', new_member_id,
        'full_name', full_name_val,
        'phone', phone_val
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Make sure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();