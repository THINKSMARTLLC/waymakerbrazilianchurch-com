// Centralized read helpers for the member_financial_ledger table.
// The ledger is the single source of truth for what a member owes —
// it is independent of Stripe retries / payment attempts.
//
// One row = one member × one week. Status transitions are driven by triggers
// on `payments` (status='paid' → apply to oldest unpaid weeks).

import { supabase } from "@/integrations/supabase/client";

export type LedgerStatus = "paid" | "partial" | "pending" | "overdue" | "failed";

export interface LedgerRow {
  id: string;
  member_id: string;
  week_reference: string; // YYYY-MM-DD (monday)
  amount_due: number;
  amount_paid: number;
  balance: number;
  payment_status: LedgerStatus;
  stripe_payment_intent: string | null;
}

export type FinancialStatus =
  | "paid"      // balance >= 0
  | "overdue"   // 1-2 weeks behind
  | "late"      // 3-5 weeks behind
  | "critical"  // 6+ weeks behind
  | "unpaid";   // never paid anything but has weeks accumulated

export interface MemberFinancialSummary {
  memberId: string;
  weeklyDue: number;       // standard weekly amount (from most recent ledger row)
  totalDue: number;        // sum(amount_due)
  totalPaid: number;       // sum(amount_paid)
  balance: number;         // totalPaid - totalDue (negative = debt)
  weeksOverdue: number;    // count of rows with balance < 0
  failedWeeks: number;     // count of rows with status='failed'
  status: FinancialStatus;
}

export function classifyFinancial(s: {
  totalDue: number;
  totalPaid: number;
  weeksOverdue: number;
}): FinancialStatus {
  if (s.totalPaid === 0 && s.totalDue > 0) return "unpaid";
  const balance = s.totalPaid - s.totalDue;
  if (balance >= 0) return "paid";
  if (s.weeksOverdue <= 2) return "overdue";
  if (s.weeksOverdue <= 5) return "late";
  return "critical";
}

const PAGE_SIZE = 1000;

/** Fetch every ledger row (handles >1k via pagination). */
async function fetchAllLedger(memberIds?: string[]): Promise<LedgerRow[]> {
  const out: LedgerRow[] = [];
  let from = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = supabase.from("member_financial_ledger" as any);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = tbl
      .select("id,member_id,week_reference,amount_due,amount_paid,balance,payment_status,stripe_payment_intent")
      .order("week_reference", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (memberIds && memberIds.length > 0) q = q.in("member_id", memberIds);
    const { data, error } = await q;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("fetchAllLedger", error);
      break;
    }
    const rows = (data ?? []) as unknown as LedgerRow[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

/** Build per-member summaries from the full ledger. */
export async function getMemberFinancialSummaries(
  memberIds?: string[],
): Promise<Map<string, MemberFinancialSummary>> {
  const rows = await fetchAllLedger(memberIds);
  const byMember = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const list = byMember.get(r.member_id) ?? [];
    list.push(r);
    byMember.set(r.member_id, list);
  }
  const out = new Map<string, MemberFinancialSummary>();
  for (const [memberId, list] of byMember) {
    list.sort((a, b) => a.week_reference.localeCompare(b.week_reference));
    let totalDue = 0;
    let totalPaid = 0;
    let weeksOverdue = 0;
    let failedWeeks = 0;
    for (const r of list) {
      totalDue += Number(r.amount_due);
      totalPaid += Number(r.amount_paid);
      if (Number(r.balance) < 0) weeksOverdue += 1;
      if (r.payment_status === "failed") failedWeeks += 1;
    }
    const weeklyDue = Number(list[list.length - 1]?.amount_due ?? 20);
    out.set(memberId, {
      memberId,
      weeklyDue,
      totalDue,
      totalPaid,
      balance: totalPaid - totalDue,
      weeksOverdue,
      failedWeeks,
      status: classifyFinancial({ totalDue, totalPaid, weeksOverdue }),
    });
  }
  return out;
}

export interface FinancialCardStats {
  paid: { members: number; amount: number };
  pastDue: { members: number; weeks: number; amount: number };
  failed: { members: number; stripeAttempts: number; weeks: number; amount: number };
  unpaid: { members: number; weeks: number; amount: number };
}

/** Aggregate stats for the dashboard cards. */
export async function getFinancialCardStats(activeMemberIds: string[]): Promise<FinancialCardStats> {
  const summaries = await getMemberFinancialSummaries(activeMemberIds);

  // Stripe attempts: count of failed payment rows (raw Stripe events, NOT debt)
  let stripeAttempts = 0;
  if (activeMemberIds.length > 0) {
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .in("member_id", activeMemberIds);
    stripeAttempts = count ?? 0;
  }

  const stats: FinancialCardStats = {
    paid: { members: 0, amount: 0 },
    pastDue: { members: 0, weeks: 0, amount: 0 },
    failed: { members: 0, stripeAttempts, weeks: 0, amount: 0 },
    unpaid: { members: 0, weeks: 0, amount: 0 },
  };

  for (const s of summaries.values()) {
    if (s.status === "paid") {
      stats.paid.members += 1;
      stats.paid.amount += s.totalPaid;
    } else if (s.status === "unpaid") {
      stats.unpaid.members += 1;
      stats.unpaid.weeks += s.weeksOverdue;
      stats.unpaid.amount += Math.max(-s.balance, 0);
    } else {
      // overdue / late / critical
      stats.pastDue.members += 1;
      stats.pastDue.weeks += s.weeksOverdue;
      stats.pastDue.amount += Math.max(-s.balance, 0);
    }
    if (s.failedWeeks > 0) {
      stats.failed.members += 1;
      stats.failed.weeks += s.failedWeeks;
      stats.failed.amount += Math.max(-s.balance, 0);
    }
  }
  return stats;
}

export interface FailedMemberRow {
  memberId: string;
  name: string;
  stripeAttempts: number;
  weeksOverdue: number;
  amountDue: number;
}

/** Detailed breakdown of members affected by failed payments. */
export async function getFailedMembersDetail(activeMemberIds: string[]): Promise<FailedMemberRow[]> {
  if (activeMemberIds.length === 0) return [];
  const summaries = await getMemberFinancialSummaries(activeMemberIds);

  // Count Stripe attempts per member (failed payment rows)
  const { data: failedPayments } = await supabase
    .from("payments")
    .select("member_id")
    .eq("status", "failed")
    .in("member_id", activeMemberIds);

  const attemptsByMember = new Map<string, number>();
  for (const p of failedPayments ?? []) {
    attemptsByMember.set(p.member_id, (attemptsByMember.get(p.member_id) ?? 0) + 1);
  }

  // Affected = anyone with weeks overdue OR a stripe failure
  const affectedIds = new Set<string>([
    ...attemptsByMember.keys(),
    ...Array.from(summaries.values()).filter((s) => s.failedWeeks > 0).map((s) => s.memberId),
  ]);
  if (affectedIds.size === 0) return [];

  const { data: members } = await supabase
    .from("members")
    .select("id,name")
    .in("id", Array.from(affectedIds));

  const out: FailedMemberRow[] = [];
  for (const m of members ?? []) {
    const s = summaries.get(m.id);
    out.push({
      memberId: m.id,
      name: m.name,
      stripeAttempts: attemptsByMember.get(m.id) ?? 0,
      weeksOverdue: s?.weeksOverdue ?? 0,
      amountDue: s ? Math.max(-s.balance, 0) : 0,
    });
  }
  out.sort((a, b) => b.amountDue - a.amountDue);
  return out;
}

export const FIN_STATUS_LABEL: Record<FinancialStatus, string> = {
  paid: "Paid",
  overdue: "Overdue",
  late: "Late",
  critical: "Critical",
  unpaid: "Unpaid",
};

export function finStatusClasses(s: FinancialStatus): { badge: string; text: string } {
  switch (s) {
    case "paid":
      return { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", text: "text-emerald-700 dark:text-emerald-400" };
    case "overdue":
      return { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400", text: "text-amber-700 dark:text-amber-400" };
    case "late":
      return { badge: "bg-red-500/10 text-red-700 dark:text-red-400", text: "text-red-700 dark:text-red-400" };
    case "critical":
      return { badge: "bg-red-900/15 text-red-900 dark:text-red-300", text: "text-red-900 dark:text-red-300" };
    case "unpaid":
      return { badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300", text: "text-slate-700 dark:text-slate-300" };
  }
}
