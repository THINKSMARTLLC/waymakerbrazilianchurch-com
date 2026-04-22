ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS status_payment text,
ADD COLUMN IF NOT EXISTS last_payment_date date,
ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

UPDATE public.members
SET status_payment = COALESCE(status_payment, 'Pending')
WHERE status_payment IS NULL;