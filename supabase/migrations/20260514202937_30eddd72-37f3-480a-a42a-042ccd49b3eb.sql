
-- 1. Add payer/beneficiary columns to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payer_member_id uuid,
  ADD COLUMN IF NOT EXISTS beneficiary_member_id uuid;

-- Backfill: payer and beneficiary default to existing member_id
UPDATE public.payments
SET payer_member_id = COALESCE(payer_member_id, member_id),
    beneficiary_member_id = COALESCE(beneficiary_member_id, member_id);

CREATE INDEX IF NOT EXISTS idx_payments_payer_member_id ON public.payments(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_payments_beneficiary_member_id ON public.payments(beneficiary_member_id);

-- Allow members to view payments they paid for OR benefited from
DROP POLICY IF EXISTS "Members can view payments they paid or benefit from" ON public.payments;
CREATE POLICY "Members can view payments they paid or benefit from"
ON public.payments
FOR SELECT
TO authenticated
USING (
  payer_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  OR beneficiary_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 2. Create payment_relationships table
CREATE TABLE IF NOT EXISTS public.payment_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_member_id uuid NOT NULL,
  beneficiary_member_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  contribution_type public.contribution_type,
  relationship_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payer_member_id, beneficiary_member_id, contribution_type)
);

CREATE INDEX IF NOT EXISTS idx_payment_relationships_payer ON public.payment_relationships(payer_member_id);
CREATE INDEX IF NOT EXISTS idx_payment_relationships_beneficiary ON public.payment_relationships(beneficiary_member_id);

ALTER TABLE public.payment_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active staff manage relationships" ON public.payment_relationships;
CREATE POLICY "Active staff manage relationships"
ON public.payment_relationships
FOR ALL
TO authenticated
USING (public.is_active_staff(auth.uid()))
WITH CHECK (public.is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Payers manage own relationships" ON public.payment_relationships;
CREATE POLICY "Payers manage own relationships"
ON public.payment_relationships
FOR ALL
TO authenticated
USING (payer_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
WITH CHECK (payer_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Beneficiaries view relationships" ON public.payment_relationships;
CREATE POLICY "Beneficiaries view relationships"
ON public.payment_relationships
FOR SELECT
TO authenticated
USING (beneficiary_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE TRIGGER trg_payment_relationships_updated_at
BEFORE UPDATE ON public.payment_relationships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
