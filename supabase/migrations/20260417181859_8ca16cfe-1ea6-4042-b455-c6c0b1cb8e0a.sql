DO $$
DECLARE
  u RECORD;
  new_member_id uuid;
  existing_member_id uuid;
BEGIN
  FOR u IN
    SELECT au.id, au.email,
           COALESCE(au.raw_user_meta_data->>'full_name', au.email) AS full_name,
           au.raw_user_meta_data->>'phone' AS phone
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE ur.role = 'member'
      AND au.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = au.id OR lower(m.email) = lower(au.email)
      )
  LOOP
    INSERT INTO public.members (name, email, phone, status, payment_type, weekly_contribution_usd, user_id)
    VALUES (u.full_name, u.email, u.phone, 'active', 'cash', 0, u.id)
    RETURNING id INTO new_member_id;

    INSERT INTO public.activity_logs (user_id, user_email, action, metadata)
    VALUES (
      u.id, u.email, 'new_member_registered',
      jsonb_build_object(
        'member_id', new_member_id,
        'full_name', u.full_name,
        'phone', u.phone,
        'source', 'backfill'
      )
    );
  END LOOP;

  -- Also link any existing members whose email matches an auth user but user_id is null
  UPDATE public.members m
  SET user_id = au.id
  FROM auth.users au
  WHERE m.user_id IS NULL
    AND m.email IS NOT NULL
    AND lower(m.email) = lower(au.email);
END $$;