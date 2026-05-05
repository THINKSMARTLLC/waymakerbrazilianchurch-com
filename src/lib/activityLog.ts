import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "login"
  | "logout"
  | "signup"
  | "member_created"
  | "member_updated"
  | "member_deleted"
  | "member_status_changed"
  | "payment_added"
  | "subscription_created"
  | "cash_donation_added"
  | "user_role_changed"
  | "user_status_changed"
  | "user_deleted"
  | "data_exported"
  | "members_imported"
  | "error";

export async function logActivity(
  action: ActivityAction | string,
  metadata?: Record<string, unknown>,
  pageAccessed?: string,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_logs").insert([
      {
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        action,
        page_accessed: pageAccessed ?? (typeof window !== "undefined" ? window.location.pathname : null),
        metadata: (metadata ?? null) as never,
      },
    ]);
  } catch (err) {
    console.warn("Failed to log activity", err);
  }
}

/** Structured error logger — captures message + stack + arbitrary context. */
export async function logError(
  scope: string,
  err: unknown,
  context?: Record<string, unknown>,
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? null : null;
  console.error(`[${scope}]`, message, context ?? {}, stack ?? "");
  await logActivity("error", {
    scope,
    message,
    stack,
    ...(context ?? {}),
  });
}
