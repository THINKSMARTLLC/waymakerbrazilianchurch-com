import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/datetime";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["engagement_status"];
type Platform = Database["public"]["Enums"]["social_platform"];
type ActionType = Database["public"]["Enums"]["social_action_type"];

interface Row {
  id: string;
  member_id: string;
  platform: Platform;
  action_type: ActionType;
  proof_url: string | null;
  proof_link: string | null;
  points: number;
  status: Status;
  created_at: string;
  member?: { name: string; email: string | null } | null;
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
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("social_engagements")
      .select("id, member_id, platform, action_type, proof_url, proof_link, points, status, created_at, member:members(name, email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, filter]);

  const filteredRows = memberFilter.trim()
    ? rows.filter((r) => {
        const q = memberFilter.toLowerCase();
        return (
          (r.member?.name?.toLowerCase().includes(q) ?? false) ||
          (r.member?.email?.toLowerCase().includes(q) ?? false)
        );
      })
    : rows;

  const review = async (id: string, status: Status) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("social_engagements")
      .update({ status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Approved 🙌" : "Rejected");
    load();
  };

  if (roleLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!isStaff) return <div className="p-6 text-sm text-destructive">Access denied.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Social Engagement Review</h2>
          <p className="text-sm text-muted-foreground">Approve or reject member submissions.</p>
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
                  <p className="text-sm font-medium text-foreground">
                    {r.member?.name ?? "Unknown"} · {PLATFORM_LABELS[r.platform]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.action_type} · +{r.points} pts · {formatDateTime(r.created_at)}
                  </p>
                  {r.member?.email && <p className="text-xs text-muted-foreground">{r.member.email}</p>}
                  <div className="mt-2 flex gap-3 flex-wrap">
                    {r.proof_link && (
                      <a
                        href={r.proof_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open link
                      </a>
                    )}
                    {r.proof_url && (
                      <a
                        href={r.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ImageIcon className="h-3 w-3" /> View screenshot
                      </a>
                    )}
                  </div>
                </div>

                {r.proof_url && (
                  <a href={r.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={r.proof_url} alt="proof" className="h-20 w-20 rounded-lg object-cover border border-border" />
                  </a>
                )}

                <div className="flex gap-2 shrink-0">
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
                        onClick={() => review(r.id, "approved")}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => review(r.id, "rejected")}
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
