
-- 1) Prevent members from changing sensitive fields on their own row
CREATE OR REPLACE FUNCTION public.prevent_member_self_sensitive_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_active_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_active IS DISTINCT FROM OLD.subscription_active
     OR NEW.weekly_contribution_usd IS DISTINCT FROM OLD.weekly_contribution_usd
     OR NEW.member_role IS DISTINCT FROM OLD.member_role
     OR NEW.discipleship_stage IS DISTINCT FROM OLD.discipleship_stage
     OR NEW.payment_type IS DISTINCT FROM OLD.payment_type
     OR NEW.archived IS DISTINCT FROM OLD.archived
     OR NEW.status_payment IS DISTINCT FROM OLD.status_payment
  THEN
    RAISE EXCEPTION 'You are not allowed to modify this field'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_self_sensitive_updates ON public.members;
CREATE TRIGGER trg_prevent_member_self_sensitive_updates
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.prevent_member_self_sensitive_updates();

-- 2) Restrict payment_relationships: members can only SELECT, not write
DROP POLICY IF EXISTS "Payers manage own relationships" ON public.payment_relationships;
CREATE POLICY "Payers view own relationships"
ON public.payment_relationships
FOR SELECT
TO authenticated
USING (payer_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- 3) Subscriptions: allow members to view their own subscription
CREATE POLICY "Members view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- 4) Fix mutable search_path on remaining functions
ALTER FUNCTION public.week_monday(date) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 5) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
--    These are used internally (triggers / server-side) and should not be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_weekly_ledger_entries() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_ledger_row_status(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_payment_to_ledger(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_payment_from_ledger(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_member_ledger(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_members_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_members_by_id(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.undo_merge(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_archived_member(uuid) FROM anon;

-- Role-check helpers: used inside RLS as the policy owner, so client EXECUTE is not needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_non_super_staff(uuid) FROM anon;
