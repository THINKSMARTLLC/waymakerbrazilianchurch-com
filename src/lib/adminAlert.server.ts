/**
 * Server-side admin alert helper.
 *
 * Sends a dashboard notification (activity_logs row) and emails all
 * super_admin users with details about a critical system event.
 *
 * Safe to call from public server routes (e.g. Stripe webhook) — uses the
 * service-role client and never throws.
 */
import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "waymakerbrazilianchurch-com";
const SENDER_DOMAIN = "notify.waymakerbrazilianchurch.com";
const FROM_DOMAIN = "waymakerbrazilianchurch.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AdminAlertInput {
  title: string;
  scope: string;
  message: string;
  details?: string | null;
  context?: Record<string, unknown>;
}

async function getSuperAdminEmails(): Promise<string[]> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("email, status")
    .in("user_id", ids);
  return (profiles ?? [])
    .filter((p) => p.status === "active" && p.email)
    .map((p) => p.email as string);
}

async function enqueueAlertEmail(recipient: string, alert: AdminAlertInput) {
  const template = TEMPLATES["system-alert"];
  if (!template) return;

  const messageId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  const data = {
    title: alert.title,
    scope: alert.scope,
    message: alert.message,
    details: alert.details ?? undefined,
    occurredAt,
  };

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient.toLowerCase())
    .maybeSingle();
  if (suppressed) return;

  // Ensure unsubscribe token exists for this address
  let unsubscribeToken: string;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient.toLowerCase())
    .maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else {
    unsubscribeToken = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: recipient.toLowerCase() },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient.toLowerCase())
      .maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;
  }

  const element = React.createElement(template.component, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function"
      ? template.subject(data)
      : template.subject;

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "system-alert",
    recipient_email: recipient,
    status: "pending",
  });

  const idempotencyKey = `admin-alert-${alert.scope}-${alert.title}-${occurredAt}-${recipient}`;

  await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: "system-alert",
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
}

/**
 * Dispatch a system alert: writes a dashboard log row and emails all
 * super admins. Never throws — failures are logged to console only.
 */
export async function sendAdminAlert(alert: AdminAlertInput): Promise<void> {
  try {
    // 1. Dashboard notification (visible in admin > System Logs)
    await supabaseAdmin.from("activity_logs").insert([
      {
        action: "admin_alert",
        metadata: {
          title: alert.title,
          scope: alert.scope,
          message: alert.message,
          details: alert.details ?? null,
          ...(alert.context ?? {}),
        } as never,
      },
    ]);

    // 2. Email super admins
    const recipients = await getSuperAdminEmails();
    await Promise.all(
      recipients.map((email) =>
        enqueueAlertEmail(email, alert).catch((err) =>
          console.error("[admin-alert] email failed", email, err),
        ),
      ),
    );
  } catch (err) {
    console.error("[admin-alert] dispatch failed", err);
  }
}
