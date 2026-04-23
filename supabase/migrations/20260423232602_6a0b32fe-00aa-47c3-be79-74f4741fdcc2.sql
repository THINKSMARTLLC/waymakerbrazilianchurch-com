-- Devotionals (one per day, AI-generated)
CREATE TABLE public.devotionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devotional_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  bible_reference TEXT NOT NULL,
  verse_text TEXT,
  reflection TEXT NOT NULL,
  application TEXT NOT NULL,
  prayer TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devotionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read devotionals"
  ON public.devotionals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert devotionals"
  ON public.devotionals FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Active staff can manage devotionals"
  ON public.devotionals FOR ALL TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

-- Devotional completions
CREATE TABLE public.devotional_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  devotional_id UUID NOT NULL REFERENCES public.devotionals(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, devotional_id)
);

ALTER TABLE public.devotional_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own completions"
  ON public.devotional_completions FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members create own completions"
  ON public.devotional_completions FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Active staff view all completions"
  ON public.devotional_completions FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- Bible notes
CREATE TABLE public.bible_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  note_text TEXT NOT NULL DEFAULT '',
  share_with_pastor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, book, chapter, verse)
);

CREATE INDEX idx_bible_notes_member ON public.bible_notes(member_id);
CREATE INDEX idx_bible_notes_location ON public.bible_notes(book, chapter, verse);

ALTER TABLE public.bible_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own notes"
  ON public.bible_notes FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Active staff view shared notes"
  ON public.bible_notes FOR SELECT TO authenticated
  USING (share_with_pastor = true AND public.is_active_staff(auth.uid()));

-- Bible reading log
CREATE TABLE public.bible_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  read_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, book, chapter, read_date)
);

CREATE INDEX idx_bible_readings_member_date ON public.bible_readings(member_id, read_date DESC);

ALTER TABLE public.bible_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own readings"
  ON public.bible_readings FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Active staff view all readings"
  ON public.bible_readings FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- Trigger for bible_notes updated_at
CREATE TRIGGER bible_notes_updated_at
  BEFORE UPDATE ON public.bible_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();