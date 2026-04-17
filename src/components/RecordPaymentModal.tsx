import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatUSD } from "@/lib/format";

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

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"] | "stripe";

interface Props {
  memberId: string;
  memberName: string;
  defaultAmount?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function RecordPaymentModal({ memberId, memberName, defaultAmount, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [base, setBase] = useState<string>(defaultAmount ? String(defaultAmount) : "");
  const [extra, setExtra] = useState<string>("");

  const baseNum = Number(base) || 0;
  const extraNum = Number(extra) || 0;
  const total = baseNum + extraNum;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!isFinite(total) || total <= 0) {
      setError("Enter a valid amount.");
      setSaving(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const { error: insertError } = await supabase.from("payments").insert({
      member_id: memberId,
      amount: total,
      base_amount: baseNum,
      extra_amount: extraNum,
      payment_date: form.get("payment_date") as string,
      payment_method: form.get("payment_method") as PaymentMethod,
      contribution_type: form.get("contribution_type") as "tithe",
      notes: (form.get("notes") as string) || null,
      status: "paid",
      recorded_by: user?.id ?? null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
    } else {
      onSaved();
      onClose();
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-semibold text-foreground">Record Payment</h2>
        <p className="text-sm text-muted-foreground mb-5">{memberName}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
            <input name="payment_date" type="date" required defaultValue={today} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Base (USD)</label>
              <input value={base} onChange={(e) => setBase(e.target.value)} type="number" step="0.01" min="0" required placeholder="0.00" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Extra (USD)</label>
              <input value={extra} onChange={(e) => setExtra(e.target.value)} type="number" step="0.01" min="0" placeholder="0.00" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Total: <span className="font-medium text-foreground">{formatUSD(total)}</span></p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
            <select name="payment_method" defaultValue="cash" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contribution Type</label>
            <select name="contribution_type" defaultValue="tithe" className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {CONTRIBUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-google flex-1 disabled:opacity-50">
              {saving ? "Saving..." : "Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const CONTRIBUTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CONTRIBUTION_TYPES.map((t) => [t.value, t.label])
);

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])),
  stripe: "Card",
};

export { PAYMENT_METHODS };
