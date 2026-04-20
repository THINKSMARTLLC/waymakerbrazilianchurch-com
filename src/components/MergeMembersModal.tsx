// Field-by-field merge picker. Admin chooses which value to keep from each
// candidate member, then payments are reassigned and the loser is deleted.
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Member } from "@/lib/duplicates";
import { mergeMembers } from "@/lib/duplicates";
import { toTitleCase } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

type FieldKey = "name" | "email" | "phone" | "address" | "emergency_contact" | "date_of_birth" | "member_role" | "department";

const FIELD_LABEL: Record<FieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  emergency_contact: "Emergency Contact",
  date_of_birth: "Date of Birth",
  member_role: "Role",
  department: "Department",
};

const FIELDS: FieldKey[] = ["name", "email", "phone", "address", "emergency_contact", "date_of_birth", "member_role", "department"];

export function MergeMembersModal({
  candidate,
  existing,
  onClose,
  onMerged,
}: {
  /** The values the admin just typed in the form (not yet saved). */
  candidate: Partial<Member> & { name: string };
  /** The existing member found as a duplicate. */
  existing: Member;
  onClose: () => void;
  onMerged: (keptMemberId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // For each field, true = keep existing's value, false = take candidate's value.
  const [keepExisting, setKeepExisting] = useState<Record<FieldKey, boolean>>(() => {
    const init = {} as Record<FieldKey, boolean>;
    for (const f of FIELDS) {
      const exVal = (existing as Record<string, unknown>)[f];
      const cdVal = (candidate as Record<string, unknown>)[f];
      // Default: keep whichever side has a value. If both have values, prefer candidate (admin just typed it).
      init[f] = exVal && !cdVal ? true : false;
    }
    return init;
  });

  const display = (f: FieldKey, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (f === "phone") return formatPhoneDisplay(String(v));
    if (f === "name") return toTitleCase(String(v));
    return String(v);
  };

  const updates = useMemo(() => {
    const u: Partial<Member> = {};
    for (const f of FIELDS) {
      const exVal = (existing as Record<string, unknown>)[f];
      const cdVal = (candidate as Record<string, unknown>)[f];
      const chosen = keepExisting[f] ? exVal : cdVal;
      if (chosen !== exVal) {
        (u as Record<string, unknown>)[f] = chosen ?? null;
      }
    }
    return u;
  }, [keepExisting, existing, candidate]);

  const handleConfirm = async () => {
    if (!confirm("Merge will move all payments to the kept record and delete the duplicate. Continue?")) return;
    setSaving(true);
    setError("");
    // Winner = existing (we keep its id and payment history). Apply chosen updates.
    const { error: mErr } = await mergeMembers({
      winnerId: existing.id,
      loserId: existing.id, // placeholder — see below
      winnerUpdates: updates,
    });
    // NOTE: when merging during creation, there is no loser member yet (the
    // candidate hasn't been saved). In that case loserId === winnerId is a no-op
    // for delete + payment reassign (no payments under the unsaved candidate).
    setSaving(false);
    if (mErr) {
      setError(mErr);
      return;
    }
    onMerged(existing.id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-5">
          <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Merge with Existing Member</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which value to keep for each field. Payments and history will be preserved on the kept record.
            </p>
          </div>
        </div>

        {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">{error}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-[140px_1fr_1fr] gap-3 items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b border-border">
            <div>Field</div>
            <div>Existing record</div>
            <div>New input</div>
          </div>
          {FIELDS.map((f) => {
            const exVal = (existing as Record<string, unknown>)[f];
            const cdVal = (candidate as Record<string, unknown>)[f];
            const exMissing = exVal === null || exVal === undefined || exVal === "";
            const cdMissing = cdVal === null || cdVal === undefined || cdVal === "";
            return (
              <div key={f} className="grid grid-cols-[140px_1fr_1fr] gap-3 items-start text-sm py-2 border-b border-border/50 last:border-0">
                <div className="text-muted-foreground font-medium pt-2">{FIELD_LABEL[f]}</div>
                <button
                  type="button"
                  onClick={() => setKeepExisting((s) => ({ ...s, [f]: true }))}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    keepExisting[f]
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  <span className={exMissing ? "text-muted-foreground italic" : "text-foreground"}>
                    {display(f, exVal)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setKeepExisting((s) => ({ ...s, [f]: false }))}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    !keepExisting[f]
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  <span className={cdMissing ? "text-muted-foreground italic" : "text-foreground"}>
                    {display(f, cdVal)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-5 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="btn-google flex-1 disabled:opacity-50"
          >
            {saving ? "Merging..." : "Confirm Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
