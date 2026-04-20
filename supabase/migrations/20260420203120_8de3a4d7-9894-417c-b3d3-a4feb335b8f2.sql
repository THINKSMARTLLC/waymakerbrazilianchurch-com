-- ============================================================
-- ENGAGEMENT & JOURNEY SYSTEM
-- ============================================================

-- Enums
CREATE TYPE public.activity_type AS ENUM (
  'attendance',
  'cell_group',
  'visit_scheduled',
  'leadership_contact'
);

CREATE TYPE public.activity_source AS ENUM ('self_checkin', 'admin_manual');

CREATE TYPE public.visit_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- ============================================================
-- member_activities
-- ============================================================
CREATE TABLE public.member_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  activity_type public.activity_type NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source public.activity_source NOT NULL DEFAULT 'admin_manual',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  photo_url TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_activities_member ON public.member_activities(member_id, activity_date DESC);
CREATE INDEX idx_member_activities_date ON public.member_activities(activity_date DESC);
CREATE INDEX idx_member_activities_type ON public.member_activities(activity_type);

-- Anti-spam: 1 self check-in (attendance) per member per day
CREATE UNIQUE INDEX idx_member_activities_unique_self_attendance
  ON public.member_activities(member_id, activity_date)
  WHERE activity_type = 'attendance' AND source = 'self_checkin';

ALTER TABLE public.member_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff can view all activities"
  ON public.member_activities FOR SELECT
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can insert activities"
  ON public.member_activities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can update activities"
  ON public.member_activities FOR UPDATE
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can delete activities"
  ON public.member_activities FOR DELETE
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Members can view own activities"
  ON public.member_activities FOR SELECT
  TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can self check-in"
  ON public.member_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'self_checkin'
    AND member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- ============================================================
-- church_settings (singleton)
-- ============================================================
CREATE TABLE public.church_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  church_name TEXT,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  checkin_radius_meters INTEGER NOT NULL DEFAULT 100,
  inactivity_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT church_settings_singleton CHECK (singleton = true)
);

INSERT INTO public.church_settings (singleton) VALUES (true);

ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read church settings"
  ON public.church_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can update church settings"
  ON public.church_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER church_settings_updated_at
  BEFORE UPDATE ON public.church_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- member_visits
-- ============================================================
CREATE TABLE public.member_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  status public.visit_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_visits_member ON public.member_visits(member_id);
CREATE INDEX idx_member_visits_status ON public.member_visits(status, scheduled_date);

ALTER TABLE public.member_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff can manage visits"
  ON public.member_visits FOR ALL
  TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Members can view own visits"
  ON public.member_visits FOR SELECT
  TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE TRIGGER member_visits_updated_at
  BEFORE UPDATE ON public.member_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket for check-in photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view checkin photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checkin-photos');

CREATE POLICY "Authenticated members can upload own checkin photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'checkin-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Members can delete own checkin photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'checkin-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Active staff can manage all checkin photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'checkin-photos' AND public.is_active_staff(auth.uid()))
  WITH CHECK (bucket_id = 'checkin-photos' AND public.is_active_staff(auth.uid()));