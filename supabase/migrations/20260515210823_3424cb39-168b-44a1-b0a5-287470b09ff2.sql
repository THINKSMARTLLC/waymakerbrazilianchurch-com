-- 1. Family role enum
CREATE TYPE public.family_role AS ENUM ('individual', 'family_owner', 'family_member', 'sponsored');

-- 2. families table (no policies yet — added after members.family_id exists)
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add columns to members FIRST, so RLS policies can reference them
ALTER TABLE public.members
  ADD COLUMN family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN family_role public.family_role NOT NULL DEFAULT 'individual';

CREATE INDEX idx_members_family_id ON public.members(family_id) WHERE family_id IS NOT NULL;

-- 4. Now create the policies on families
CREATE POLICY "Active staff manage families"
  ON public.families
  FOR ALL
  TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Members view own family"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT family_id FROM public.members WHERE user_id = auth.uid() AND family_id IS NOT NULL));