
-- Server-side merge: bypasses DELETE RLS (only super_admin had it) so any
-- active staff can resolve duplicates. Moves all linked rows then removes
-- the loser inside a single transaction (function body is atomic).
CREATE OR REPLACE FUNCTION public.merge_members_by_id(_winner uuid, _loser uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loser_stripe_customer text;
  loser_stripe_sub text;
  winner_stripe_customer text;
  winner_stripe_sub text;
BEGIN
  IF NOT public.is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only active staff can merge members';
  END IF;
  IF _winner IS NULL OR _loser IS NULL OR _winner = _loser THEN
    RAISE EXCEPTION 'Invalid winner/loser';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = _winner) THEN
    RAISE EXCEPTION 'Kept member not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = _loser) THEN
    RAISE EXCEPTION 'Duplicate member not found';
  END IF;

  -- Carry forward Stripe ids if winner is missing them.
  SELECT stripe_customer_id, stripe_subscription_id INTO loser_stripe_customer, loser_stripe_sub
    FROM public.members WHERE id = _loser;
  SELECT stripe_customer_id, stripe_subscription_id INTO winner_stripe_customer, winner_stripe_sub
    FROM public.members WHERE id = _winner;

  UPDATE public.members
     SET stripe_customer_id     = COALESCE(winner_stripe_customer, loser_stripe_customer),
         stripe_subscription_id = COALESCE(winner_stripe_sub,      loser_stripe_sub)
   WHERE id = _winner;

  -- Move all linked records.
  UPDATE public.payments             SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.subscriptions        SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.member_activities    SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.social_engagements   SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.member_visits        SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.discipleship_notes   SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.bible_notes          SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.bible_readings       SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.devotional_completions SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.devotional_notes     SET member_id = _winner WHERE member_id = _loser;

  DELETE FROM public.members WHERE id = _loser;

  RETURN _winner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_members_by_id(uuid, uuid) TO authenticated;

-- Track admin-dismissed duplicate groups (e.g. "shared phone, keep separate").
CREATE TABLE IF NOT EXISTS public.dismissed_duplicate_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_key text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'intentionally_shared',
  dismissed_by uuid,
  dismissed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dismissed_duplicate_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff view dismissed duplicates"
  ON public.dismissed_duplicate_groups FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff insert dismissed duplicates"
  ON public.dismissed_duplicate_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff delete dismissed duplicates"
  ON public.dismissed_duplicate_groups FOR DELETE TO authenticated
  USING (public.is_active_staff(auth.uid()));
