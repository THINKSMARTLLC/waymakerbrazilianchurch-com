-- Update phone validation: US default (no +1 needed), international support, E.164 storage.
CREATE OR REPLACE FUNCTION public.validate_member_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  raw text;
  digits text;
BEGIN
  IF NEW.email IS NOT NULL AND trim(NEW.email) <> '' THEN
    NEW.email := lower(trim(NEW.email));
    IF NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Please enter a valid email address.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    raw := trim(NEW.phone);
    digits := regexp_replace(raw, '\D', '', 'g');

    IF position('+' in raw) = 0 THEN
      -- No country code present → assume US.
      IF length(digits) = 10 THEN
        NEW.phone := '+1' || digits;
      ELSIF length(digits) = 11 AND substring(digits, 1, 1) = '1' THEN
        NEW.phone := '+' || digits;
      ELSE
        RAISE EXCEPTION 'Please enter a valid phone number.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      -- International: validate per E.164 (8-15 digits) and store as +<digits>.
      IF length(digits) < 8 OR length(digits) > 15 THEN
        RAISE EXCEPTION 'Please enter a valid phone number.'
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.phone := '+' || digits;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;