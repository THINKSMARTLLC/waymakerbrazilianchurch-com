
-- Default EXECUTE is granted to PUBLIC; revoke from PUBLIC explicitly.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_weekly_ledger_entries() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_ledger_row_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_payment_to_ledger(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_payment_from_ledger(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_member_ledger(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_non_super_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_member_self_sensitive_updates() FROM PUBLIC;

-- Keep merge / restore / undo callable for authenticated staff (function self-checks role)
REVOKE EXECUTE ON FUNCTION public.merge_members_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_members_by_id(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.undo_merge(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_archived_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_members_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_members_by_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_merge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_archived_member(uuid) TO authenticated;
