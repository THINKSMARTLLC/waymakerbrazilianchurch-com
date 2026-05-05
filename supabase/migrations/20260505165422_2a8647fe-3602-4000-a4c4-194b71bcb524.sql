CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL,
  event_type text,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_processed_events_event_id_key
  ON public.stripe_processed_events (stripe_event_id);

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe processed events"
  ON public.stripe_processed_events
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Super admins can view stripe processed events"
  ON public.stripe_processed_events
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));
