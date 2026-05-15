import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestProtocol } from "@tanstack/react-start/server";
import { z } from "zod";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRICE_ID = "price_1TP4GqQgaefH3AzYwnNLBcTr";
const NEW_YORK_TIME_ZONE = "America/New_York";

const createSessionInput = z.object({
  // Backwards compatible: memberId === payer === beneficiary when only one is provided.
  memberId: z.string().uuid().optional(),
  payerMemberId: z.string().uuid().optional(),
  beneficiaryMemberId: z.string().uuid().optional(),
  contributionType: z.string().max(60).optional(),
  relationshipLabel: z.string().max(60).optional(),
});

const finalizeSessionInput = z.object({
  sessionId: z.string().min(1),
});

const markCanceledInput = z.object({
  memberId: z.string().uuid(),
});

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
  });
}

function getBaseUrl() {
  const host = getRequestHost();
  const protocol = getRequestProtocol();
  return `${protocol}://${host}`;
}

export function getCurrentNewYorkDate() {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: NEW_YORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return formatted;
}

async function updateMemberContributionState(input: {
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

export const createSubscriptionSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSessionInput)
  .handler(async ({ data, context }) => {
    const stripe = getStripeClient();
    const baseUrl = getBaseUrl();

    const payerId = data.payerMemberId ?? data.memberId;
    const beneficiaryId = data.beneficiaryMemberId ?? data.memberId ?? payerId;
    if (!payerId || !beneficiaryId) {
      throw new Error("Payer and beneficiary are required.");
    }

    // Payer must be the authenticated user
    const { data: payer, error: payerError } = await context.supabase
      .from("members")
      .select("id, email, name, user_id, stripe_customer_id")
      .eq("id", payerId)
      .maybeSingle();

    if (payerError || !payer || payer.user_id !== context.userId) {
      throw new Error("Payer member not found.");
    }

    // Beneficiary lookup uses admin client (any active member can be a beneficiary)
    const { data: beneficiary, error: beneficiaryError } = await supabaseAdmin
      .from("members")
      .select("id, name, subscription_active")
      .eq("id", beneficiaryId)
      .maybeSingle();

    if (beneficiaryError || !beneficiary) {
      throw new Error("Beneficiary member not found.");
    }

    // Self-payment: keep existing guard (cannot double-subscribe yourself)
    if (payerId === beneficiaryId && beneficiary.subscription_active) {
      throw new Error("An active subscription already exists.");
    }

    let customerId = payer.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: payer.email ?? undefined,
        name: payer.name,
        metadata: { memberId: payer.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("members")
        .update({ stripe_customer_id: customerId })
        .eq("id", payer.id);
    }

    const contributionType = data.contributionType ?? "pastor_salary";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel?member_id=${beneficiary.id}`,
      metadata: {
        // legacy
        memberId: beneficiary.id,
        member_id: beneficiary.id,
        // new
        payer_member_id: payer.id,
        beneficiary_member_id: beneficiary.id,
        contribution_type: contributionType,
        relationship_label: data.relationshipLabel ?? "",
      },
      subscription_data: {
        metadata: {
          memberId: beneficiary.id,
          member_id: beneficiary.id,
          payer_member_id: payer.id,
          beneficiary_member_id: beneficiary.id,
          contribution_type: contributionType,
          relationship_label: data.relationshipLabel ?? "",
        },
      },
    });

    return { url: session.url };
  });

export const finalizeSubscriptionSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(finalizeSessionInput)
  .handler(async ({ data, context }) => {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.mode !== "subscription" || session.payment_status !== "paid") {
      throw new Error("Subscription payment has not been completed.");
    }

    const beneficiaryId =
      session.metadata?.beneficiary_member_id ?? session.metadata?.memberId ?? session.metadata?.member_id ?? null;
    const payerId = session.metadata?.payer_member_id ?? beneficiaryId;
    const contributionType = session.metadata?.contribution_type ?? "pastor_salary";
    const relationshipLabel = session.metadata?.relationship_label || null;

    if (!beneficiaryId || !payerId) {
      throw new Error("Subscription metadata is missing.");
    }

    // Authorise: caller must be either payer or beneficiary
    const { data: authMember } = await context.supabase
      .from("members")
      .select("id, user_id")
      .in("id", [beneficiaryId, payerId])
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();

    if (!authMember) {
      throw new Error("Member not found.");
    }

    const stripeCustomerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

    await updateMemberContributionState({
      memberId: beneficiaryId,
      statusPayment: "On Time",
      subscriptionActive: true,
      stripeCustomerId,
      stripeSubscriptionId,
    });

    // Save reusable payer→beneficiary relationship
    await supabaseAdmin
      .from("payment_relationships")
      .upsert(
        {
          payer_member_id: payerId,
          beneficiary_member_id: beneficiaryId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          contribution_type: contributionType as never,
        },
        { onConflict: "payer_member_id,beneficiary_member_id,contribution_type" },
      );

    return { ok: true };
  });

export const markSubscriptionCanceled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(markCanceledInput)
  .handler(async ({ data, context }) => {
    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id, user_id, subscription_active")
      .eq("id", data.memberId)
      .maybeSingle();

    if (memberError || !member || member.user_id !== context.userId) {
      throw new Error("Member not found.");
    }

    if (!member.subscription_active) {
      await updateMemberContributionState({
        memberId: member.id,
        statusPayment: "Pending",
        subscriptionActive: false,
      });
    }

    return { ok: true };
  });
