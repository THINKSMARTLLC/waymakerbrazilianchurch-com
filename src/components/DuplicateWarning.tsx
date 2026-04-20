// Inline warning shown above the member form when potential duplicates are
// detected. Offers three actions: keep existing, merge, create anyway.
import { AlertTriangle, User } from "lucide-react";
import type { DuplicateMatch } from "@/lib/duplicates";
import { isIncompleteMember } from "@/lib/duplicates";
import { toTitleCase } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

export function DuplicateWarning({
  matches,
  onKeepExisting,
  onMerge,
  onCreateAnyway,
}: {
  matches: DuplicateMatch[];
  onKeepExisting: (match: DuplicateMatch) => void;
  onMerge: (match: DuplicateMatch) => void;
  onCreateAnyway: () => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            This user may already exist.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
            We found {matches.length} matching record{matches.length > 1 ? "s" : ""} by email or phone. Resolve before saving.
          </p>

          <div className="mt-3 space-y-2">
            {matches.map((m) => {
              const incomplete = m.source === "member" && m.member && isIncompleteMember(m.member);
              return (
                <div key={`${m.source}-${m.id}`} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-background p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{toTitleCase(m.name)}</span>
                        <span className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                          {m.source === "member" ? "Member" : "Registered user"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          matched by {m.matched_by.join(" + ")}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        <div>{m.email || <span className="italic">no email</span>}</div>
                        <div>{m.phone ? formatPhoneDisplay(m.phone) : <span className="italic">no phone</span>}</div>
                      </div>
                      {incomplete && (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
                          One record has incomplete data — merge recommended.
                        </p>
                      )}
                      {m.source === "member" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onKeepExisting(m)}
                            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                          >
                            Keep existing
                          </button>
                          <button
                            type="button"
                            onClick={() => onMerge(m)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                          >
                            Merge records
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
            <button
              type="button"
              onClick={onCreateAnyway}
              className="text-xs font-medium text-amber-900 dark:text-amber-100 underline hover:no-underline"
            >
              Create anyway (admin override)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
