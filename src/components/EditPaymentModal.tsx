import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

const CONTRIBUTION_TYPES = [
  { value: "tithe", labelKey: "tithe" },
  { value: "offering", labelKey: "offering" },
  { value: "pastor_salary", labelKey: "pastorSalary" },
  { value: "special_donation", labelKey: "specialDonation" },
  { value: "event_contribution", labelKey: "eventContribution" },
  { value: "other", labelKey: "other" },
] as const;

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cash" },
  { value: "zelle", labelKey: "zelle" },
  { value: "venmo", labelKey: "venmo" },
  { value: "card", labelKey: "card" },
  { value: "paypal", labelKey: "paypal" },
  { value: "other", labelKey: "other" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

interface Props {
  payment: Payment;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPaymentModal({ payment, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    if (!isFinite(amount) || amount <= 0) {
      setError(t("editPaymentModal.invalidAmount"));
      setSaving(false);
      return;
    }

    const extra = Number(form.get("extra_amount")) || 0;
    const base = Math.max(amount - extra, 0);

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        amount,
        base_amount: base,
        extra_amount: extra,
        payment_date: form.get("payment_date") as string,
        payment_method: form.get("payment_method") as PaymentMethod,
        contribution_type: form.get("contribution_type") as "tithe",
        notes: (form.get("notes") as string) || null,
      } as never)
      .eq("id", payment.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
    } else {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-foreground mb-5">{t("editPaymentModal.title")}</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.date")}</label>
              <input name="payment_date" type="date" required defaultValue={payment.payment_date} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.amount")}</label>
              <input name="amount" type="number" step="0.01" min="0.01" required defaultValue={payment.amount} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.extraAmount")}</label>
            <input name="extra_amount" type="number" step="0.01" min="0" defaultValue={Number((payment as Payment & { extra_amount?: number }).extra_amount) || 0} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">{t("editPaymentModal.extraHint")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.paymentMethod")}</label>
            <select name="payment_method" defaultValue={payment.payment_method === "stripe" ? "card" : payment.payment_method} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{t(`paymentMethods.${m.labelKey}`, { defaultValue: m.value })}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.contributionType")}</label>
            <select name="contribution_type" defaultValue={payment.contribution_type} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {CONTRIBUTION_TYPES.map((tp) => (
                <option key={tp.value} value={tp.value}>{t(`contributionTypes.${tp.labelKey}`, { defaultValue: tp.value })}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("editPaymentModal.notes")}</label>
            <textarea name="notes" rows={2} defaultValue={payment.notes ?? ""} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder={t("editPaymentModal.notesPlaceholder")} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              {t("editPaymentModal.cancel")}
            </button>
            <button type="submit" disabled={saving} className="btn-google flex-1 disabled:opacity-50">
              {saving ? t("editPaymentModal.saving") : t("editPaymentModal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
