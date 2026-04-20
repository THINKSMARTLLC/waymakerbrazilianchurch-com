export type MemberPaymentStatus = "on_time" | "late" | "no_payment" | "active";
export type ContributionFrequency = "weekly" | "monthly" | "one_time" | "flexible";

export function computeMemberStatus(
  lastPaymentDate: string | null | undefined,
  frequency: ContributionFrequency = "weekly",
  monthsCovered?: Set<string> | string[] | null
): MemberPaymentStatus {
  // Flexible members are always Active
  if (frequency === "flexible") return "active";

  // If a monthly payment covers the current month, member is on time
  // regardless of the last weekly payment date.
  if (monthsCovered) {
    const set = monthsCovered instanceof Set ? monthsCovered : new Set(monthsCovered);
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (set.has(currentKey)) return "on_time";
  }

  if (!lastPaymentDate) return "no_payment";

  // One-time payers are never Late once they've paid
  if (frequency === "one_time") return "on_time";

  const last = new Date(lastPaymentDate);
  const now = new Date();
  const daysWindow = frequency === "monthly" ? 30 : 7;
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - daysWindow);

  return last >= cutoff ? "on_time" : "late";
}

/** Build a Set of "YYYY-MM" keys from monthly payments for a member. */
export function buildMonthsCovered(
  payments: Array<{ payment_frequency?: string | null; reference_month?: string | null }>
): Set<string> {
  const set = new Set<string>();
  for (const p of payments) {
    if (p.payment_frequency === "monthly" && p.reference_month) {
      const d = new Date(p.reference_month);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      set.add(key);
    }
  }
  return set;
}

export const STATUS_LABEL: Record<MemberPaymentStatus, string> = {
  on_time: "On Time",
  late: "Late",
  no_payment: "No Payment Yet",
  active: "Active",
};

export const FREQUENCY_LABEL: Record<ContributionFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
  flexible: "Flexible",
};

export function statusBadgeClasses(status: MemberPaymentStatus): string {
  if (status === "on_time" || status === "active") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "late") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function statusDotClasses(status: MemberPaymentStatus): string {
  if (status === "on_time" || status === "active") return "bg-emerald-500";
  if (status === "late") return "bg-destructive";
  return "bg-muted-foreground";
}
