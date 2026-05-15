// Centralized financial calculations — single source of truth.
// All revenue numbers across the app (dashboard card, charts, reports, exports)
// MUST go through these helpers so values stay consistent.
//
// Rules:
//  - Only payments with status = 'paid' count as revenue.
//  - Statuses 'failed', 'refunded', 'pending', 'cancelled', 'late', 'partial'
//    are excluded from revenue totals.
//  - Includes both Stripe and manual payments (no source filter).
//  - The reference date is `payment_date` (the DB's paid-on date column).
//    It is a "YYYY-MM-DD" pure date — parsed locally to avoid TZ drift.

import { supabase } from "@/integrations/supabase/client";

export const REVENUE_STATUS = "paid" as const;

export type PaymentStatus =
  | "paid"
  | "pending"
  | "late"
  | "failed"
  | "refunded"
  | "cancelled"
  | "partial";

interface PaidRow {
  amount: number | string;
  payment_date: string; // YYYY-MM-DD
}

/** Parse a "YYYY-MM-DD" string into {year, month} with no TZ shift. month is 1-12. */
function parseYM(dateStr: string): { y: number; m: number } | null {
  const match = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Sum of paid revenue for a given month/year (1-12).
 * Reads `payments` filtered by `status = 'paid'` within the month window.
 */
export async function getMonthlyRevenue(month: number, year: number): Promise<number> {
  const start = `${year}-${pad(month)}-01`;
  // first day of next month (exclusive)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${nextYear}-${pad(nextMonth)}-01`;

  const { data, error } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .eq("status", REVENUE_STATUS)
    .gte("payment_date", start)
    .lt("payment_date", endExclusive);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getMonthlyRevenue error", error);
    return 0;
  }

  const total = (data ?? []).reduce((sum, p: PaidRow) => sum + Number(p.amount ?? 0), 0);
  // eslint-disable-next-line no-console
  console.log("monthlyRevenue", { month, year, total, count: data?.length ?? 0 });
  return total;
}

/**
 * Returns the last `months` months of revenue (oldest → newest), bucketed by
 * payment_date (parsed without TZ shift). Same status/source rules as
 * getMonthlyRevenue so the chart matches the dashboard exactly.
 */
export async function getMonthlyRevenueSeries(months = 12): Promise<
  Array<{ year: number; month: number; total: number }>
> {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth() + 1; // 1-12
  // window start = (months-1) months before current month
  const windowStart = new Date(startYear, startMonth - 1 - (months - 1), 1);
  const startStr = `${windowStart.getFullYear()}-${pad(windowStart.getMonth() + 1)}-01`;

  const { data, error } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .eq("status", REVENUE_STATUS)
    .gte("payment_date", startStr);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getMonthlyRevenueSeries error", error);
    return [];
  }

  const buckets: Array<{ year: number; month: number; total: number }> = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth() + 1, total: 0 });
  }

  for (const p of (data ?? []) as PaidRow[]) {
    const ym = parseYM(p.payment_date);
    if (!ym) continue;
    const idx =
      (ym.y - windowStart.getFullYear()) * 12 + (ym.m - 1 - windowStart.getMonth());
    if (idx >= 0 && idx < months) {
      buckets[idx].total += Number(p.amount ?? 0);
    }
  }

  // eslint-disable-next-line no-console
  console.log("monthlyRevenue", { series: buckets });
  return buckets;
}
