import { useEffect, useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { CONTRIBUTION_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "./RecordPaymentModal";
import { EditPaymentModal } from "./EditPaymentModal";
import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onChanged?: () => void;
}

export function ContributionsModal({ memberId, memberName, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("member_id", memberId)
      .order("payment_date", { ascending: false });
    setRows((data as PaymentRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [memberId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("payments").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    await fetchRows();
    onChanged?.();
  };

  const handleSaved = async () => {
    await fetchRows();
    onChanged?.();
  };

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-3xl max-h-[85vh] flex flex-col">
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
                  <th className="table-header px-5 py-3 text-right">Actions</th>
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
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit Payment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                          title="Delete Payment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
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

      {editing && (
        <EditPaymentModal payment={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
