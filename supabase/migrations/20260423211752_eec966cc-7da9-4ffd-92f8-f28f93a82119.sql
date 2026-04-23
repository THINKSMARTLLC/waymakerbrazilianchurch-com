-- 1. Add new columns
ALTER TABLE public.member_activities
  ADD COLUMN IF NOT EXISTS validation_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score integer NOT NULL DEFAULT 0;

-- 2. Replace validation function with auto-approval logic
CREATE OR REPLACE FUNCTION public.validate_member_self_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  church_lat numeric;
  church_lng numeric;
  church_radius integer;
  distance_m numeric := NULL;
  has_location boolean := FALSE;
  has_photo boolean := FALSE;
  has_event boolean := FALSE;
  score integer := 0;
BEGIN
  -- Duplicate protection: same activity type per day per member (self check-in only)
  IF NEW.source = 'self_checkin' THEN
    IF EXISTS (
      SELECT 1 FROM public.member_activities
      WHERE member_id = NEW.member_id
        AND activity_type = NEW.activity_type
        AND activity_date = NEW.activity_date
        AND source = 'self_checkin'
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'You already submitted this activity type today';
    END IF;

    -- Attendance must have photo OR location
    IF NEW.activity_type = 'attendance'
       AND (NEW.photo_url IS NULL OR length(trim(NEW.photo_url)) = 0)
       AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
      RAISE EXCEPTION 'A photo or check-in location is required for church attendance';
    END IF;
  END IF;

  -- Compute confidence score & auto-validation
  has_photo := NEW.photo_url IS NOT NULL AND length(trim(NEW.photo_url)) > 0;
  has_event := NEW.event_type_id IS NOT NULL;

  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    SELECT latitude, longitude, checkin_radius_meters
      INTO church_lat, church_lng, church_radius
    FROM public.church_settings
    WHERE singleton = TRUE
    LIMIT 1;

    IF church_lat IS NOT NULL AND church_lng IS NOT NULL THEN
      -- Haversine distance in meters
      distance_m := 2 * 6371000 * asin(
        sqrt(
          power(sin(radians((NEW.latitude - church_lat) / 2)), 2) +
          cos(radians(church_lat)) * cos(radians(NEW.latitude)) *
          power(sin(radians((NEW.longitude - church_lng) / 2)), 2)
        )
      );
      IF distance_m <= COALESCE(church_radius, 100) THEN
        has_location := TRUE;
      END IF;
    END IF;
  END IF;

  IF has_location THEN score := score + 50; END IF;
  IF has_photo    THEN score := score + 30; END IF;
  IF has_event    THEN score := score + 20; END IF;
  NEW.confidence_score := score;

  -- Determine validation type & status (only override on insert from self_checkin)
  IF TG_OP = 'INSERT' AND NEW.source = 'self_checkin' THEN
    IF NEW.activity_type = 'attendance' AND has_location AND distance_m <= 50 THEN
      NEW.status := 'approved';
      NEW.validation_type := 'auto';
      NEW.approved_at := now();
    ELSIF NEW.activity_type = 'attendance' AND has_photo THEN
      NEW.status := 'approved';
      NEW.validation_type := 'semi';
      NEW.approved_at := now();
    ELSIF score >= 80 THEN
      NEW.status := 'approved';
      NEW.validation_type := 'auto';
      NEW.approved_at := now();
    ELSE
      NEW.status := 'pending';
      NEW.validation_type := 'manual';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Ensure trigger exists (drop & recreate to be safe)
DROP TRIGGER IF EXISTS validate_member_self_activity_trigger ON public.member_activities;
CREATE TRIGGER validate_member_self_activity_trigger
  BEFORE INSERT ON public.member_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_member_self_activity();