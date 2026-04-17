export type MemberPaymentStatus = "on_time" | "late" | "no_payment" | "active";
export type ContributionFrequency = "weekly" | "monthly" | "one_time" | "flexible";

export function computeMemberStatus(
  lastPaymentDate: string | null | undefined,
  frequency: ContributionFrequency = "weekly"
): MemberPaymentStatus {
  // Flexible members are always Active
  if (frequency === "flexible") return "active";

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
