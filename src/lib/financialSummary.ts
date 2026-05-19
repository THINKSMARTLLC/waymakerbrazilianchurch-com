// SINGLE SOURCE OF TRUTH for financial summaries.
// Dashboard, Reports, and Members all consume this so the numbers
// for the same period are identical everywhere.
//
// Rules (NEVER deviate):
//   - Only `status = 'paid'` payments count.
//   - All payment methods count: stripe, card, cash, zelle, ach, manual, check.
//   - Period is filtered by `payment_date` (YYYY-MM-DD, no TZ shift).
//   - "This month" = [first day of current month, first day of next month).
//   - Deduplication: rows with the same `stripe_payment_intent_id`
//     (or same `stripe_charge_id`) are counted only once. Cash/manual rows
//     never collapse (no shared key).

import { supabase } from "@/integrations/supabase/client";

export interface FinancialSummary {
  total: number;
  cardTotal: number;   // stripe + card
  cashTotal: number;   // cash + zelle + ach + check + manual (everything not card)
  paidMemberIds: Set<string>;
  paidMemberCount: number;
  paymentCount: number;
}

interface Row {
  id: string;
  amount: number | string;
  member_id: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
}

const PAGE = 1000;

function pad(n: number) { return String(n).padStart(2, "0"); }

export function thisMonthRange(now = new Date()): { start: string; endExclusive: string } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = `${y}-${pad(m)}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const endExclusive = `${ny}-${pad(nm)}-01`;
  return { start, endExclusive };
}

/**
 * Canonical financial summary for a date range.
 * @param start YYYY-MM-DD inclusive
 * @param endExclusive YYYY-MM-DD exclusive (use null for open-ended)
 */
export async function getFinancialSummary(
  start: string | null,
  endExclusive: string | null,
): Promise<FinancialSummary> {
  const all: Row[] = [];
  let from = 0;
  // Page through to bypass the 1000-row default cap.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from("payments")
      .select("id, amount, member_id, payment_method, stripe_payment_intent_id, stripe_charge_id")
      .eq("status", "paid")
      .order("payment_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (start) q = q.gte("payment_date", start);
    if (endExclusive) q = q.lt("payment_date", endExclusive);
    const { data, error } = await q;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("getFinancialSummary error", error);
      break;
    }
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const seenIntent = new Set<string>();
  const seenCharge = new Set<string>();
  const paidMemberIds = new Set<string>();
  let total = 0;
  let cardTotal = 0;
  let cashTotal = 0;
  let paymentCount = 0;

  for (const r of all) {
    // Dedup by Stripe identifiers (defense in depth — DB indexes also enforce this).
    if (r.stripe_payment_intent_id) {
      if (seenIntent.has(r.stripe_payment_intent_id)) continue;
      seenIntent.add(r.stripe_payment_intent_id);
    }
    if (r.stripe_charge_id) {
      if (seenCharge.has(r.stripe_charge_id)) continue;
      seenCharge.add(r.stripe_charge_id);
    }

    const amount = Number(r.amount ?? 0);
    total += amount;
    paymentCount += 1;
    paidMemberIds.add(r.member_id);

    const method = (r.payment_method ?? "").toLowerCase();
    if (method === "stripe" || method === "card") cardTotal += amount;
    else cashTotal += amount;
  }

  // eslint-disable-next-line no-console
  console.log("financialSummary", { start, endExclusive, total, cardTotal, cashTotal, paymentCount, paidMembers: paidMemberIds.size });

  return {
    total,
    cardTotal,
    cashTotal,
    paidMemberIds,
    paidMemberCount: paidMemberIds.size,
    paymentCount,
  };
}

/** Convenience: this calendar month, today inclusive. */
export async function getThisMonthSummary(): Promise<FinancialSummary> {
  const { start, endExclusive } = thisMonthRange();
  return getFinancialSummary(start, endExclusive);
}
