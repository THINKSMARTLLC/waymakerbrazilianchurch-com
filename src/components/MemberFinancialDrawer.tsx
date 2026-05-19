import { useEffect, useState } from "react";
import { Download, Mail, Phone, CreditCard, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD, toTitleCase } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/components/RecordPaymentModal";
import { exportMemberHistoryCSV, exportMemberHistoryXLSX } from "@/lib/dataExportImport";
import { getMemberFinancialSummaries, type MemberFinancialSummary, FIN_STATUS_LABEL, finStatusClasses } from "@/lib/financialLedger";
import type { Database } from "@/integrations/supabase/types";

type Member = Database["public"]["Tables"]["members"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

interface Props {
  memberId: string | null;
  onClose: () => void;
}

export function MemberFinancialDrawer({ memberId, onClose }: Props) {
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<MemberFinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    Promise.all([
      supabase.from("members").select("*").eq("id", memberId).single(),
      supabase.from("payments").select("*").eq("member_id", memberId).order("payment_date", { ascending: false }),
      getMemberFinancialSummaries([memberId]),
    ])
      .then(([m, p, s]) => {
        setMember((m.data as Member) ?? null);
        setPayments((p.data as Payment[]) ?? []);
        setSummary(s.get(memberId) ?? null);
      })
      .finally(() => setLoading(false));
  }, [memberId]);

  const open = !!memberId;
  const failedCount = payments.filter((p) => p.status === "past_due").length;
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">{member ? toTitleCase(member.name) : "Member details"}</SheetTitle>
            <div className="flex items-center gap-1">
              {member && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportMemberHistoryCSV(member.id, member.name)}>CSV (.csv)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportMemberHistoryXLSX(member.id, member.name)}>Excel (.xlsx)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SheetHeader>

        {loading || !member ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Contact */}
            <div className="rounded-lg border border-border p-3 text-sm space-y-1.5">
              {member.email && (
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{member.email}</div>
              )}
              {member.phone && (
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{member.phone}</div>
              )}
              {member.stripe_customer_id && (
                <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" />{member.stripe_customer_id}</div>
              )}
            </div>

            {/* Financial summary */}
            {summary && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${finStatusClasses(summary.status).badge}`}>
                    {FIN_STATUS_LABEL[summary.status]}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
                  <p className={`mt-1 text-sm font-semibold tabular-nums ${summary.balance < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {formatUSD(summary.balance)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total paid</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{formatUSD(summary.totalPaid)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Overdue weeks</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{summary.weeksOverdue}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border p-2">
                <p className="text-muted-foreground">Payments</p>
                <p className="text-base font-semibold">{paidCount}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-muted-foreground">Failed attempts</p>
                <p className="text-base font-semibold text-rose-700 dark:text-rose-400">{failedCount}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-muted-foreground">Total received</p>
                <p className="text-base font-semibold">{formatUSD(totalPaid)}</p>
              </div>
            </div>

            {/* History */}
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment history</h4>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Method</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No payments recorded.</td></tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 tabular-nums">{new Date(p.payment_date).toLocaleDateString("en-US")}</td>
                          <td className="px-3 py-2">{PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.status === "paid" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : p.status === "past_due" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                : "bg-muted text-muted-foreground"
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatUSD(p.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
