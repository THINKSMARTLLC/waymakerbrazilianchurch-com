import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const NY_TZ = "America/New_York";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

function nyDate(unix?: number | null) {
  const ts = unix ? unix * 1000 : Date.now();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function normEmail(e?: string | null) {
  return e ? e.trim().toLowerCase() : null;
}

type FreqValue = "weekly" | "monthly";
type MemberStatusPayment = "On Time" | "Late" | "Pending";
type MemberRow = {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  contribution_frequency: FreqValue | null;
  last_payment_date?: string | null;
};

function intervalToFrequency(interval?: string | null): FreqValue {
  if (interval === "month" || interval === "year") return "monthly";
  return "weekly";
}

function getInvoiceFrequency(invoice: Stripe.Invoice, fallback: FreqValue): FreqValue {
  for (const line of invoice.lines.data) {
    const price = line.pricing?.price_details?.price;
    const interval = price && typeof price !== "string" ? price.recurring?.interval ?? null : null;
    if (interval) return intervalToFrequency(interval);
  }
  return fallback;
}

async function ensureStaff(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  const allowed = ["super_admin", "admin", "church_admin", "finance_manager"];
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error("Only staff can resync Stripe data.");
  }
}

async function logStripeSync(action: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.from("activity_logs").insert([
    {
      action,
      metadata: metadata as Json,
    },
  ]);
}

async function findExistingStripePayment(
  memberId: string,
  externalIds: { piId?: string | null; chargeId?: string | null; invoiceId?: string | null },
): Promise<string | null> {
  // Try strongest identifiers first.
  if (externalIds.piId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", externalIds.piId)
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  if (externalIds.chargeId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_charge_id", externalIds.chargeId)
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  // Backward-compat: previously stored only "Stripe payment ID: <invoiceId>" in notes.
  const fallbackId = externalIds.invoiceId ?? externalIds.piId ?? externalIds.chargeId;
  if (fallbackId) {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("member_id", memberId)
      .eq("payment_method", "stripe")
      .ilike("notes", `%${fallbackId}%`)
      .limit(1);
    if (data?.[0]?.id) return data[0].id;
  }
  return null;
}

type StripeEnrichment = {
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
  payment_method_type: string | null;
  receipt_url: string | null;
};

function extractEnrichmentFromCharge(charge: Stripe.Charge | null | undefined): StripeEnrichment {
  if (!charge) {
    return {
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      card_last4: null,
      card_brand: null,
      payment_method_type: null,
      receipt_url: null,
    };
  }
  const pmd = charge.payment_method_details;
  const card = pmd?.card;
  const piId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  return {
    stripe_payment_intent_id: piId,
    stripe_charge_id: charge.id,
    card_last4: card?.last4 ?? null,
    card_brand: card?.brand ?? null,
    payment_method_type: pmd?.type ?? null,
    receipt_url: charge.receipt_url ?? null,
  };
}

function createMemberResolver(membersAll: MemberRow[], stats: { mappingErrors: number; membersUnmatched: number }) {
  const byCustomer = new Map<string, MemberRow>();
  const byEmail = new Map<string, MemberRow[]>();

  for (const member of membersAll) {
    const email = normEmail(member.email);
    if (member.stripe_customer_id) byCustomer.set(member.stripe_customer_id, member);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), member]);
  }

  const resolve = async (customer: Stripe.Customer): Promise<MemberRow | null> => {
    const email = normEmail(customer.email);
    const emailMatches = email ? byEmail.get(email) ?? [] : [];
    const customerMatch = byCustomer.get(customer.id) ?? null;

    if (emailMatches.length > 1) {
      stats.mappingErrors += 1;
      await logStripeSync("stripe_sync_duplicate_email_match", {
        member_ids: emailMatches.map((m) => m.id),
        stripe_customer_id: customer.id,
        stripe_email: email,
      });
      return customerMatch;
    }

    const emailMatch = emailMatches[0] ?? null;

    if (emailMatch && customerMatch && emailMatch.id !== customerMatch.id) {
      stats.mappingErrors += 1;
      await logStripeSync("stripe_sync_email_customer_mismatch", {
        customer_matched_member_id: customerMatch.id,
        email_matched_member_id: emailMatch.id,
        stripe_customer_id: customer.id,
        stripe_email: email,
      });
    }

    if (!emailMatch && email) {
      stats.mappingErrors += 1;
      await logStripeSync("stripe_sync_member_not_found_by_email", {
        stripe_customer_id: customer.id,
        stripe_email: email,
      });
    }

    const resolved = emailMatch ?? customerMatch;
    if (!resolved) {
      stats.membersUnmatched += 1;
      await logStripeSync("stripe_sync_unmatched_customer", {
        stripe_customer_id: customer.id,
        stripe_email: email,
      });
      return null;
    }

    if (email && resolved.email && normEmail(resolved.email) !== email) {
      stats.mappingErrors += 1;
      await logStripeSync("stripe_sync_exact_email_mismatch", {
        member_email: normEmail(resolved.email),
        member_id: resolved.id,
        stripe_customer_id: customer.id,
        stripe_email: email,
      });
    }

    return resolved;
  };

  const linkCustomer = (customerId: string, member: MemberRow) => {
    byCustomer.set(customerId, member);
  };

  return { resolve, linkCustomer };
}

export const resyncStripeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.userId);
    const stripe = getStripe();

    const { data: membersAll, error: membersErr } = await supabaseAdmin
      .from("members")
      .select("id, email, stripe_customer_id, stripe_subscription_id, contribution_frequency, last_payment_date");
    if (membersErr) throw new Error(membersErr.message);

    const stats = {
      customersScanned: 0,
      paymentsInserted: 0,
      paymentsSkipped: 0,
      membersUpdated: 0,
      membersUnmatched: 0,
      failedEvents: 0,
      mappingErrors: 0,
    };

    const { resolve, linkCustomer } = createMemberResolver((membersAll ?? []) as MemberRow[], stats);
    const lastPaidAtByMember = new Map<string, number>();
    const subStatusByMember = new Map<string, {
      active: boolean;
      customerId: string | null;
      failed: boolean;
      frequency: FreqValue;
      subId: string | null;
    }>();
    const matchedMemberIds = new Set<string>();

    function applyMatch(
      memberId: string,
      customerId: string | null,
      subId: string | null,
      freq: FreqValue,
      active: boolean,
      failed: boolean,
    ) {
      matchedMemberIds.add(memberId);
      const prev = subStatusByMember.get(memberId);
      subStatusByMember.set(memberId, {
        active: active || (prev?.active ?? false),
        customerId: customerId ?? prev?.customerId ?? null,
        failed: failed || (prev?.failed ?? false),
        frequency: freq ?? prev?.frequency ?? "weekly",
        subId: subId ?? prev?.subId ?? null,
      });
    }

    let starting_after: string | undefined;
    while (true) {
      const page = await stripe.customers.list({ limit: 100, starting_after });

      for (const customer of page.data) {
        stats.customersScanned += 1;
        const member = await resolve(customer);

        if (!member) continue;

        if (!member.stripe_customer_id) {
          await supabaseAdmin
            .from("members")
            .update({ stripe_customer_id: customer.id })
            .eq("id", member.id);
          member.stripe_customer_id = customer.id;
          linkCustomer(customer.id, member);
        }

        const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        let memberFreq: FreqValue = member.contribution_frequency ?? "weekly";
        let activeSub = false;
        let subId: string | null = member.stripe_subscription_id ?? null;
        let failed = false;

        for (const sub of subs.data) {
          const item = sub.items.data[0];
          const interval = item?.price?.recurring?.interval ?? null;
          memberFreq = intervalToFrequency(interval);
          subId = sub.id;
          if (sub.status === "active" || sub.status === "trialing") activeSub = true;
          if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
            failed = true;
            stats.failedEvents += 1;
          }
        }

        // Load charges once per customer to enrich invoices with card details.
        const chargesList = await stripe.charges.list({ customer: customer.id, limit: 100 });
        const chargesByInvoice = new Map<string, Stripe.Charge>();
        for (const ch of chargesList.data) {
          if (ch.status !== "succeeded") continue;
          const invId = typeof ch.invoice === "string" ? ch.invoice : ch.invoice?.id ?? null;
          if (invId && !chargesByInvoice.has(invId)) chargesByInvoice.set(invId, ch);
        }

        const invoices = await stripe.invoices.list({ customer: customer.id, limit: 100 });
        for (const inv of invoices.data) {
          const invoiceFrequency = getInvoiceFrequency(inv, memberFreq);
          if (inv.status === "paid" && inv.amount_paid > 0) {
            const externalId = inv.id;
            const paidAtUnix = inv.status_transitions?.paid_at ?? inv.created;
            const date = nyDate(paidAtUnix);
            const amount = (inv.amount_paid ?? 0) / 100;
            const charge = externalId ? chargesByInvoice.get(externalId) : undefined;
            const enrichment = extractEnrichmentFromCharge(charge);

            const existingId = await findExistingStripePayment(member.id, {
              piId: enrichment.stripe_payment_intent_id,
              chargeId: enrichment.stripe_charge_id,
              invoiceId: externalId,
            });

            if (existingId) {
              // Backfill Stripe transaction details on previously imported payments.
              const updatePayload: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(enrichment)) {
                if (v !== null && v !== undefined) updatePayload[k] = v;
              }
              if (Object.keys(updatePayload).length > 0) {
                await supabaseAdmin.from("payments").update(updatePayload).eq("id", existingId);
              }
              stats.paymentsSkipped += 1;
            } else {
              const { data: ins, error: insErr } = await supabaseAdmin
                .from("payments")
                .insert([{
                  amount,
                  base_amount: amount,
                  contribution_type: "pastor_salary",
                  extra_amount: 0,
                  member_id: member.id,
                  notes: `Stripe payment ID: ${externalId} | Event: resync.invoice.paid`,
                  payment_date: date,
                  payment_frequency: invoiceFrequency,
                  payment_method: "stripe",
                  reference_month: null,
                  status: "paid",
                  stripe_subscription_id: subId,
                  ...enrichment,
                }])
                .select("id")
                .single();

              if (insErr) throw new Error(insErr.message);

              await supabaseAdmin.from("payment_contributions").insert({
                amount,
                contribution_type: "pastor_salary",
                destination: null,
                payment_id: ins.id,
              });
              stats.paymentsInserted += 1;
            }

            const currentLast = lastPaidAtByMember.get(member.id) ?? 0;
            if (paidAtUnix && paidAtUnix > currentLast) lastPaidAtByMember.set(member.id, paidAtUnix);
            memberFreq = invoiceFrequency;
          }

          if (
            inv.status === "uncollectible" ||
            inv.status === "void" ||
            (inv.status !== "paid" && inv.status !== "draft" && (inv.amount_remaining ?? 0) > 0 && (inv.attempt_count ?? 0) > 0)
          ) {
            failed = true;
            stats.failedEvents += 1;
          }
        }

        const paymentIntents = await stripe.paymentIntents.list({ customer: customer.id, limit: 100 });
        for (const paymentIntent of paymentIntents.data) {
          if (
            paymentIntent.status === "canceled" ||
            paymentIntent.status === "requires_payment_method"
          ) {
            failed = true;
            stats.failedEvents += 1;
            await logStripeSync("stripe_sync_payment_intent_failed", {
              amount: (paymentIntent.amount ?? 0) / 100,
              member_id: member.id,
              payment_intent_id: paymentIntent.id,
              stripe_customer_id: customer.id,
              stripe_email: normEmail(customer.email),
            });
          }
        }

        applyMatch(member.id, customer.id, subId, memberFreq, activeSub, failed);
      }

      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
      if (!starting_after) break;
    }

    const todayNY = nyDate();
    for (const member of (membersAll ?? []) as MemberRow[]) {
      if (!matchedMemberIds.has(member.id)) continue;

      const info = subStatusByMember.get(member.id);
      const lastUnix = lastPaidAtByMember.get(member.id);
      const lastDate = lastUnix ? nyDate(lastUnix) : (member.last_payment_date ?? null);

      let statusPayment: MemberStatusPayment = "Pending";
      if (info?.failed) {
        statusPayment = "Late";
      } else if (lastUnix || member.last_payment_date) {
        const baseDate = lastUnix ? new Date(lastUnix * 1000) : new Date(`${member.last_payment_date}T12:00:00Z`);
        const daysWindow = info?.frequency === "monthly" ? 30 : 7;
        const ageDays = (Date.now() - baseDate.getTime()) / 86400000;
        statusPayment = ageDays <= daysWindow ? "On Time" : "Late";
      }

      await supabaseAdmin
        .from("members")
        .update({
          contribution_frequency: info?.frequency ?? member.contribution_frequency ?? "weekly",
          last_payment_date: lastDate,
          payment_type: "card",
          status_payment: statusPayment,
          stripe_customer_id: info?.customerId ?? member.stripe_customer_id,
          stripe_subscription_id: info?.subId ?? member.stripe_subscription_id,
          subscription_active: !!info?.active,
        })
        .eq("id", member.id);
      stats.membersUpdated += 1;
    }

    return { ok: true, stats, todayNY };
  });
