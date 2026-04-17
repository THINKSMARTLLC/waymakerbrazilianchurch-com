export type MemberPaymentStatus = "on_time" | "late" | "no_payment";

export function computeMemberStatus(lastPaymentDate: string | null | undefined): MemberPaymentStatus {
  if (!lastPaymentDate) return "no_payment";
  const last = new Date(lastPaymentDate);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return last >= sevenDaysAgo ? "on_time" : "late";
}

export const STATUS_LABEL: Record<MemberPaymentStatus, string> = {
  on_time: "On Time",
  late: "Late",
  no_payment: "No Payment Yet",
};

export function statusBadgeClasses(status: MemberPaymentStatus): string {
  if (status === "on_time") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "late") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function statusDotClasses(status: MemberPaymentStatus): string {
  if (status === "on_time") return "bg-emerald-500";
  if (status === "late") return "bg-destructive";
  return "bg-muted-foreground";
}
