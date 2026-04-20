
-- Event types table for structured activity subtypes
CREATE TABLE public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('service', 'group', 'event', 'other')),
  base_activity_type public.activity_type NOT NULL,
  icon text,
  active boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active event types"
  ON public.event_types FOR SELECT TO authenticated
  USING (active = true OR public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can insert event types"
  ON public.event_types FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can update event types"
  ON public.event_types FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can delete event types"
  ON public.event_types FOR DELETE TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE TRIGGER event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link activities to optional event type
ALTER TABLE public.member_activities
  ADD COLUMN event_type_id uuid REFERENCES public.event_types(id) ON DELETE SET NULL;

CREATE INDEX idx_member_activities_event_type_id ON public.member_activities(event_type_id);
CREATE INDEX idx_member_activities_activity_date ON public.member_activities(activity_date DESC);

-- Seed default event types
INSERT INTO public.event_types (name, category, base_activity_type, icon, is_custom) VALUES
  ('Culto de Domingo', 'service', 'attendance', '⛪', false),
  ('Culto de Quarta', 'service', 'attendance', '🙏', false),
  ('Santa Ceia', 'service', 'attendance', '🍞', false),
  ('Célula', 'group', 'cell_group', '🤝', false),
  ('Reunião de Jovens', 'group', 'cell_group', '✨', false),
  ('Estudo Bíblico', 'group', 'cell_group', '📖', false),
  ('Reunião de Mulheres', 'event', 'cell_group', '💐', false),
  ('Café da Manhã', 'event', 'cell_group', '☕', false),
  ('Visita Domiciliar', 'event', 'visit_scheduled', '🏠', false);
