import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "login"
  | "logout"
  | "signup"
  | "member_created"
  | "member_updated"
  | "member_status_changed"
  | "payment_added"
  | "subscription_created"
  | "cash_donation_added"
  | "user_role_changed"
  | "user_status_changed"
  | "user_deleted"
  | "data_exported"
  | "members_imported";

export async function logActivity(
  action: ActivityAction,
  metadata?: Record<string, unknown>,
  pageAccessed?: string,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_logs").insert([
      {
        user_id: user.id,
        user_email: user.email ?? null,
        action,
        page_accessed: pageAccessed ?? (typeof window !== "undefined" ? window.location.pathname : null),
        metadata: (metadata ?? null) as never,
      },
    ]);
  } catch (err) {
    console.warn("Failed to log activity", err);
  }
}
