import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatUSD } from "@/lib/format";
import { WEEKLY_TARGET_AMOUNT_PER_PERSON } from "@/lib/settings";

type BeneficiaryMode = "myself" | "another" | "family";
interface MemberLite { id: string; name: string; email: string | null; phone: string | null }

const CONTRIBUTION_TYPES = [
  { value: "pastor_salary", label: "Pastor Salary" },
  { value: "tithe", label: "Tithe" },
  { value: "offering", label: "Offering" },
  { value: "event_contribution", label: "Event Donation" },
  { value: "special_donation", label: "Special Donation" },
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
type ContributionType = (typeof CONTRIBUTION_TYPES)[number]["value"];
type Frequency = "weekly" | "monthly";

const WEEKS_PER_MONTH = 4; // Spec: monthly_base = 20 × 4 = 80

interface ContribRow {
  id: string;
  type: ContributionType;
  amount: string;
  destination: string;
}

interface Props {
  memberId: string;
  memberName: string;
  defaultAmount?: number;
  onClose: () => void;
  onSaved: () => void;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RecordPaymentModal({ memberId, memberName, defaultAmount, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Payer/beneficiary
  const [beneficiaryMode, setBeneficiaryMode] = useState<BeneficiaryMode>("myself");
  const [beneficiary, setBeneficiary] = useState<MemberLite | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<MemberLite[]>([]);
  const [searching, setSearching] = useState(false);

  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [referenceMonth, setReferenceMonth] = useState<string>(currentMonthISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  // Total the user actually paid
  const [total, setTotal] = useState<string>(defaultAmount ? String(defaultAmount) : "");

  // Optional itemized contributions
  const [contribs, setContribs] = useState<ContribRow[]>([]);

  const baseExpected = frequency === "monthly"
    ? WEEKLY_TARGET_AMOUNT_PER_PERSON * WEEKS_PER_MONTH
    : WEEKLY_TARGET_AMOUNT_PER_PERSON;

  const totalNum = Number(total) || 0;
  const baseAmount = Math.min(totalNum, baseExpected);
  const extraAmount = Math.max(0, totalNum - baseExpected);

  const contribsTotal = useMemo(
    () => contribs.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    [contribs]
  );

  const addContrib = () => {
    setContribs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "tithe", amount: "", destination: "" },
    ]);
  };

  const updateContrib = (id: string, patch: Partial<ContribRow>) => {
    setContribs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  // Member search for beneficiary
  useEffect(() => {
    if (beneficiaryMode === "myself") {
      setSearchResults([]);
      return;
    }
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const digits = term.replace(/\D/g, "");
      const like = `%${term}%`;
      const orFilters = [`name.ilike.${like}`, `email.ilike.${like}`];
      if (digits.length >= 3) orFilters.push(`phone.ilike.%${digits}%`);
      const { data } = await supabase
        .from("members")
        .select("id, name, email, phone")
        .eq("archived", false)
        .neq("id", memberId)
        .or(orFilters.join(","))
        .order("name", { ascending: true })
        .limit(8);
      if (cancelled) return;
      setSearchResults((data ?? []) as MemberLite[]);
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchTerm, beneficiaryMode, memberId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!isFinite(totalNum) || totalNum <= 0) {
      setError("Enter a valid total amount.");
      return;
    }

    // If user added itemized contributions, they must sum to <= total
    if (contribs.length > 0 && contribsTotal > totalNum + 0.001) {
      setError(`Contributions (${formatUSD(contribsTotal)}) exceed total (${formatUSD(totalNum)}).`);
      return;
    }

    if (beneficiaryMode !== "myself" && !beneficiary) {
      setError("Select the member this contribution is for.");
      return;
    }

    setSaving(true);

    // Default contribution_type for the parent record:
    // - first itemized contribution if any, otherwise pastor_salary
    const defaultType: ContributionType =
      contribs.find((c) => Number(c.amount) > 0)?.type ?? "pastor_salary";

    // reference_month: store as the first day of the chosen month (only for monthly)
    const refMonthDate = frequency === "monthly" ? `${referenceMonth}-01` : null;

    const beneficiaryId = beneficiaryMode === "myself" ? memberId : beneficiary!.id;

    const insertPayload = {
      member_id: beneficiaryId,
      payer_member_id: memberId,
      beneficiary_member_id: beneficiaryId,
      amount: totalNum,
      base_amount: baseAmount,
      extra_amount: extraAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod as PaymentMethod,
      contribution_type: defaultType,
      payment_frequency: frequency,
      reference_month: refMonthDate,
      notes: notes || null,
      status: "paid" as const,
      recorded_by: user?.id ?? null,
    };

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !payment) {
      setError(insertError?.message ?? "Failed to save payment.");
      setSaving(false);
      return;
    }

    // Save itemized contributions (if any)
    const validRows = contribs
      .filter((c) => Number(c.amount) > 0)
      .map((c) => ({
        payment_id: payment.id,
        contribution_type: c.type,
        amount: Number(c.amount),
        destination: c.destination.trim() || null,
      }));

    if (validRows.length > 0) {
      const { error: contribErr } = await supabase.from("payment_contributions").insert(validRows);
      if (contribErr) {
        setError(`Payment saved, but contributions failed: ${contribErr.message}`);
        setSaving(false);
        return;
      }
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="font-display text-lg font-semibold text-foreground">Record Payment</h2>
        <p className="text-sm text-muted-foreground mb-5">{memberName}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          {/* Frequency selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Frequency</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    frequency === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "weekly" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Payment Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {frequency === "monthly" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reference Month</label>
                <input
                  type="month"
                  required
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Total + computed base/extra */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Total Paid (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>Base expected ({frequency === "monthly" ? `${WEEKS_PER_MONTH} weeks × $${WEEKLY_TARGET_AMOUNT_PER_PERSON}` : `1 week × $${WEEKLY_TARGET_AMOUNT_PER_PERSON}`})</span>
                <span className="font-medium text-foreground">{formatUSD(baseExpected)}</span>
              </div>
              <div className="flex justify-between">
                <span>Base counted</span>
                <span className="font-medium text-foreground">{formatUSD(baseAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Extra</span>
                <span className="font-medium text-foreground">{formatUSD(extraAmount)}</span>
              </div>
              {frequency === "monthly" && totalNum > 0 && (
                <div className="flex justify-between pt-1 border-t border-border/60">
                  <span>Weekly equivalent</span>
                  <span className="font-medium text-foreground">{formatUSD(totalNum / WEEKS_PER_MONTH)}/wk</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Contributions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-foreground">Contributions</label>
              <button
                type="button"
                onClick={addContrib}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add Contribution
              </button>
            </div>
            {contribs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Optional. Break the total into categories (Tithe, Offering, Pastor Salary…).
              </p>
            ) : (
              <div className="space-y-2">
                {contribs.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 gap-2 items-start">
                    <select
                      value={c.type}
                      onChange={(e) => updateContrib(c.id, { type: e.target.value as ContributionType })}
                      className="col-span-4 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CONTRIBUTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={c.amount}
                      onChange={(e) => updateContrib(c.id, { amount: e.target.value })}
                      placeholder="0.00"
                      className="col-span-3 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={c.destination}
                      onChange={(e) => updateContrib(c.id, { destination: e.target.value })}
                      placeholder="Destination (optional)"
                      className="col-span-4 rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeContrib(c.id)}
                      className="col-span-1 inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Itemized total</span>
                  <span className={contribsTotal > totalNum + 0.001 ? "text-destructive font-medium" : "text-foreground font-medium"}>
                    {formatUSD(contribsTotal)} / {formatUSD(totalNum)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-google flex-1 disabled:opacity-50"
            >
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
