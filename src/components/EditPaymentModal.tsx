import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];

const CONTRIBUTION_TYPES = [
  { value: "tithe", label: "Tithe" },
  { value: "offering", label: "Offering" },
  { value: "pastor_salary", label: "Pastor Salary" },
  { value: "special_donation", label: "Special Donation" },
  { value: "event_contribution", label: "Event Contribution" },
  { value: "other", label: "Other" },
] as const;

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "card", label: "Card" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

interface Props {
  payment: Payment;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPaymentModal({ payment, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    if (!isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount.");
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
      })
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
        <h2 className="font-display text-lg font-semibold text-foreground mb-5">Edit Payment</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
              <input name="payment_date" type="date" required defaultValue={payment.payment_date} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Amount (USD)</label>
              <input name="amount" type="number" step="0.01" min="0.01" required defaultValue={payment.amount} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Extra Amount (USD)</label>
            <input name="extra_amount" type="number" step="0.01" min="0" defaultValue={Number(payment.extra_amount) || 0} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">Amount above the expected base contribution.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
            <select name="payment_method" defaultValue={payment.payment_method === "stripe" ? "card" : payment.payment_method} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contribution Type</label>
            <select name="contribution_type" defaultValue={payment.contribution_type} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {CONTRIBUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea name="notes" rows={2} defaultValue={payment.notes ?? ""} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-google flex-1 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
