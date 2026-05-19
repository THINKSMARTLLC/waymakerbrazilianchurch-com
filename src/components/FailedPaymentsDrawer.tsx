import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatUSD } from "@/lib/format";
import { getFailedMembersDetail, type FailedMemberRow } from "@/lib/financialLedger";

interface Props {
  open: boolean;
  activeMemberIds: string[];
  onClose: () => void;
}

export function FailedPaymentsDrawer({ open, activeMemberIds, onClose }: Props) {
  const [rows, setRows] = useState<FailedMemberRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getFailedMembersDetail(activeMemberIds)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [open, activeMemberIds]);

  const totalAttempts = rows.reduce((s, r) => s + r.stripeAttempts, 0);
  const totalWeeks = rows.reduce((s, r) => s + r.weeksOverdue, 0);
  const totalDue = rows.reduce((s, r) => s + r.amountDue, 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Failed Payments — detailed breakdown
            </SheetTitle>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stripe retries are <strong>not</strong> debt. The "Amount Due" column reflects the member's real
            overdue balance from the financial ledger.
          </p>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center text-xs">
          <div>
            <p className="text-muted-foreground">Members affected</p>
            <p className="text-lg font-semibold">{rows.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Stripe attempts</p>
            <p className="text-lg font-semibold">{totalAttempts}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Real amount due</p>
            <p className="text-lg font-semibold text-rose-700 dark:text-rose-400">{formatUSD(totalDue)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 text-right font-medium">Stripe attempts</th>
                <th className="px-3 py-2 text-right font-medium">Weeks overdue</th>
                <th className="px-3 py-2 text-right font-medium">Amount due</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No failed payments. 🎉
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.stripeAttempts}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.weeksOverdue}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                      {formatUSD(r.amountDue)}
                    </td>
                  </tr>
                ))
              )}
              {!loading && rows.length > 0 && (
                <tr className="bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totalAttempts}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totalWeeks}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                    {formatUSD(totalDue)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
