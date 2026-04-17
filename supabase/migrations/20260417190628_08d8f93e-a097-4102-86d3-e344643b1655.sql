-- Add contribution frequency to members
CREATE TYPE public.contribution_frequency AS ENUM ('weekly', 'monthly', 'one_time', 'flexible');

ALTER TABLE public.members
  ADD COLUMN contribution_frequency public.contribution_frequency NOT NULL DEFAULT 'weekly';

-- Add base/extra amount split to payments
ALTER TABLE public.payments
  ADD COLUMN base_amount numeric,
  ADD COLUMN extra_amount numeric NOT NULL DEFAULT 0;

-- Backfill base_amount from existing amount
UPDATE public.payments SET base_amount = amount WHERE base_amount IS NULL;

-- Add paypal and other to payment_method enum
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'paypal';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'other';