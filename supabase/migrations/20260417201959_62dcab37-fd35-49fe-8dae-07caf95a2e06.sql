-- Add additional profile fields for signup
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS member_role text,
  ADD COLUMN IF NOT EXISTS department text;

-- Update signup trigger to capture new fields from raw_user_meta_data
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
  address_val TEXT := NEW.raw_user_meta_data->>'address';
  emergency_val TEXT := NEW.raw_user_meta_data->>'emergency_contact';
  dob_val date := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  member_role_val TEXT := NEW.raw_user_meta_data->>'member_role';
  department_val TEXT := NEW.raw_user_meta_data->>'department';
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

  IF initial_role = 'member' AND NEW.email IS NOT NULL THEN
    SELECT id INTO existing_member_id
    FROM public.members
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF existing_member_id IS NOT NULL THEN
      UPDATE public.members
      SET user_id = NEW.id,
          address = COALESCE(address, address_val),
          emergency_contact = COALESCE(emergency_contact, emergency_val),
          date_of_birth = COALESCE(date_of_birth, dob_val),
          member_role = COALESCE(member_role, member_role_val),
          department = COALESCE(department, department_val)
      WHERE id = existing_member_id AND user_id IS NULL;
      new_member_id := existing_member_id;
    ELSE
      INSERT INTO public.members (
        name, email, phone, status, payment_type, weekly_contribution_usd, user_id,
        address, emergency_contact, date_of_birth, member_role, department
      )
      VALUES (
        full_name_val, NEW.email, phone_val, 'active', 'cash', 0, NEW.id,
        address_val, emergency_val, dob_val, member_role_val, department_val
      )
      RETURNING id INTO new_member_id;
    END IF;

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