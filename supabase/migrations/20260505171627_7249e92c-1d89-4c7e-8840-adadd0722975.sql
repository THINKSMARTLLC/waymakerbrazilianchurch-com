-- Enforce data validation at the database level.

-- 1) Members.email: case-insensitive unique (only when present).
--    The normalize_member_identity() trigger already lowercases/trims email
--    and rejects duplicates, but we add a real unique index so the database
--    is the final source of truth.
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique_idx
  ON public.members ((lower(trim(email))))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- 2) Members.email format + phone digit-count validation (trigger-based).
CREATE OR REPLACE FUNCTION public.validate_member_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.email IS NOT NULL AND trim(NEW.email) <> '' THEN
    IF NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format: %', NEW.email
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    digits := regexp_replace(NEW.phone, '\D', '', 'g');
    IF length(digits) <> 10 THEN
      RAISE EXCEPTION 'Invalid US phone (must have 10 digits): %', NEW.phone
        USING ERRCODE = 'check_violation';
    END IF;
    -- Auto-format US: (XXX) XXX-XXXX
    NEW.phone := '(' || substring(digits, 1, 3) || ') '
                || substring(digits, 4, 3) || '-'
                || substring(digits, 7, 4);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_member_input_trg ON public.members;
CREATE TRIGGER validate_member_input_trg
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.validate_member_input();

-- 3) Stripe events: enforce unique stripe_event_id.
CREATE UNIQUE INDEX IF NOT EXISTS stripe_processed_events_event_id_unique
  ON public.stripe_processed_events (stripe_event_id);
