-- Add new enum for payment frequency
DO $$ BEGIN
  CREATE TYPE public.payment_frequency AS ENUM ('weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_frequency public.payment_frequency NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS reference_month date NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference_month
  ON public.payments (member_id, reference_month)
  WHERE reference_month IS NOT NULL;

-- Child table for multiple contributions per payment
CREATE TABLE IF NOT EXISTS public.payment_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  contribution_type public.contribution_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  destination text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_contributions_payment_id
  ON public.payment_contributions (payment_id);

ALTER TABLE public.payment_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff can view contributions"
  ON public.payment_contributions FOR SELECT
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can create contributions"
  ON public.payment_contributions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can update contributions"
  ON public.payment_contributions FOR UPDATE
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff can delete contributions"
  ON public.payment_contributions FOR DELETE
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Members can view own contributions"
  ON public.payment_contributions FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.members m ON m.id = p.member_id
      WHERE m.user_id = auth.uid()
    )
  );