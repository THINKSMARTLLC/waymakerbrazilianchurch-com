
-- 1. Add archive columns to members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_members_archived ON public.members(archived) WHERE archived = true;

-- 2. Merge history table with full snapshot
CREATE TABLE IF NOT EXISTS public.member_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_member_id uuid NOT NULL,
  merged_into_member_id uuid NOT NULL,
  merge_date timestamptz NOT NULL DEFAULT now(),
  merged_by uuid,
  snapshot_data jsonb NOT NULL,
  restored boolean NOT NULL DEFAULT false,
  restored_at timestamptz,
  restored_by uuid
);

CREATE INDEX IF NOT EXISTS idx_mmh_original ON public.member_merge_history(original_member_id);
CREATE INDEX IF NOT EXISTS idx_mmh_winner   ON public.member_merge_history(merged_into_member_id);

ALTER TABLE public.member_merge_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active staff view merge history"   ON public.member_merge_history;
DROP POLICY IF EXISTS "Active staff insert merge history" ON public.member_merge_history;
DROP POLICY IF EXISTS "Active staff update merge history" ON public.member_merge_history;

CREATE POLICY "Active staff view merge history"
  ON public.member_merge_history FOR SELECT
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff insert merge history"
  ON public.member_merge_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Active staff update merge history"
  ON public.member_merge_history FOR UPDATE
  TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- 3. Replace merge_members_by_id with snapshot + archive (no hard delete)
CREATE OR REPLACE FUNCTION public.merge_members_by_id(_winner uuid, _loser uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  loser_stripe_customer text;
  loser_stripe_sub text;
  winner_stripe_customer text;
  winner_stripe_sub text;
  snapshot jsonb;
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

  -- Build a full snapshot of the loser BEFORE moving anything.
  SELECT jsonb_build_object(
    'member',              (SELECT to_jsonb(m) FROM public.members m WHERE m.id = _loser),
    'payments',            COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.payments             p WHERE p.member_id = _loser), '[]'::jsonb),
    'subscriptions',       COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.subscriptions        s WHERE s.member_id = _loser), '[]'::jsonb),
    'member_activities',   COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.member_activities    a WHERE a.member_id = _loser), '[]'::jsonb),
    'social_engagements',  COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM public.social_engagements   e WHERE e.member_id = _loser), '[]'::jsonb),
    'member_visits',       COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM public.member_visits        v WHERE v.member_id = _loser), '[]'::jsonb),
    'discipleship_notes',  COALESCE((SELECT jsonb_agg(to_jsonb(n)) FROM public.discipleship_notes   n WHERE n.member_id = _loser), '[]'::jsonb),
    'bible_notes',         COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.bible_notes          b WHERE b.member_id = _loser), '[]'::jsonb),
    'bible_readings',      COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.bible_readings       b WHERE b.member_id = _loser), '[]'::jsonb),
    'devotional_completions', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.devotional_completions d WHERE d.member_id = _loser), '[]'::jsonb),
    'devotional_notes',    COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.devotional_notes     d WHERE d.member_id = _loser), '[]'::jsonb)
  ) INTO snapshot;

  INSERT INTO public.member_merge_history (
    original_member_id, merged_into_member_id, merged_by, snapshot_data
  ) VALUES (_loser, _winner, auth.uid(), snapshot);

  -- Carry forward Stripe ids if winner is missing them.
  SELECT stripe_customer_id, stripe_subscription_id INTO loser_stripe_customer, loser_stripe_sub
    FROM public.members WHERE id = _loser;
  SELECT stripe_customer_id, stripe_subscription_id INTO winner_stripe_customer, winner_stripe_sub
    FROM public.members WHERE id = _winner;
  UPDATE public.members
     SET stripe_customer_id     = COALESCE(winner_stripe_customer, loser_stripe_customer),
         stripe_subscription_id = COALESCE(winner_stripe_sub,      loser_stripe_sub)
   WHERE id = _winner;

  -- Move all related rows.
  UPDATE public.payments               SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.subscriptions          SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.member_activities      SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.social_engagements     SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.member_visits          SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.discipleship_notes     SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.bible_notes            SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.bible_readings         SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.devotional_completions SET member_id = _winner WHERE member_id = _loser;
  UPDATE public.devotional_notes       SET member_id = _winner WHERE member_id = _loser;

  -- ARCHIVE the loser instead of deleting (safe trash).
  UPDATE public.members
     SET archived = true,
         archived_at = now(),
         archived_reason = 'merged_into:' || _winner::text,
         status = 'inactive',
         inactivated_at = COALESCE(inactivated_at, now()),
         inactivated_by = COALESCE(inactivated_by, auth.uid()),
         inactivation_reason = COALESCE(inactivation_reason, 'Merged into another member')
   WHERE id = _loser;

  -- Audit log
  INSERT INTO public.activity_logs (user_id, user_email, action, metadata)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'member_merged',
    jsonb_build_object('winner_id', _winner, 'loser_id', _loser, 'history_id', (SELECT id FROM public.member_merge_history WHERE original_member_id = _loser ORDER BY merge_date DESC LIMIT 1))
  );

  RETURN _winner;
END;
$$;

-- 4. Restore an archived member (no merge involved)
CREATE OR REPLACE FUNCTION public.restore_archived_member(_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only active staff can restore members';
  END IF;
  UPDATE public.members
     SET archived = false,
         archived_at = NULL,
         archived_reason = NULL,
         status = 'active',
         inactivated_at = NULL,
         inactivated_by = NULL,
         inactivation_reason = NULL
   WHERE id = _member_id;

  INSERT INTO public.activity_logs (user_id, user_email, action, metadata)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()),
          'member_restored', jsonb_build_object('member_id', _member_id));
  RETURN _member_id;
END;
$$;

-- 5. Undo a merge: restore archived original and move related rows back per snapshot
CREATE OR REPLACE FUNCTION public.undo_merge(_history_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  h public.member_merge_history%ROWTYPE;
  rec_id uuid;
  arr jsonb;
  item jsonb;
BEGIN
  IF NOT public.is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only active staff can undo merges';
  END IF;

  SELECT * INTO h FROM public.member_merge_history WHERE id = _history_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merge history not found'; END IF;
  IF h.restored THEN RAISE EXCEPTION 'This merge has already been undone'; END IF;

  -- Restore the archived original member row.
  UPDATE public.members
     SET archived = false, archived_at = NULL, archived_reason = NULL,
         status = 'active', inactivated_at = NULL, inactivated_by = NULL, inactivation_reason = NULL
   WHERE id = h.original_member_id;

  -- Move related rows back using ids saved in the snapshot.
  arr := h.snapshot_data->'payments';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.payments SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'subscriptions';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.subscriptions SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'member_activities';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.member_activities SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'social_engagements';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.social_engagements SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'member_visits';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.member_visits SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'discipleship_notes';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.discipleship_notes SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'bible_notes';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.bible_notes SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'bible_readings';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.bible_readings SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'devotional_completions';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.devotional_completions SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  arr := h.snapshot_data->'devotional_notes';
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(arr,'[]'::jsonb)) LOOP
    rec_id := (item->>'id')::uuid;
    UPDATE public.devotional_notes SET member_id = h.original_member_id WHERE id = rec_id;
  END LOOP;

  UPDATE public.member_merge_history
     SET restored = true, restored_at = now(), restored_by = auth.uid()
   WHERE id = _history_id;

  INSERT INTO public.activity_logs (user_id, user_email, action, metadata)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()),
          'merge_undone', jsonb_build_object('history_id', _history_id, 'restored_member_id', h.original_member_id));

  RETURN h.original_member_id;
END;
$$;
