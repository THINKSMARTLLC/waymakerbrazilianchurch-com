import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { getCurrentNewYorkDate } from "@/lib/stripe-subscriptions.functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

const handledEventTypes = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function createOkResponse(body: Record<string, unknown> = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function logWebhookDebug(message: string, metadata?: Record<string, unknown>) {
  console.info(`[stripe-webhook] ${message}`, metadata ?? {});
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
  });
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null;
}

function intervalToFrequency(interval?: string | null): "weekly" | "monthly" {
  if (interval === "month" || interval === "year") return "monthly";
  return "weekly";
}

function getInvoiceFrequency(invoice: Stripe.Invoice): "weekly" | "monthly" {
  for (const line of invoice.lines.data) {
    const price = line.pricing?.price_details?.price;
    const interval = price && typeof price !== "string" ? price.recurring?.interval ?? null : null;
    if (interval) return intervalToFrequency(interval);
  }
  return "weekly";
}

function getNewYorkDateFromUnix(timestamp?: number | null) {
  if (!timestamp) return getCurrentNewYorkDate();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp * 1000));
}

async function logStripeEvent(action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("activity_logs").insert([
    {
      action,
      metadata: metadata as Json,
    },
  ]);
}

async function findMemberById(memberId?: string | null) {
  if (!memberId) return null;
  const { data } = await supabaseAdmin
    .from("members")
    .select("id, email, status, status_payment, stripe_customer_id, stripe_subscription_id")
    .eq("id", memberId)
    .maybeSingle();
  return data ?? null;
}

async function findMemberByStripeCustomer(stripeCustomerId?: string | null) {
  if (!stripeCustomerId) return null;
  const { data } = await supabaseAdmin
    .from("members")
    .select("id, email, status, status_payment, stripe_customer_id, stripe_subscription_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .limit(1);
  return data?.[0] ?? null;
}

async function findMemberForStripeEmail(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const { data: members } = await supabaseAdmin
    .from("members")
    .select("id, email, status, status_payment, stripe_customer_id, stripe_subscription_id")
    .ilike("email", normalizedEmail)
    .limit(2);

  if ((members ?? []).length === 1) {
    return members?.[0] ?? null;
  }

  if ((members ?? []).length > 1) {
    await logStripeEvent("stripe_payment_duplicate_email_match", {
      email: normalizedEmail,
      member_ids: members?.map((member) => member.id) ?? [],
    });
    return null;
  }

  return null;
}

async function resolveMember(input: {
  memberIdMetadata?: string | null;
  email?: string | null;
  stripeCustomerId?: string | null;
}) {
  return (
    (await findMemberById(input.memberIdMetadata)) ??
    (await findMemberForStripeEmail(input.email)) ??
    (await findMemberByStripeCustomer(input.stripeCustomerId))
  );
}

async function paymentAlreadyRegistered(memberId: string, externalPaymentId: string) {
  const { data: exactEventMatch } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("member_id", memberId)
    .eq("payment_method", "stripe")
    .ilike("notes", `%${externalPaymentId}%`)
    .limit(1);

  return (exactEventMatch?.length ?? 0) > 0;
}

async function registerMatchedStripePayment(input: {
  amount: number;
  email?: string | null;
  eventType: string;
  externalPaymentId: string;
  memberId: string;
  paymentDate: string;
  paymentFrequency?: "weekly" | "monthly";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const alreadyRegistered = await paymentAlreadyRegistered(input.memberId, input.externalPaymentId);

  if (alreadyRegistered) {
    await logStripeEvent("stripe_payment_duplicate_ignored", {
      email: normalizeEmail(input.email),
      event_type: input.eventType,
      member_id: input.memberId,
      payment_date: input.paymentDate,
      stripe_payment_id: input.externalPaymentId,
    });
    return;
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      amount: input.amount,
      base_amount: input.amount,
      contribution_type: "pastor_salary",
      extra_amount: 0,
      member_id: input.memberId,
      notes: `Stripe payment ID: ${input.externalPaymentId} | Event: ${input.eventType}`,
      payment_date: input.paymentDate,
      payment_frequency: input.paymentFrequency ?? "weekly",
      payment_method: "stripe",
      reference_month: null,
      status: "paid",
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    throw new Error(paymentError?.message ?? "Failed to register Stripe payment.");
  }

  await supabaseAdmin.from("payment_contributions").insert({
    amount: input.amount,
    contribution_type: "pastor_salary",
    destination: null,
    payment_id: payment.id,
  });

  logWebhookDebug("Payment saved", {
    amount: input.amount,
    memberId: input.memberId,
    stripePaymentId: input.externalPaymentId,
  });

  await logStripeEvent("stripe_payment_matched", {
    amount: input.amount,
    email: normalizeEmail(input.email),
    event_type: input.eventType,
    member_id: input.memberId,
    payment_date: input.paymentDate,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_payment_id: input.externalPaymentId,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
  });
}

async function resolveCustomerEmail(
  stripe: Stripe,
  input: {
    checkoutEmail?: string | null;
    customerEmail?: string | null;
    customerId?: string | null;
  },
) {
  const directEmail = normalizeEmail(input.checkoutEmail ?? input.customerEmail);
  if (directEmail) return directEmail;

  if (!input.customerId) return null;

  const customer = await stripe.customers.retrieve(input.customerId);
  if (customer.deleted) return null;

  return normalizeEmail(customer.email);
}

async function markUnmatchedStripePayment(input: {
  amount: number;
  email?: string | null;
  eventType: string;
  externalPaymentId: string;
  paymentDate: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  await logStripeEvent("stripe_payment_unmatched", {
    amount: input.amount,
    email: normalizeEmail(input.email),
    event_type: input.eventType,
    payment_date: input.paymentDate,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_payment_id: input.externalPaymentId,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
  });
}

async function updateMemberSubscriptionStatus(input: {
  contributionFrequency?: "weekly" | "monthly";
  memberId: string;
  statusPayment: "On Time" | "Late" | "Pending";
  subscriptionActive: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const memberUpdate: {
    last_payment_date: string | null;
    payment_type: "card";
    status?: "active";
    status_payment: "On Time" | "Late" | "Pending";
    contribution_frequency?: "weekly" | "monthly";
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_active: boolean;
  } = {
    contribution_frequency: input.contributionFrequency,
    last_payment_date: input.statusPayment === "On Time" ? getCurrentNewYorkDate() : null,
    payment_type: "card",
    status_payment: input.statusPayment,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    subscription_active: input.subscriptionActive,
  };

  if (input.statusPayment === "On Time") {
    memberUpdate.status = "active";
  }

  await supabaseAdmin
    .from("members")
    .update(memberUpdate)
    .eq("id", input.memberId);
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const stripe = getStripeClient();
          const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
          const signature = request.headers.get("stripe-signature");
          const body = await request.text();

          logWebhookDebug("Webhook received", {
            hasSignature: Boolean(signature),
            rawBodyLength: body.length,
          });

          if (!webhookSecret || !signature) {
            logWebhookDebug("Webhook ignored: missing Stripe secret or signature");
            return createOkResponse({ received: true, ignored: true });
          }

          let event: Stripe.Event;

          try {
            event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
          } catch (error) {
            logWebhookDebug("Webhook ignored: invalid Stripe signature", {
              error: error instanceof Error ? error.message : "Unknown signature error",
            });
            return createOkResponse({ received: true, ignored: true });
          }

          const eventObject = event.data.object as { metadata?: Record<string, string> | null; customer_email?: string | null };
          logWebhookDebug(`Event received: ${event.type}`, {
            eventId: event.id,
            eventType: event.type,
            customer_email: eventObject?.customer_email ?? null,
            metadata_member_id: eventObject?.metadata?.member_id ?? null,
          });

          if (!handledEventTypes.has(event.type)) {
            logWebhookDebug(`Event type not handled: ${event.type}`);
            return createOkResponse({ received: true, ignored: true, eventType: event.type });
          }

          // Idempotency: ensure each Stripe event is processed only once.
          const { error: dedupError } = await supabaseAdmin
            .from("stripe_processed_events")
            .insert({ stripe_event_id: event.id, event_type: event.type });

          if (dedupError) {
            // 23505 = unique_violation → duplicate event already processed
            if ((dedupError as { code?: string }).code === "23505") {
              logWebhookDebug("log duplicate ignored", {
                eventId: event.id,
                eventType: event.type,
              });
              await logStripeEvent("stripe_event_duplicate_ignored", {
                event_id: event.id,
                event_type: event.type,
              });
              return createOkResponse({ received: true, duplicate: true });
            }
            console.error("[stripe-webhook] Failed to record event id", dedupError);
          }

          if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const email = await resolveCustomerEmail(stripe, {
              checkoutEmail: session.customer_details?.email ?? session.customer_email ?? null,
              customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
            });
            const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
            const stripeSubscriptionId = typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null;
            const paymentDate = getNewYorkDateFromUnix(session.created);
            const memberIdMetadata = session.metadata?.member_id ?? null;
            const member = await resolveMember({ memberIdMetadata, email, stripeCustomerId });

            logWebhookDebug(`Email found: ${email ?? "none"}`, {
              eventType: event.type,
              stripePaymentId: session.payment_intent?.toString() ?? session.id,
            });

            if (!member) {
              console.error("[stripe-webhook] Member not found", {
                eventType: event.type,
                email,
                memberIdMetadata,
                stripeCustomerId,
                stripePaymentId: session.payment_intent?.toString() ?? session.id,
              });
              await logStripeEvent("stripe_member_not_found", {
                event_type: event.type,
                email: normalizeEmail(email),
                metadata_member_id: memberIdMetadata,
                stripe_customer_id: stripeCustomerId,
              });
              await markUnmatchedStripePayment({
                amount: (session.amount_total ?? 0) / 100,
                email,
                eventType: event.type,
                externalPaymentId: session.payment_intent?.toString() ?? session.id,
                paymentDate,
                stripeCustomerId,
                stripeSubscriptionId,
              });
            } else {
              logWebhookDebug(`Member matched: ${member.id}`, { email, eventType: event.type });

              await updateMemberSubscriptionStatus({
                memberId: member.id,
                statusPayment: "On Time",
                subscriptionActive: Boolean(stripeSubscriptionId) || member.stripe_subscription_id !== null,
                stripeCustomerId,
                stripeSubscriptionId,
              });

              await registerMatchedStripePayment({
                amount: (session.amount_total ?? 0) / 100,
                email,
                eventType: event.type,
                externalPaymentId: session.payment_intent?.toString() ?? session.id,
                memberId: member.id,
                paymentDate,
                stripeCustomerId,
                stripeSubscriptionId,
              });
            }
          }

          if (event.type === "invoice.paid") {
            const invoice = event.data.object;
            const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
            const stripeSubscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
              ? invoice.parent.subscription_details.subscription
              : invoice.parent?.subscription_details?.subscription?.id ?? null;
            const paymentFrequency = getInvoiceFrequency(invoice);
            const email = await resolveCustomerEmail(stripe, {
              customerEmail: invoice.customer_email,
              customerId: stripeCustomerId,
            });
            const memberIdMetadata = invoice.metadata?.member_id ?? null;
            const member = await resolveMember({ memberIdMetadata, email, stripeCustomerId });
            const paymentDate = getNewYorkDateFromUnix(invoice.status_transitions.paid_at ?? invoice.created);

            logWebhookDebug(`Email found: ${email ?? "none"}`, {
              eventType: event.type,
              stripePaymentId: invoice.id,
            });

            if (!member) {
              console.error("[stripe-webhook] Member not found", {
                eventType: event.type,
                email,
                memberIdMetadata,
                stripeCustomerId,
                stripeInvoiceId: invoice.id,
              });
              await logStripeEvent("stripe_member_not_found", {
                event_type: event.type,
                email: normalizeEmail(email),
                metadata_member_id: memberIdMetadata,
                stripe_customer_id: stripeCustomerId,
              });
              await markUnmatchedStripePayment({
                amount: (invoice.amount_paid ?? 0) / 100,
                email,
                eventType: event.type,
                externalPaymentId: invoice.id,
                paymentDate,
                stripeCustomerId,
                stripeSubscriptionId,
              });
            } else {
              logWebhookDebug(`Member matched: ${member.id}`, { email, eventType: event.type });

              await updateMemberSubscriptionStatus({
                contributionFrequency: paymentFrequency,
                memberId: member.id,
                statusPayment: "On Time",
                subscriptionActive: true,
                stripeCustomerId,
                stripeSubscriptionId,
              });

              await registerMatchedStripePayment({
                amount: (invoice.amount_paid ?? 0) / 100,
                email,
                eventType: event.type,
                externalPaymentId: invoice.id,
                memberId: member.id,
                paymentDate,
                paymentFrequency,
                stripeCustomerId,
                stripeSubscriptionId,
              });
            }
          }

          if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object;
            const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
            const stripeSubscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
              ? invoice.parent.subscription_details.subscription
              : invoice.parent?.subscription_details?.subscription?.id ?? null;
            const email = await resolveCustomerEmail(stripe, {
              customerEmail: invoice.customer_email,
              customerId: stripeCustomerId,
            });
            const memberIdMetadata = invoice.metadata?.member_id ?? null;
            const member = await resolveMember({ memberIdMetadata, email, stripeCustomerId });

            logWebhookDebug(`Invoice payment failed`, {
              eventType: event.type,
              email,
              memberId: member?.id ?? null,
              stripeInvoiceId: invoice.id,
            });

            if (member) {
              await updateMemberSubscriptionStatus({
                memberId: member.id,
                statusPayment: "Late",
                subscriptionActive: false,
                stripeCustomerId,
                stripeSubscriptionId,
              });
            }

            await logStripeEvent("stripe_payment_failed", {
              amount: (invoice.amount_due ?? 0) / 100,
              email: normalizeEmail(email),
              event_type: event.type,
              member_id: member?.id ?? null,
              stripe_customer_id: stripeCustomerId,
              stripe_invoice_id: invoice.id,
              stripe_subscription_id: stripeSubscriptionId,
            });
          }

          if (
            event.type === "customer.subscription.created" ||
            event.type === "customer.subscription.updated" ||
            event.type === "customer.subscription.deleted"
          ) {
            const subscription = event.data.object;
            const stripeCustomerId = typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id ?? null;
            const stripeSubscriptionId = subscription.id;
            const email = await resolveCustomerEmail(stripe, { customerId: stripeCustomerId });
            const memberIdMetadata = subscription.metadata?.member_id ?? null;
            const member = await resolveMember({ memberIdMetadata, email, stripeCustomerId });

            const isDeleted = event.type === "customer.subscription.deleted";
            const isActive =
              !isDeleted && (subscription.status === "active" || subscription.status === "trialing");
            const interval = subscription.items.data[0]?.price?.recurring?.interval ?? null;
            const contributionFrequency = intervalToFrequency(interval);

            logWebhookDebug(`Subscription ${event.type}`, {
              eventType: event.type,
              email,
              memberId: member?.id ?? null,
              status: subscription.status,
              stripeSubscriptionId,
            });

            if (member) {
              const statusPayment: "On Time" | "Late" | "Pending" = isActive
                ? "On Time"
                : subscription.status === "past_due" || subscription.status === "unpaid"
                  ? "Late"
                  : "Pending";

              await updateMemberSubscriptionStatus({
                contributionFrequency,
                memberId: member.id,
                statusPayment,
                subscriptionActive: isActive,
                stripeCustomerId,
                stripeSubscriptionId: isDeleted ? null : stripeSubscriptionId,
              });
            }

            await logStripeEvent(`stripe_${event.type.replace(/\./g, "_")}`, {
              email: normalizeEmail(email),
              event_type: event.type,
              member_id: member?.id ?? null,
              status: subscription.status,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
            });
          }

          if (event.type === "payment_intent.payment_failed") {
            const paymentIntent = event.data.object;
            const stripeCustomerId = typeof paymentIntent.customer === "string"
              ? paymentIntent.customer
              : paymentIntent.customer?.id ?? null;
            const email = stripeCustomerId
              ? await resolveCustomerEmail(stripe, { customerId: stripeCustomerId })
              : null;
            const member = await resolveMember({
              email,
              stripeCustomerId,
            });

            if (member) {
              await updateMemberSubscriptionStatus({
                memberId: member.id,
                statusPayment: "Late",
                subscriptionActive: false,
                stripeCustomerId,
                stripeSubscriptionId: member.stripe_subscription_id,
              });
            }

            await logStripeEvent("stripe_payment_failed", {
              amount: (paymentIntent.amount ?? 0) / 100,
              email: normalizeEmail(email),
              event_type: event.type,
              member_id: member?.id ?? null,
              payment_intent_id: paymentIntent.id,
              stripe_customer_id: stripeCustomerId,
            });
          }

          return createOkResponse();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Webhook error";
          const stack = error instanceof Error ? error.stack ?? null : null;
          logWebhookDebug("Webhook processing error", { error: message, stack });
          try {
            await logStripeEvent("error", {
              scope: "stripe-webhook",
              message,
              stack,
            });
          } catch (logErr) {
            console.error("[stripe-webhook] failed to persist error log", logErr);
          }
          return createOkResponse({
            received: true,
            error: message,
          });
        }
      },
    },
  },
});