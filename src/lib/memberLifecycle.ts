import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";

export interface LifecycleResult {
  ok: boolean;
  error?: string;
}

/** Mark a member as inactive (archive). Records who/when/why and logs the action. */
export async function inactivateMember(
  memberId: string,
  reason?: string,
): Promise<LifecycleResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("members")
    .update({
      status: "inactive",
      inactivated_at: new Date().toISOString(),
      inactivated_by: user?.id ?? null,
      inactivation_reason: reason ?? null,
    } as never)
    .eq("id", memberId);

  if (error) return { ok: false, error: error.message };

  await logActivity("member_status_changed", { member_id: memberId, status: "inactive", reason });
  return { ok: true };
}

/** Reactivate a previously inactive member. Clears inactivation metadata. */
export async function reactivateMember(memberId: string): Promise<LifecycleResult> {
  const { error } = await supabase
    .from("members")
    .update({
      status: "active",
      inactivated_at: null,
      inactivated_by: null,
      inactivation_reason: null,
    } as never)
    .eq("id", memberId);

  if (error) return { ok: false, error: error.message };

  await logActivity("member_status_changed", { member_id: memberId, status: "active" });
  return { ok: true };
}

/** Count payments linked to a member (used to gate hard delete). */
export async function countMemberPayments(memberId: string): Promise<number> {
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Hard delete a member record. SAFE-MODE: refuses to delete if any payments
 * exist (history would be orphaned). Caller should warn the admin.
 */
export async function deleteMemberPermanently(memberId: string): Promise<LifecycleResult> {
  const payments = await countMemberPayments(memberId);
  if (payments > 0) {
    return {
      ok: false,
      error: `Cannot delete: this member has ${payments} payment record${payments > 1 ? "s" : ""}. Inactivate instead, or remove the payments first.`,
    };
  }

  // Snapshot for audit BEFORE deletion.
  const { data: snapshot } = await supabase
    .from("members")
    .select("id, name, email, phone, user_id, status")
    .eq("id", memberId)
    .single();

  // Clear any subscriptions first (no FK cascade defined).
  await supabase.from("subscriptions").delete().eq("member_id", memberId);

  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  await logActivity("member_deleted", { member_id: memberId, member_snapshot: snapshot ?? { id: memberId } });
  return { ok: true };
}
