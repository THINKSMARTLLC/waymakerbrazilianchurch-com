-- Normalize all existing member emails to lowercase, trimmed
UPDATE public.members
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

-- Trim names too
UPDATE public.members
SET name = trim(name)
WHERE name <> trim(name);

-- Enforce uniqueness on email (case-insensitive via normalized storage).
-- Partial index so multiple NULL/empty emails are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique_idx
  ON public.members ((lower(trim(email))))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- Trigger: normalize email + name on insert/update, and block duplicates with a clear error
CREATE OR REPLACE FUNCTION public.normalize_member_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    END IF;
  END IF;
  IF NEW.name IS NOT NULL THEN
    NEW.name := trim(NEW.name);
  END IF;

  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE lower(trim(email)) = NEW.email
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Duplicate prevented for email: %', NEW.email
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_normalize_identity ON public.members;
CREATE TRIGGER members_normalize_identity
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_member_identity();

-- Merge helper: keep the oldest record for an email, reassign all related rows, delete duplicates.
-- Safe to call repeatedly. Restricted to active staff via SECURITY DEFINER + role check.
CREATE OR REPLACE FUNCTION public.merge_members_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_email text := lower(trim(_email));
  keeper_id uuid;
  dup_ids uuid[];
BEGIN
  IF NOT public.is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can merge members';
  END IF;

  IF norm_email IS NULL OR norm_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id INTO keeper_id
  FROM public.members
  WHERE lower(trim(email)) = norm_email
  ORDER BY created_at ASC
  LIMIT 1;

  IF keeper_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(id) INTO dup_ids
  FROM public.members
  WHERE lower(trim(email)) = norm_email
    AND id <> keeper_id;

  IF dup_ids IS NULL OR array_length(dup_ids, 1) IS NULL THEN
    RETURN keeper_id;
  END IF;

  UPDATE public.member_activities    SET member_id = keeper_id WHERE member_id = ANY(dup_ids);
  UPDATE public.payments             SET member_id = keeper_id WHERE member_id = ANY(dup_ids);
  UPDATE public.social_engagements   SET member_id = keeper_id WHERE member_id = ANY(dup_ids);
  UPDATE public.member_visits        SET member_id = keeper_id WHERE member_id = ANY(dup_ids);
  UPDATE public.discipleship_notes   SET member_id = keeper_id WHERE member_id = ANY(dup_ids);
  UPDATE public.subscriptions        SET member_id = keeper_id WHERE member_id = ANY(dup_ids);

  DELETE FROM public.members WHERE id = ANY(dup_ids);

  RETURN keeper_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_members_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_members_by_email(text) TO authenticated;