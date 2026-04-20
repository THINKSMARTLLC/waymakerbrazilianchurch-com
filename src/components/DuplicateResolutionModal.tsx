// Side-by-side duplicate comparison modal. Loads payment stats for each
// member in the group, recommends the best record (most history + complete
// data + recent activity), and launches the existing MergeMembersModal for
// safe field-by-field merging. No data is deleted automatically.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Crown, GitMerge, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Member } from "@/lib/duplicates";
import { mergeMembers } from "@/lib/duplicates";
import { formatUSD, toTitleCase } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

interface MemberStats {
  member: Member;
  paymentCount: number;
  totalPaid: number;
  lastPaymentDate: string | null;
  completeness: number; // 0..5
}

const completenessOf = (m: Member): number => {
  let c = 0;
  if (m.email) c++;
  if (m.phone) c++;
  if (m.address) c++;
  if (m.date_of_birth) c++;
  if (m.emergency_contact) c++;
  return c;
};

export function DuplicateResolutionModal({
  members,
  reasons,
  severity = "duplicate",
  onClose,
  onResolved,
}: {
  members: Member[];
  reasons: ("email" | "phone" | "name")[];
  severity?: "duplicate" | "warning";
  onClose: () => void;
  onResolved: () => void;
}) {
  const isWarning = severity === "warning";
  const [stats, setStats] = useState<MemberStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [winnerId, setWinnerId] = useState<string>("");
  const [loserId, setLoserId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [merging, setMerging] = useState(false);

  // Load payment stats for all members in the group.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = members.map((m) => m.id);
      const { data: payments } = await supabase
        .from("payments")
        .select("member_id, amount, payment_date")
        .in("member_id", ids)
        .order("payment_date", { ascending: false });

      const counts = new Map<string, number>();
      const totals = new Map<string, number>();
      const lasts = new Map<string, string>();
      for (const p of payments ?? []) {
        counts.set(p.member_id, (counts.get(p.member_id) ?? 0) + 1);
        totals.set(p.member_id, (totals.get(p.member_id) ?? 0) + Number(p.amount || 0));
        if (!lasts.has(p.member_id)) lasts.set(p.member_id, p.payment_date);
      }
      const result: MemberStats[] = members.map((m) => ({
        member: m,
        paymentCount: counts.get(m.id) ?? 0,
        totalPaid: totals.get(m.id) ?? 0,
        lastPaymentDate: lasts.get(m.id) ?? null,
        completeness: completenessOf(m),
      }));
      if (cancelled) return;
      setStats(result);

      // Recommended = highest score: payments > completeness > recency.
      const score = (s: MemberStats) =>
        s.paymentCount * 1000 +
        s.completeness * 50 +
        (s.lastPaymentDate ? new Date(s.lastPaymentDate).getTime() / 1e10 : 0);
      const sorted = [...result].sort((a, b) => score(b) - score(a));
      setWinnerId(sorted[0].member.id);
      setLoserId(sorted[1]?.member.id ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [members]);

  const winner = useMemo(() => stats?.find((s) => s.member.id === winnerId), [stats, winnerId]);
  const loser = useMemo(() => stats?.find((s) => s.member.id === loserId), [stats, loserId]);

  const buildBestUpdates = (): Partial<Member> => {
    if (!winner || !loser) return {};
    const u: Partial<Member> = {};
    const pickLonger = (a: string | null, b: string | null) =>
      (a?.length ?? 0) >= (b?.length ?? 0) ? a : b;
    const pickFilled = <T,>(a: T | null, b: T | null): T | null => (a ? a : b);

    const bestName = pickLonger(winner.member.name, loser.member.name) || winner.member.name;
    if (bestName !== winner.member.name) u.name = bestName;

    const bestEmail = pickFilled(winner.member.email, loser.member.email);
    if (bestEmail !== winner.member.email) u.email = bestEmail;

    const bestPhone = pickFilled(winner.member.phone, loser.member.phone);
    if (bestPhone !== winner.member.phone) u.phone = bestPhone;

    const bestAddress = pickFilled(winner.member.address, loser.member.address);
    if (bestAddress !== winner.member.address) u.address = bestAddress;

    const bestDob = pickFilled(winner.member.date_of_birth, loser.member.date_of_birth);
    if (bestDob !== winner.member.date_of_birth) u.date_of_birth = bestDob;

    const bestEmerg = pickFilled(winner.member.emergency_contact, loser.member.emergency_contact);
    if (bestEmerg !== winner.member.emergency_contact) u.emergency_contact = bestEmerg;

    return u;
  };

  const handleMerge = async () => {
    if (!winner || !loser) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMerging(true);
    setError("");
    const { error: mErr } = await mergeMembers({
      winnerId: winner.member.id,
      loserId: loser.member.id,
      winnerUpdates: buildBestUpdates(),
    });
    setMerging(false);
    if (mErr) {
      setError(mErr);
      setConfirmDelete(false);
      return;
    }
    onResolved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isWarning ? "Shared phone number detected" : "This member appears duplicated"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isWarning
                  ? `${members.length} members share the same phone number but have different names/emails. They likely live together (e.g. family) — both records can coexist. No merge is offered.`
                  : `${members.length} records match by ${reasons.join(" + ") || "similar data"}. Pick which to keep and which to merge into it. No data is deleted until you confirm.`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">{error}</div>}

        {loading || !stats ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isWarning ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.member.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member</span>
                  </div>
                  <RecordCard s={s} />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Why no merge?</strong> These members share a phone number but have different names/emails — likely a household phone. Both records remain active. If they are actually the same person, edit one record to fix the name/email and the system will offer a merge.
            </div>
            <div className="flex gap-3 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="btn-google flex-1 inline-flex items-center justify-center gap-2"
              >
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* For groups of >2, let admin pick winner from a select */}
              {[
                { id: "winner", label: "Keep (winner)", value: winnerId, onChange: setWinnerId, badge: <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Crown className="h-3 w-3" /> Recommended</span> },
                { id: "loser", label: "Merge from (loser)", value: loserId, onChange: setLoserId, badge: <span className="text-xs text-muted-foreground">Will be deleted after merge</span> },
              ].map((side) => {
                const s = stats.find((x) => x.member.id === side.value);
                return (
                  <div key={side.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{side.label}</span>
                      {side.badge}
                    </div>
                    <select
                      value={side.value}
                      onChange={(e) => side.onChange(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground mb-3"
                    >
                      <option value="">— select —</option>
                      {stats.map((opt) => (
                        <option key={opt.member.id} value={opt.member.id} disabled={opt.member.id === (side.id === "winner" ? loserId : winnerId)}>
                          {toTitleCase(opt.member.name)}
                        </option>
                      ))}
                    </select>
                    {s ? <RecordCard s={s} /> : <p className="text-sm text-muted-foreground italic">Pick a record</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Merge rules:</strong> Keep the most complete name, valid email, valid phone, and address from either record. All payment history from the loser is moved to the winner. The loser is deleted only after you confirm.
            </div>

            {confirmDelete && (
              <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-foreground mb-1">Delete duplicate record?</p>
                <p className="text-xs text-muted-foreground">
                  Payment history will be moved to <strong>{toTitleCase(winner?.member.name ?? "")}</strong>, then <strong>{toTitleCase(loser?.member.name ?? "")}</strong> will be permanently deleted. This cannot be undone.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={!winner || !loser || winner.member.id === loser.member.id || merging}
                className="btn-google flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <GitMerge className="h-4 w-4" />
                {merging ? "Merging..." : confirmDelete ? "Confirm & Delete Duplicate" : "Merge Records"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RecordCard({ s }: { s: MemberStats }) {
  return (
    <div className="space-y-2 text-sm">
      <Row label="Name" value={toTitleCase(s.member.name)} />
      <Row label="Email" value={s.member.email || "—"} muted={!s.member.email} />
      <Row label="Phone" value={s.member.phone ? formatPhoneDisplay(s.member.phone) : "—"} muted={!s.member.phone} />
      <Row label="Address" value={s.member.address || "—"} muted={!s.member.address} />
      <div className="border-t border-border my-2" />
      <Row label="Payments" value={String(s.paymentCount)} />
      <Row label="Total paid" value={formatUSD(s.totalPaid)} />
      <Row label="Last payment" value={s.lastPaymentDate ? new Date(s.lastPaymentDate).toLocaleDateString("en-US") : "—"} muted={!s.lastPaymentDate} />
      <Row label="Completeness" value={`${s.completeness}/5 fields`} />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right truncate ${muted ? "italic text-muted-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
