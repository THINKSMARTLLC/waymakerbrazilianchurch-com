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

async function findMemberForStripeEmail(email?: string | null, fallbackMemberId?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
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
  }

  if (!fallbackMemberId) return null;

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("id, email, status, status_payment, stripe_customer_id, stripe_subscription_id")
    .eq("id", fallbackMemberId)
    .maybeSingle();

  return member ?? null;
}

async function paymentAlreadyRegistered(memberId: string, externalPaymentId: string, paymentDate: string) {
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("member_id", memberId)
    .eq("payment_date", paymentDate)
    .eq("payment_method", "stripe")
    .eq("status", "paid")
    .ilike("notes", `%${externalPaymentId}%`)
    .limit(1);

  return (existing?.length ?? 0) > 0;
}

async function registerMatchedStripePayment(input: {
  amount: number;
  email?: string | null;
  eventType: string;
  externalPaymentId: string;
  memberId: string;
  paymentDate: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const alreadyRegistered = await paymentAlreadyRegistered(
    input.memberId,
    input.externalPaymentId,
    input.paymentDate,
  );

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
      payment_frequency: "weekly",
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

async function updateMemberSubscriptionStatus(input: {
  memberId: string;
  statusPayment: "On Time" | "Late" | "Pending";
  subscriptionActive: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const memberUpdate: {
    last_payment_date: string | null;
    status?: "active";
    status_payment: "On Time" | "Late" | "Pending";
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_active: boolean;
  } = {
    last_payment_date: input.statusPayment === "On Time" ? getCurrentNewYorkDate() : null,
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

          if (!webhookSecret || !signature) {
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
          }

          const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

          if (event.type === "invoice.paid") {
            const invoice = event.data.object;
            const memberId = invoice.parent?.subscription_details?.metadata?.memberId ?? invoice.lines.data[0]?.metadata?.memberId;
            if (memberId) {
              await updateMemberSubscriptionStatus({
                memberId,
                statusPayment: "On Time",
                subscriptionActive: true,
                stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null,
                stripeSubscriptionId: typeof invoice.parent?.subscription_details?.subscription === "string"
                  ? invoice.parent.subscription_details.subscription
                  : invoice.parent?.subscription_details?.subscription?.id ?? null,
              });
            }
          }

          if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object;
            const memberId = invoice.parent?.subscription_details?.metadata?.memberId ?? invoice.lines.data[0]?.metadata?.memberId;
            if (memberId) {
              await updateMemberSubscriptionStatus({
                memberId,
                statusPayment: "Late",
                subscriptionActive: true,
                stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null,
                stripeSubscriptionId: typeof invoice.parent?.subscription_details?.subscription === "string"
                  ? invoice.parent.subscription_details.subscription
                  : invoice.parent?.subscription_details?.subscription?.id ?? null,
              });
            }
          }

          if (event.type === "customer.subscription.deleted") {
            const subscription = event.data.object;
            const memberId = subscription.metadata.memberId;
            if (memberId) {
              await updateMemberSubscriptionStatus({
                memberId,
                statusPayment: "Pending",
                subscriptionActive: false,
                stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
                stripeSubscriptionId: subscription.id,
              });
            }
          }

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Webhook error" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      },
    },
  },
});