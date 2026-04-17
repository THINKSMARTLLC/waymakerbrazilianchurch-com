import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { CONTRIBUTION_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "./RecordPaymentModal";

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  contribution_type: string;
  notes: string | null;
  recorded_by: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
}

export function ContributionsModal({ memberId, memberName, onClose }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_date, payment_method, contribution_type, notes, recorded_by")
        .eq("member_id", memberId)
        .order("payment_date", { ascending: false });
      setRows((data as PaymentRow[]) || []);
      setLoading(false);
    })();
  }, [memberId]);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Contributions</h2>
            <p className="text-sm text-muted-foreground">{memberName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No contributions recorded yet.</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">Date</th>
                  <th className="table-header px-5 py-3 text-left">Amount</th>
                  <th className="table-header px-5 py-3 text-left">Method</th>
                  <th className="table-header px-5 py-3 text-left">Type</th>
                  <th className="table-header px-5 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-sm text-foreground">{new Date(r.payment_date).toLocaleDateString("en-US")}</td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{formatUSD(r.amount)}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{PAYMENT_METHOD_LABEL[r.payment_method] ?? r.payment_method}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{CONTRIBUTION_TYPE_LABEL[r.contribution_type] ?? r.contribution_type}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">{rows.length} payment{rows.length === 1 ? "" : "s"}</span>
          <span className="font-display text-base font-semibold text-foreground">Total: {formatUSD(total)}</span>
        </div>
      </div>
    </div>
  );
}
