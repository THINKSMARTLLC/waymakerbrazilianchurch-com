import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

type FreqValue = "weekly" | "monthly" | "one_time" | "flexible";

function intervalToFrequency(interval?: string | null): FreqValue {
  if (interval === "week") return "weekly";
  if (interval === "month") return "monthly";
  if (interval === "year") return "monthly";
  if (interval === "day") return "weekly";
  return "weekly";
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

export const resyncStripeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.userId);
    const stripe = getStripe();

    // Load all members with email or stripe_customer_id
    const { data: membersAll, error: membersErr } = await supabaseAdmin
      .from("members")
      .select("id, email, stripe_customer_id, stripe_subscription_id, contribution_frequency");
    if (membersErr) throw new Error(membersErr.message);

    const byEmail = new Map<string, typeof membersAll[number]>();
    const byCustomer = new Map<string, typeof membersAll[number]>();
    for (const m of membersAll ?? []) {
      const e = normEmail(m.email);
      if (e) byEmail.set(e, m);
      if (m.stripe_customer_id) byCustomer.set(m.stripe_customer_id, m);
    }

    const stats = {
      customersScanned: 0,
      paymentsInserted: 0,
      paymentsSkipped: 0,
      membersUpdated: 0,
      membersUnmatched: 0,
      failedEvents: 0,
    };

    // Track last payment per member, frequency, status
    const lastPaidAtByMember = new Map<string, number>(); // unix
    const subStatusByMember = new Map<string, { active: boolean; frequency: FreqValue; subId: string | null; customerId: string | null; failed: boolean }>();
    const matchedMemberIds = new Set<string>();

    function applyMatch(memberId: string, customerId: string | null, subId: string | null, freq: FreqValue, active: boolean, failed: boolean) {
      matchedMemberIds.add(memberId);
      const prev = subStatusByMember.get(memberId);
      subStatusByMember.set(memberId, {
        active: active || (prev?.active ?? false),
        frequency: freq ?? prev?.frequency ?? "weekly",
        subId: subId ?? prev?.subId ?? null,
        customerId: customerId ?? prev?.customerId ?? null,
        failed: failed || (prev?.failed ?? false),
      });
    }

    // Iterate all customers
    let starting_after: string | undefined;
    while (true) {
      const page = await stripe.customers.list({ limit: 100, starting_after });
      for (const customer of page.data) {
        stats.customersScanned += 1;
        const email = normEmail(customer.email);
        const member =
          (customer.id ? byCustomer.get(customer.id) : undefined) ??
          (email ? byEmail.get(email) : undefined);

        if (!member) {
          stats.membersUnmatched += 1;
          continue;
        }

        // Persist customer id link if missing
        if (!member.stripe_customer_id) {
          await supabaseAdmin
            .from("members")
            .update({ stripe_customer_id: customer.id })
            .eq("id", member.id);
          member.stripe_customer_id = customer.id;
          byCustomer.set(customer.id, member);
        }

        // Subscriptions
        const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        let memberFreq: FreqValue = "weekly";
        let activeSub = false;
        let subId: string | null = null;
        let failed = false;
        for (const sub of subs.data) {
          const item = sub.items.data[0];
          const interval = item?.price?.recurring?.interval ?? null;
          memberFreq = intervalToFrequency(interval);
          subId = sub.id;
          if (sub.status === "active" || sub.status === "trialing") activeSub = true;
          if (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete_expired") failed = true;
        }

        // Invoices (paid + failed)
        const invoices = await stripe.invoices.list({ customer: customer.id, limit: 100 });
        for (const inv of invoices.data) {
          if (inv.status === "paid" && inv.amount_paid > 0) {
            const externalId = inv.id;
            if (!externalId) continue;
            const paidAtUnix = inv.status_transitions?.paid_at ?? inv.created;
            const date = nyDate(paidAtUnix);
            const amount = (inv.amount_paid ?? 0) / 100;
            const { data: existing } = await supabaseAdmin
              .from("payments")
              .select("id")
              .eq("member_id", member.id)
              .eq("payment_method", "stripe")
              .ilike("notes", `%${externalId}%`)
              .limit(1);
            if ((existing?.length ?? 0) > 0) {
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
                  payment_frequency: memberFreq,
                  payment_method: "stripe",
                  reference_month: null,
                  status: "paid",
                  stripe_subscription_id: subId,
                }])
                .select("id")
                .single();
              if (!insErr && ins) {
                await supabaseAdmin.from("payment_contributions").insert({
                  amount,
                  contribution_type: "pastor_salary",
                  destination: null,
                  payment_id: ins.id,
                });
                stats.paymentsInserted += 1;
              }
            }
            const cur = lastPaidAtByMember.get(member.id) ?? 0;
            if (paidAtUnix && paidAtUnix > cur) lastPaidAtByMember.set(member.id, paidAtUnix);
          }
          if (inv.status === "open" || (inv as any).attempted) {
            // detect failure
            if ((inv as any).attempt_count && (inv as any).status !== "paid") {
              // not necessarily failed; only mark when amount_remaining > 0 and status not draft/paid
              if (inv.status !== "paid" && inv.status !== "draft" && (inv.amount_remaining ?? 0) > 0) {
                failed = true;
                stats.failedEvents += 1;
              }
            }
          }
        }

        applyMatch(member.id, customer.id, subId, memberFreq, activeSub, failed);
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
      if (!starting_after) break;
    }

    // Apply member status updates
    const todayNY = nyDate();
    for (const memberId of matchedMemberIds) {
      const info = subStatusByMember.get(memberId);
      const lastUnix = lastPaidAtByMember.get(memberId);
      const lastDate = lastUnix ? nyDate(lastUnix) : null;

      let statusPayment: "On Time" | "Late" | "Pending" = "Pending";
      if (info?.failed) {
        statusPayment = "Late";
      } else if (lastUnix) {
        const daysWindow = info?.frequency === "monthly" ? 30 : 7;
        const ageDays = (Date.now() - lastUnix * 1000) / 86400000;
        statusPayment = ageDays <= daysWindow ? "On Time" : "Late";
      }

      const update: Record<string, unknown> = {
        status_payment: statusPayment,
        last_payment_date: lastDate,
        subscription_active: !!info?.active,
        stripe_customer_id: info?.customerId ?? null,
        stripe_subscription_id: info?.subId ?? null,
        contribution_frequency: info?.frequency ?? "weekly",
        payment_type: "card",
      };
      await supabaseAdmin.from("members").update(update).eq("id", memberId);
      stats.membersUpdated += 1;
    }

    return { ok: true, stats, todayNY };
  });
