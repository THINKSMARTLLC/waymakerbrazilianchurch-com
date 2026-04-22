import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestProtocol } from "@tanstack/react-start/server";
import { z } from "zod";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRICE_ID = "price_1TP4GqQgaefH3AzYwnNLBcTr";
const NEW_YORK_TIME_ZONE = "America/New_York";

const createSessionInput = z.object({
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

export const createSubscriptionSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSessionInput)
  .handler(async ({ data, context }) => {
    const stripe = getStripeClient();
    const baseUrl = getBaseUrl();

    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id, email, name, user_id, subscription_active, stripe_customer_id")
      .eq("id", data.memberId)
      .maybeSingle();

    if (memberError || !member || member.user_id !== context.userId) {
      throw new Error("Member not found.");
    }

    if (member.subscription_active) {
      throw new Error("An active subscription already exists.");
    }

    let customerId = member.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email ?? undefined,
        name: member.name,
        metadata: {
          memberId: member.id,
        },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("members")
        .update({ stripe_customer_id: customerId })
        .eq("id", member.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel?member_id=${member.id}`,
      metadata: {
        memberId: member.id,
        contribution_type: "pastor_salary",
      },
      subscription_data: {
        metadata: {
          memberId: member.id,
          contribution_type: "pastor_salary",
        },
      },
    });

    return { url: session.url };
  });