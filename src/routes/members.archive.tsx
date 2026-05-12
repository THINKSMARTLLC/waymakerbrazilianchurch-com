import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, UserCheck, Trash2, AlertTriangle, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toTitleCase } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatDate, formatLocalDateOnly } from "@/lib/datetime";
import {
  reactivateMember,
  deleteMemberPermanently,
  countMemberPayments,
} from "@/lib/memberLifecycle";

export const Route = createFileRoute("/members/archive")({
  head: () => ({
    meta: [
      { title: "Inactive Members — Way Maker Church" },
      { name: "description", content: "Archived members: reactivate or delete permanently" },
    ],
  }),
  component: ArchivePage,
});

type Member = Database["public"]["Tables"]["members"]["Row"] & {
  inactivated_at?: string | null;
  inactivated_by?: string | null;
  inactivation_reason?: string | null;
};

interface InactiveRow extends Member {
  last_payment_date: string | null;
  payment_count: number;
}

function ArchivePage() {
  const [rows, setRows] = useState<InactiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InactiveRow | null>(null);

  const [mergeHistory, setMergeHistory] = useState<Array<{
    id: string;
    original_member_id: string;
    merged_into_member_id: string;
    merge_date: string;
    restored: boolean;
    snapshot_data: { member?: { name?: string; email?: string | null } } | null;
    winner_name?: string;
  }>>([]);

  const load = async () => {
    setLoading(true);
    // Include both legacy "status=inactive" rows AND newly archived (merged) members.
    const { data: members } = await supabase
      .from("members")
      .select("*")
      .or("status.eq.inactive,archived.eq.true")
      .order("inactivated_at", { ascending: false, nullsFirst: false });

    const list = (members ?? []) as Member[];
    const ids = list.map((m) => m.id);

    const lastByMember = new Map<string, string>();
    const countByMember = new Map<string, number>();

    if (ids.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("member_id, payment_date")
        .in("member_id", ids)
        .order("payment_date", { ascending: false });

      for (const p of payments ?? []) {
        if (!lastByMember.has(p.member_id)) lastByMember.set(p.member_id, p.payment_date);
        countByMember.set(p.member_id, (countByMember.get(p.member_id) ?? 0) + 1);
      }
    }

    setRows(
      list.map((m) => ({
        ...m,
        name: toTitleCase(m.name),
        last_payment_date: lastByMember.get(m.id) ?? null,
        payment_count: countByMember.get(m.id) ?? 0,
      })),
    );

    // Load merge history (most recent 50, not yet restored).
    const { data: mh } = await supabase
      .from("member_merge_history" as never)
      .select("id, original_member_id, merged_into_member_id, merge_date, restored, snapshot_data")
      .order("merge_date", { ascending: false })
      .limit(50);
    const winnerIds = Array.from(new Set((mh ?? []).map((r: { merged_into_member_id: string }) => r.merged_into_member_id)));
    const winnerNames = new Map<string, string>();
    if (winnerIds.length > 0) {
      const { data: wm } = await supabase.from("members").select("id, name").in("id", winnerIds);
      for (const w of wm ?? []) winnerNames.set(w.id, toTitleCase(w.name));
    }
    setMergeHistory(((mh ?? []) as Array<{ id: string; original_member_id: string; merged_into_member_id: string; merge_date: string; restored: boolean; snapshot_data: { member?: { name?: string } } | null }>).map((r) => ({
      ...r,
      winner_name: winnerNames.get(r.merged_into_member_id) ?? "—",
    })));

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleReactivate = async (m: InactiveRow) => {
    setBusyId(m.id);
    setError(null);
    const res = await reactivateMember(m.id);
    setBusyId(null);
    if (!res.ok) setError(res.error ?? "Failed to reactivate.");
    else load();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    setError(null);
    const res = await deleteMemberPermanently(confirmDelete.id);
    setBusyId(null);
    setConfirmDelete(null);
    if (!res.ok) setError(res.error ?? "Failed to delete.");
    else load();
  };

  const askDelete = async (m: InactiveRow) => {
    // Re-check count just-in-time in case payments changed.
    const live = await countMemberPayments(m.id);
    setConfirmDelete({ ...m, payment_count: live });
  };

  const handleUndoMerge = async (historyId: string) => {
    if (!confirm("Undo this merge? The original member will be restored and its payments/activities moved back.")) return;
    setBusyId(historyId);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("undo_merge" as never, { _history_id: historyId } as never);
    setBusyId(null);
    if (rpcErr) setError(rpcErr.message);
    else load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/members"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Archive className="h-4 w-4" />
          {rows.length} inactive member{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Inactive Members</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Archived members do not appear in the main list and cannot access the member portal.
          You can reactivate them or permanently delete records that have no payment history.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No inactive members.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">Name</th>
                  <th className="table-header px-5 py-3 text-left hidden md:table-cell">Email</th>
                  <th className="table-header px-5 py-3 text-left hidden lg:table-cell">Phone</th>
                  <th className="table-header px-5 py-3 text-left hidden md:table-cell">Last Payment</th>
                  <th className="table-header px-5 py-3 text-left">Inactivated</th>
                  <th className="table-header px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground overflow-hidden">
                          {m.profile_photo_url ? (
                            <img src={m.profile_photo_url} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                          {m.payment_count > 0 && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {m.payment_count} payment{m.payment_count > 1 ? "s" : ""} on record
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{m.email || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">{formatPhoneDisplay(m.phone) || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">
                      {m.last_payment_date ? formatLocalDateOnly(m.last_payment_date) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {m.inactivated_at ? formatDate(m.inactivated_at) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReactivate(m)}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                          title="Reactivate member"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Reactivate
                        </button>
                        <button
                          onClick={() => askDelete(m)}
                          disabled={busyId === m.id || m.payment_count > 0}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={m.payment_count > 0 ? "Cannot delete: payments on record" : "Delete permanently"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merge history */}
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Merge History</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Every merge is saved with a full snapshot. You can undo a merge to restore the original record and move its history back.
        </p>
      </div>
      <div className="card-elevated overflow-hidden">
        {mergeHistory.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No merges recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">Original member</th>
                  <th className="table-header px-5 py-3 text-left">Merged into</th>
                  <th className="table-header px-5 py-3 text-left">Date</th>
                  <th className="table-header px-5 py-3 text-left">Status</th>
                  <th className="table-header px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mergeHistory.map((h) => {
                  const snapName = h.snapshot_data?.member?.name ? toTitleCase(String(h.snapshot_data.member.name)) : "—";
                  const snapEmail = h.snapshot_data?.member?.email ?? null;
                  return (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-sm">
                        <div className="font-medium text-foreground">{snapName}</div>
                        {snapEmail && <div className="text-xs text-muted-foreground">{snapEmail}</div>}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">{h.winner_name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(h.merge_date)}</td>
                      <td className="px-5 py-3 text-sm">
                        {h.restored ? (
                          <span className="status-badge status-active">Restored</span>
                        ) : (
                          <span className="status-badge status-inactive">Merged</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleUndoMerge(h.id)}
                          disabled={h.restored || busyId === h.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {h.restored ? "Already restored" : "Undo merge"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Delete permanently?
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              You are about to permanently remove <span className="font-semibold text-foreground">{confirmDelete.name}</span>.
              This action <span className="font-semibold text-foreground">cannot be undone</span>.
            </p>
            {confirmDelete.payment_count > 0 ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                Cannot delete: this member has {confirmDelete.payment_count} payment record
                {confirmDelete.payment_count > 1 ? "s" : ""}. Remove the payments first or keep the member as inactive.
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                The member record and any associated subscription will be removed. The action will be logged in the audit trail.
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={confirmDelete.payment_count > 0 || busyId === confirmDelete.id}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busyId === confirmDelete.id ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
