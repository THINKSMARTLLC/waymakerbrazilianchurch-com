import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/datetime";
import { ACTIVITY_LABEL, ACTIVITY_ICON, ACTIVITY_POINTS, type ActivityType } from "@/lib/engagement";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["engagement_status"];
type Platform = Database["public"]["Enums"]["social_platform"];
type ActionType = Database["public"]["Enums"]["social_action_type"];

interface UnifiedRow {
  id: string;
  kind: "social" | "activity";
  member_id: string;
  member_name: string;
  member_email: string | null;
  source: string; // "social" | "checkin" | "manual"
  type_label: string;
  icon: string;
  proof_url: string | null;
  proof_link: string | null;
  points: number;
  status: Status;
  date: string; // ISO
}

export const Route = createFileRoute("/engagement/review")({
  head: () => ({ meta: [{ title: "Engagement Review — WAY MAKER FLOW" }] }),
  component: EngagementReviewPage,
});

const PLATFORM_LABELS: Record<Platform, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  google_review: "Google Review",
};

function EngagementReviewPage() {
  const { isStaff, loading: roleLoading } = useUserRole();
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [socialRes, activityRes] = await Promise.all([
      supabase
        .from("social_engagements")
        .select("id, member_id, platform, action_type, proof_url, proof_link, points, status, created_at, member:members(name, email)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("member_activities")
        .select("id, member_id, activity_type, activity_date, source, status, photo_url, notes, created_at, member:members(name, email)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (socialRes.error) toast.error(socialRes.error.message);
    if (activityRes.error) toast.error(activityRes.error.message);

    const socialRows: UnifiedRow[] = ((socialRes.data ?? []) as unknown as Array<{
      id: string; member_id: string; platform: Platform; action_type: ActionType;
      proof_url: string | null; proof_link: string | null; points: number;
      status: Status; created_at: string; member?: { name: string; email: string | null } | null;
    }>).map((r) => ({
      id: `s-${r.id}`,
      kind: "social",
      member_id: r.member_id,
      member_name: r.member?.name ?? "Unknown",
      member_email: r.member?.email ?? null,
      source: "social",
      type_label: `${PLATFORM_LABELS[r.platform]} · ${r.action_type}`,
      icon: "🌐",
      proof_url: r.proof_url,
      proof_link: r.proof_link,
      points: r.points,
      status: r.status,
      date: r.created_at,
    }));

    const activityRows: UnifiedRow[] = ((activityRes.data ?? []) as unknown as Array<{
      id: string; member_id: string; activity_type: ActivityType; activity_date: string;
      source: string; status: Status; photo_url: string | null; notes: string | null;
      created_at: string; member?: { name: string; email: string | null } | null;
    }>).map((r) => ({
      id: `a-${r.id}`,
      kind: "activity",
      member_id: r.member_id,
      member_name: r.member?.name ?? "Unknown",
      member_email: r.member?.email ?? null,
      source: r.source === "self_checkin" ? "checkin" : "manual",
      type_label: ACTIVITY_LABEL[r.activity_type] ?? r.activity_type,
      icon: ACTIVITY_ICON[r.activity_type] ?? "✅",
      proof_url: r.photo_url,
      proof_link: null,
      points: ACTIVITY_POINTS[r.activity_type] ?? 0,
      status: r.status,
      date: r.created_at,
    }));

    const merged = [...socialRows, ...activityRows]
      .filter((r) => filter === "all" || r.status === filter)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, filter]);

  const filteredRows = memberFilter.trim()
    ? rows.filter((r) => {
        const q = memberFilter.toLowerCase();
        return r.member_name.toLowerCase().includes(q) || (r.member_email ?? "").toLowerCase().includes(q);
      })
    : rows;

  const review = async (row: UnifiedRow, status: Status) => {
    const { data: auth } = await supabase.auth.getUser();
    const realId = row.id.replace(/^[sa]-/, "");
    let error;
    if (row.kind === "social") {
      ({ error } = await supabase
        .from("social_engagements")
        .update({ status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", realId));
    } else {
      ({ error } = await supabase
        .from("member_activities")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approved_by: status === "approved" ? (auth.user?.id ?? null) : null,
        })
        .eq("id", realId));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Approved 🙌 — points added" : "Rejected");
    load();
  };

  if (roleLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!isStaff) return <div className="p-6 text-sm text-destructive">Access denied.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Engagement Review</h2>
          <p className="text-sm text-muted-foreground">Approve or reject member submissions (check-ins, social, manual).</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder="Filter by member name or email..."
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm w-64"
          />
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card-elevated p-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredRows.map((r) => (
              <li key={r.id} className="py-4 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span aria-hidden>{r.icon}</span>
                    {r.member_name} · {r.type_label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="inline-block rounded bg-muted px-1.5 py-0.5 mr-1.5 uppercase tracking-wide text-[10px]">
                      {r.source}
                    </span>
                    +{r.points} pts · {formatDateTime(r.date)}
                  </p>
                  {r.member_email && <p className="text-xs text-muted-foreground">{r.member_email}</p>}
                  <div className="mt-2 flex gap-3 flex-wrap">
                    {r.proof_link && (
                      <button
                        type="button"
                        onClick={() => openExternal(r.proof_link!, r.type_label)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open link
                      </button>
                    )}
                    {r.proof_url && (
                      <button
                        type="button"
                        onClick={() => openExternal(r.proof_url!, r.type_label)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ImageIcon className="h-3 w-3" /> View proof
                      </button>
                    )}
                  </div>
                </div>

                {r.proof_url && (
                  <button
                    type="button"
                    onClick={() => openExternal(r.proof_url!, r.type_label)}
                    className="shrink-0"
                  >
                    <img src={r.proof_url} alt="proof" className="h-20 w-20 rounded-lg object-cover border border-border" />
                  </button>
                )}

                <div className="flex gap-2 shrink-0 items-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    r.status === "pending" ? "bg-warning/15 text-warning-foreground" :
                    r.status === "approved" ? "bg-success/15 text-success" :
                    "bg-destructive/15 text-destructive"
                  }`}>
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => review(r, "approved")}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => review(r, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
