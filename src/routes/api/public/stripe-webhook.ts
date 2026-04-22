import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

async function updateMemberSubscriptionStatus(input: {
  memberId: string;
  statusPayment: "On Time" | "Late" | "Pending";
  subscriptionActive: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  await supabaseAdmin
    .from("members")
    .update({
      status_payment: input.statusPayment,
      last_payment_date: input.statusPayment === "On Time" ? getCurrentNewYorkDate() : null,
      subscription_active: input.subscriptionActive,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
    })
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
                stripeSubscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null,
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
                stripeSubscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null,
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