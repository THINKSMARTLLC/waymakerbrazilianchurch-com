import { useEffect, useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { formatLocalDateOnly } from "@/lib/datetime";
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
  const { t } = useTranslation();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRows = async () => {
    // Show payments where this member is the legacy member, payer, or beneficiary
    const { data } = await supabase
      .from("payments")
      .select("*")
      .or(`member_id.eq.${memberId},payer_member_id.eq.${memberId},beneficiary_member_id.eq.${memberId}`)
      .order("payment_date", { ascending: false });
    const list = (data as PaymentRow[]) || [];
    setRows(list);

    const ids = new Set<string>();
    for (const r of list) {
      if (r.payer_member_id) ids.add(r.payer_member_id);
      if (r.beneficiary_member_id) ids.add(r.beneficiary_member_id);
      if (r.member_id) ids.add(r.member_id);
    }
    if (ids.size > 0) {
      const { data: mems } = await supabase.from("members").select("id, name").in("id", Array.from(ids));
      setMemberNames(new Map((mems || []).map((m) => [m.id, m.name])));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [memberId]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("contributionsModal.confirmDelete"))) return;
    setDeletingId(id);
    const { error } = await supabase.from("payments").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(t("contributionsModal.deleteFailed", { message: error.message }));
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
            <h2 className="font-display text-lg font-semibold text-foreground">{t("contributionsModal.title")}</h2>
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
            <div className="py-12 text-center text-sm text-muted-foreground">{t("contributionsModal.empty")}</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">{t("contributionsModal.date")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("contributionsModal.amount")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("payerBeneficiary.paidBy")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("payerBeneficiary.benefiting")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("contributionsModal.method")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("contributionsModal.type")}</th>
                  <th className="table-header px-5 py-3 text-left">{t("contributionsModal.notes")}</th>
                  <th className="table-header px-5 py-3 text-right">{t("contributionsModal.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const payerId = r.payer_member_id ?? r.member_id;
                  const benId = r.beneficiary_member_id ?? r.member_id;
                  const payerName = memberNames.get(payerId) ?? "—";
                  const benName = memberNames.get(benId) ?? "—";
                  const isFamily = r.payer_member_id && r.beneficiary_member_id && r.payer_member_id !== r.beneficiary_member_id;
                  return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-sm text-foreground">{formatLocalDateOnly(r.payment_date)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{formatUSD(r.amount)}</td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {payerName}
                      {isFamily && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {t("payerBeneficiary.familySupport")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">{benName}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{PAYMENT_METHOD_LABEL[r.payment_method] ?? r.payment_method}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{CONTRIBUTION_TYPE_LABEL[r.contribution_type] ?? r.contribution_type}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{r.notes || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title={t("contributionsModal.editPayment")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                          title={t("contributionsModal.deletePayment")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">{t("contributionsModal.paymentCount", { count: rows.length })}</span>
          <span className="font-display text-base font-semibold text-foreground">{t("contributionsModal.total", { amount: formatUSD(total) })}</span>
        </div>
      </div>

      {editing && (
        <EditPaymentModal payment={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
