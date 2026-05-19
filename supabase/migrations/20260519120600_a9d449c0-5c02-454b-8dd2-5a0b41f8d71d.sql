
-- Enum for ledger status
DO $$ BEGIN
  CREATE TYPE public.ledger_status AS ENUM ('paid','partial','pending','overdue','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main ledger table
CREATE TABLE IF NOT EXISTS public.member_financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  week_reference date NOT NULL,
  amount_due numeric NOT NULL DEFAULT 20,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance numeric GENERATED ALWAYS AS (amount_paid - amount_due) STORED,
  payment_status public.ledger_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, week_reference)
);

CREATE INDEX IF NOT EXISTS idx_mfl_member ON public.member_financial_ledger(member_id);
CREATE INDEX IF NOT EXISTS idx_mfl_week ON public.member_financial_ledger(week_reference);
CREATE INDEX IF NOT EXISTS idx_mfl_status ON public.member_financial_ledger(payment_status);

ALTER TABLE public.member_financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage ledger" ON public.member_financial_ledger
  FOR ALL TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Members view own ledger" ON public.member_financial_ledger
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE TRIGGER trg_mfl_updated_at
  BEFORE UPDATE ON public.member_financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotency table: which payments have been applied to which ledger rows
CREATE TABLE IF NOT EXISTS public.ledger_payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  ledger_id uuid NOT NULL REFERENCES public.member_financial_ledger(id) ON DELETE CASCADE,
  amount_applied numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, ledger_id)
);

CREATE INDEX IF NOT EXISTS idx_lpa_payment ON public.ledger_payment_applications(payment_id);

ALTER TABLE public.ledger_payment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view ledger applications" ON public.ledger_payment_applications
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff manage ledger applications" ON public.ledger_payment_applications
  FOR ALL TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));

-- Helper: monday of a given date (ISO week start)
CREATE OR REPLACE FUNCTION public.week_monday(_d date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT (date_trunc('week', _d::timestamp)::date)
$$;

-- Backfill ledger for a single member (from created_at week to current week)
CREATE OR REPLACE FUNCTION public.backfill_member_ledger(_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_row public.members%ROWTYPE;
  start_week date;
  end_week date;
  cur date;
  weekly numeric;
  inserted integer := 0;
BEGIN
  SELECT * INTO m_row FROM public.members WHERE id = _member_id;
  IF NOT FOUND OR m_row.archived OR m_row.status <> 'active' THEN
    RETURN 0;
  END IF;

  weekly := COALESCE(NULLIF(m_row.weekly_contribution_usd, 0), 20);
  start_week := public.week_monday(m_row.created_at::date);
  end_week := public.week_monday(CURRENT_DATE);
  cur := start_week;

  WHILE cur <= end_week LOOP
    INSERT INTO public.member_financial_ledger (member_id, week_reference, amount_due, payment_status)
    VALUES (_member_id, cur, weekly, 'pending')
    ON CONFLICT (member_id, week_reference) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
    cur := cur + INTERVAL '7 days';
  END LOOP;

  RETURN inserted;
END $$;

-- Generate current-week entry for all active members
CREATE OR REPLACE FUNCTION public.generate_weekly_ledger_entries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  this_week date := public.week_monday(CURRENT_DATE);
  inserted integer := 0;
  m record;
BEGIN
  FOR m IN
    SELECT id, COALESCE(NULLIF(weekly_contribution_usd, 0), 20) AS weekly
    FROM public.members
    WHERE status = 'active' AND archived = false
  LOOP
    INSERT INTO public.member_financial_ledger (member_id, week_reference, amount_due, payment_status)
    VALUES (m.id, this_week, m.weekly, 'pending')
    ON CONFLICT (member_id, week_reference) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END LOOP;
  RETURN inserted;
END $$;

-- Refresh status based on amount_paid vs amount_due and week_reference
CREATE OR REPLACE FUNCTION public.refresh_ledger_row_status(_ledger_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.member_financial_ledger%ROWTYPE;
  new_status public.ledger_status;
  this_week date := public.week_monday(CURRENT_DATE);
BEGIN
  SELECT * INTO r FROM public.member_financial_ledger WHERE id = _ledger_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF r.amount_paid >= r.amount_due THEN
    new_status := 'paid';
  ELSIF r.amount_paid > 0 AND r.amount_paid < r.amount_due THEN
    IF r.week_reference < this_week THEN new_status := 'overdue';
    ELSE new_status := 'partial'; END IF;
  ELSE
    -- nothing paid
    IF r.payment_status = 'failed' THEN
      new_status := 'failed';
    ELSIF r.week_reference < this_week THEN
      new_status := 'overdue';
    ELSE
      new_status := 'pending';
    END IF;
  END IF;

  UPDATE public.member_financial_ledger
    SET payment_status = new_status, updated_at = now()
    WHERE id = _ledger_id;
END $$;

-- Apply a confirmed payment to the member's outstanding ledger weeks (cronological)
CREATE OR REPLACE FUNCTION public.apply_payment_to_ledger(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  remaining numeric;
  applied numeric;
  l record;
BEGIN
  SELECT id, member_id, amount, status, stripe_subscription_id
    INTO p
    FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF p.status IS DISTINCT FROM 'paid' THEN RETURN; END IF;

  -- Already applied? skip
  IF EXISTS (SELECT 1 FROM public.ledger_payment_applications WHERE payment_id = _payment_id) THEN
    RETURN;
  END IF;

  -- Ensure ledger backfilled up to today
  PERFORM public.backfill_member_ledger(p.member_id);

  remaining := COALESCE(p.amount, 0);
  IF remaining <= 0 THEN RETURN; END IF;

  FOR l IN
    SELECT id, amount_due, amount_paid
      FROM public.member_financial_ledger
     WHERE member_id = p.member_id
       AND amount_paid < amount_due
     ORDER BY week_reference ASC
  LOOP
    EXIT WHEN remaining <= 0;
    applied := LEAST(remaining, l.amount_due - l.amount_paid);
    UPDATE public.member_financial_ledger
       SET amount_paid = amount_paid + applied,
           stripe_payment_intent = COALESCE(stripe_payment_intent, p.stripe_subscription_id),
           updated_at = now()
     WHERE id = l.id;
    INSERT INTO public.ledger_payment_applications (payment_id, ledger_id, amount_applied)
    VALUES (_payment_id, l.id, applied);
    PERFORM public.refresh_ledger_row_status(l.id);
    remaining := remaining - applied;
  END LOOP;
END $$;

-- Reverse application (when a payment is updated away from 'paid' or deleted)
CREATE OR REPLACE FUNCTION public.reverse_payment_from_ledger(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
BEGIN
  FOR a IN
    SELECT ledger_id, amount_applied FROM public.ledger_payment_applications WHERE payment_id = _payment_id
  LOOP
    UPDATE public.member_financial_ledger
       SET amount_paid = GREATEST(amount_paid - a.amount_applied, 0),
           updated_at = now()
     WHERE id = a.ledger_id;
    PERFORM public.refresh_ledger_row_status(a.ledger_id);
  END LOOP;
  DELETE FROM public.ledger_payment_applications WHERE payment_id = _payment_id;
END $$;

-- Trigger on payments
CREATE OR REPLACE FUNCTION public.trg_payments_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'paid' THEN
      PERFORM public.apply_payment_to_ledger(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
      PERFORM public.apply_payment_to_ledger(NEW.id);
    ELSIF OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid' THEN
      PERFORM public.reverse_payment_from_ledger(NEW.id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.reverse_payment_from_ledger(OLD.id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_payments_to_ledger ON public.payments;
CREATE TRIGGER trg_payments_to_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payments_to_ledger();

-- Trigger on members insert: backfill (covers seed data added as active)
CREATE OR REPLACE FUNCTION public.trg_member_backfill_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.archived = false THEN
    PERFORM public.backfill_member_ledger(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_member_backfill_ledger ON public.members;
CREATE TRIGGER trg_member_backfill_ledger
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.trg_member_backfill_ledger();

-- Initial backfill: all active members
DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT id FROM public.members WHERE status = 'active' AND archived = false LOOP
    PERFORM public.backfill_member_ledger(m.id);
  END LOOP;
END $$;

-- Apply all existing paid payments
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.payments WHERE status = 'paid' ORDER BY payment_date ASC, created_at ASC LOOP
    PERFORM public.apply_payment_to_ledger(p.id);
  END LOOP;
END $$;

-- Mark overdue for all past-week rows still pending/partial
UPDATE public.member_financial_ledger
   SET payment_status = 'overdue', updated_at = now()
 WHERE week_reference < public.week_monday(CURRENT_DATE)
   AND amount_paid < amount_due
   AND payment_status IN ('pending','partial');
