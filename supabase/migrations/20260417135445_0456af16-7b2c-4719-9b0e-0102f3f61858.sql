-- Add weekly contribution to members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS weekly_contribution_usd numeric NOT NULL DEFAULT 0;

-- Extend payment_method enum with zelle, venmo, card
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'zelle' AND enumtypid = 'public.payment_method'::regtype) THEN
    ALTER TYPE public.payment_method ADD VALUE 'zelle';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'venmo' AND enumtypid = 'public.payment_method'::regtype) THEN
    ALTER TYPE public.payment_method ADD VALUE 'venmo';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'card' AND enumtypid = 'public.payment_method'::regtype) THEN
    ALTER TYPE public.payment_method ADD VALUE 'card';
  END IF;
END $$;

-- Create contribution_type enum
DO $$ BEGIN
  CREATE TYPE public.contribution_type AS ENUM (
    'tithe', 'offering', 'pastor_salary', 'special_donation', 'event_contribution', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add fields to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS contribution_type public.contribution_type NOT NULL DEFAULT 'tithe',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- Default existing payments status to 'paid' when newly inserted via UI
-- (no data backfill needed)

-- Index for faster "last payment" lookups
CREATE INDEX IF NOT EXISTS idx_payments_member_date ON public.payments (member_id, payment_date DESC);
