-- Discipleship stage enum
CREATE TYPE public.discipleship_stage AS ENUM (
  'visitor',
  'new_believer',
  'in_discipleship',
  'committed',
  'serving',
  'leader'
);

-- Add discipleship fields to members
ALTER TABLE public.members
  ADD COLUMN discipleship_stage public.discipleship_stage NOT NULL DEFAULT 'visitor',
  ADD COLUMN stage_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN accepted_jesus boolean NOT NULL DEFAULT false,
  ADD COLUMN baptized boolean NOT NULL DEFAULT false,
  ADD COLUMN completed_course boolean NOT NULL DEFAULT false,
  ADD COLUMN attending_regularly boolean NOT NULL DEFAULT false,
  ADD COLUMN in_small_group boolean NOT NULL DEFAULT false,
  ADD COLUMN serving_ministry boolean NOT NULL DEFAULT false,
  ADD COLUMN assigned_leader_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- Auto-update stage_updated_at when stage changes
CREATE OR REPLACE FUNCTION public.touch_stage_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.discipleship_stage IS DISTINCT FROM OLD.discipleship_stage THEN
    NEW.stage_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_members_touch_stage
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.touch_stage_updated_at();

-- Discipleship notes (admin/leader only)
CREATE TABLE public.discipleship_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  visibility text NOT NULL DEFAULT 'admin_only',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discipleship_notes_member ON public.discipleship_notes(member_id, created_at DESC);

ALTER TABLE public.discipleship_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff view notes"
ON public.discipleship_notes FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff insert notes"
ON public.discipleship_notes FOR INSERT TO authenticated
WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff update notes"
ON public.discipleship_notes FOR UPDATE TO authenticated
USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff delete notes"
ON public.discipleship_notes FOR DELETE TO authenticated
USING (public.is_active_staff(auth.uid()));