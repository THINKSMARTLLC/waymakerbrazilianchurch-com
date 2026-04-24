CREATE TABLE public.devotional_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  devotional_id UUID NOT NULL REFERENCES public.devotionals(id) ON DELETE CASCADE,
  learned_text TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  god_spoke_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, devotional_id)
);

CREATE INDEX idx_devotional_notes_member ON public.devotional_notes(member_id);
CREATE INDEX idx_devotional_notes_devotional ON public.devotional_notes(devotional_id);

ALTER TABLE public.devotional_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own devotional notes"
ON public.devotional_notes
FOR ALL
TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Active staff view all devotional notes"
ON public.devotional_notes
FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()));

CREATE TRIGGER update_devotional_notes_updated_at
BEFORE UPDATE ON public.devotional_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();