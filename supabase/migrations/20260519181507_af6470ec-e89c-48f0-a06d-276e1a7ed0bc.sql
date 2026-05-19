-- Remove duplicate payment (same member/date/amount/method, identical created_at)
DELETE FROM public.payments
WHERE id = 'dd2a6143-ce78-4b3f-bcb4-308c89b168c6';

-- Protect against future duplicates from Stripe webhooks / resyncs
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_payment_intent_unique
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_charge_unique
  ON public.payments (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;
