
-- 1. Status enum for activities
DO $$ BEGIN
  CREATE TYPE public.activity_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add columns to member_activities
ALTER TABLE public.member_activities
  ADD COLUMN IF NOT EXISTS status public.activity_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 3. Backfill existing rows
UPDATE public.member_activities SET status = 'approved' WHERE status IS NULL;

-- 4. Replace member self check-in policy to also allow registering other activities (pending status)
DROP POLICY IF EXISTS "Members can self check-in" ON public.member_activities;

CREATE POLICY "Members can self register activities"
ON public.member_activities
FOR INSERT
TO authenticated
WITH CHECK (
  source = 'self_checkin'::activity_source
  AND member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 5. Validation trigger:
--    - Self-registered "attendance" without coordinates must have a photo (fraud control).
--    - One submission per activity type per day per member when self-registered AND pending.
CREATE OR REPLACE FUNCTION public.validate_member_self_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'self_checkin' AND NEW.status = 'pending' THEN
    -- Church Presence requires photo OR check-in location coordinates
    IF NEW.activity_type = 'attendance'
       AND (NEW.photo_url IS NULL OR length(trim(NEW.photo_url)) = 0)
       AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
      RAISE EXCEPTION 'A photo or check-in location is required for church attendance';
    END IF;

    -- Prevent duplicate same-type submission on the same day
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_member_self_activity ON public.member_activities;
CREATE TRIGGER trg_validate_member_self_activity
BEFORE INSERT ON public.member_activities
FOR EACH ROW EXECUTE FUNCTION public.validate_member_self_activity();
