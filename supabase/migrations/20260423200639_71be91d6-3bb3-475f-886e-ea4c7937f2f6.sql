
-- Enums
CREATE TYPE public.social_platform AS ENUM ('website','instagram','facebook','youtube','google_review');
CREATE TYPE public.social_action_type AS ENUM ('visit','follow','like','comment','subscribe','watch','review');
CREATE TYPE public.engagement_status AS ENUM ('pending','approved','rejected');

-- Table
CREATE TABLE public.social_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  action_type public.social_action_type NOT NULL,
  proof_url text,
  proof_link text,
  points integer NOT NULL DEFAULT 0,
  status public.engagement_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proof_required CHECK (proof_url IS NOT NULL OR proof_link IS NOT NULL)
);

CREATE INDEX idx_social_engagements_member ON public.social_engagements(member_id);
CREATE INDEX idx_social_engagements_status ON public.social_engagements(status);
CREATE INDEX idx_social_engagements_created ON public.social_engagements(created_at DESC);

ALTER TABLE public.social_engagements ENABLE ROW LEVEL SECURITY;

-- Members can view their own engagements
CREATE POLICY "Members view own engagements"
ON public.social_engagements FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- Members can create engagements for themselves
CREATE POLICY "Members create own engagements"
ON public.social_engagements FOR INSERT TO authenticated
WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- Active staff can view all
CREATE POLICY "Staff view all engagements"
ON public.social_engagements FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

-- Active staff can update (approve/reject)
CREATE POLICY "Staff update engagements"
ON public.social_engagements FOR UPDATE TO authenticated
USING (public.is_active_staff(auth.uid()))
WITH CHECK (public.is_active_staff(auth.uid()));

-- Active staff can delete
CREATE POLICY "Staff delete engagements"
ON public.social_engagements FOR DELETE TO authenticated
USING (public.is_active_staff(auth.uid()));

-- updated_at trigger
CREATE TRIGGER set_social_engagements_updated_at
BEFORE UPDATE ON public.social_engagements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for proof screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('engagement-proofs', 'engagement-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public read engagement proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'engagement-proofs');

-- Authenticated users can upload to their own folder (auth.uid()/...)
CREATE POLICY "Users upload own engagement proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'engagement-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own engagement proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'engagement-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own engagement proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'engagement-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
