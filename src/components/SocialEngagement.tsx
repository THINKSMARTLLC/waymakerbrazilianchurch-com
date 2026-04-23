import { useEffect, useState } from "react";
import { Globe, Instagram, Facebook, Youtube, Star, ExternalLink, X, Upload, Link as LinkIcon, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Platform = Database["public"]["Enums"]["social_platform"];
type ActionType = Database["public"]["Enums"]["social_action_type"];
type Status = Database["public"]["Enums"]["engagement_status"];

interface PlatformConfig {
  key: Platform;
  name: string;
  url: string;
  icon: typeof Globe;
  color: string;
  actions: { value: ActionType; label: string }[];
  points: number;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: "website",
    name: "Visit Website",
    url: "https://www.waymakerbrazilianchurch.com/",
    icon: Globe,
    color: "text-blue-600",
    actions: [{ value: "visit", label: "Visit" }],
    points: 5,
  },
  {
    key: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/waymakerbchurch/",
    icon: Instagram,
    color: "text-pink-600",
    actions: [
      { value: "follow", label: "Follow" },
      { value: "like", label: "Like a post" },
      { value: "comment", label: "Comment" },
    ],
    points: 5,
  },
  {
    key: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/p/Way-Maker-Brazilian-Church-61574095749100/",
    icon: Facebook,
    color: "text-blue-700",
    actions: [
      { value: "follow", label: "Follow" },
      { value: "like", label: "Like a post" },
      { value: "comment", label: "Comment" },
    ],
    points: 5,
  },
  {
    key: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/@WayMakerBrazilianChurch/streams",
    icon: Youtube,
    color: "text-red-600",
    actions: [
      { value: "subscribe", label: "Subscribe" },
      { value: "watch", label: "Watch" },
      { value: "comment", label: "Comment" },
    ],
    points: 5,
  },
  {
    key: "google_review",
    name: "Google Review",
    url: "https://share.google/IyACo2nryhESJeFPb",
    icon: Star,
    color: "text-yellow-600",
    actions: [{ value: "review", label: "Leave a review" }],
    points: 10,
  },
];

interface EngagementRow {
  id: string;
  platform: Platform;
  action_type: ActionType;
  status: Status;
  points: number;
  created_at: string;
}

interface Props {
  memberId: string;
}

const STATUS_BADGE: Record<Status, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "Under review", className: "bg-warning/15 text-warning-foreground", Icon: Clock },
  approved: { label: "Approved", className: "bg-success/15 text-success", Icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive", Icon: XCircle },
};

export function SocialEngagement({ memberId }: Props) {
  const { user } = useAuth();
  const [pending, setPending] = useState<{ platform: PlatformConfig; visitedAt: number } | null>(null);
  const [recent, setRecent] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("social_engagements")
      .select("id, platform, action_type, status, points, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(10);
    setRecent((data ?? []) as EngagementRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (memberId) load();
  }, [memberId]);

  const [awaitingReturn, setAwaitingReturn] = useState<PlatformConfig | null>(null);
  const [confirmReturn, setConfirmReturn] = useState<PlatformConfig | null>(null);

  const handleClick = (platform: PlatformConfig) => {
    // Always open in a new tab — never redirect the current app page
    window.open(platform.url, "_blank", "noopener,noreferrer");

    if (platform.key === "google_review") {
      // Wait for the user to come back to the app (focus/visibility regained)
      setAwaitingReturn(platform);
    } else {
      setTimeout(() => {
        setPending({ platform, visitedAt: Date.now() });
      }, 800);
    }
  };

  // Detect when the user returns to the app after visiting Google Review
  useEffect(() => {
    if (!awaitingReturn) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") {
        setConfirmReturn(awaitingReturn);
        setAwaitingReturn(null);
      }
    };
    const onFocus = () => {
      setConfirmReturn(awaitingReturn);
      setAwaitingReturn(null);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onFocus);
    };
  }, [awaitingReturn]);

  return (
    <div className="card-elevated p-5">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-base font-medium text-foreground">Engage with the Church</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Interact with our platforms and earn points after admin validation.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleClick(p)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:shadow-md"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${p.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">+{p.points} points</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </button>
          );
        })}
      </div>

      {!loading && recent.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Your submissions
          </h4>
          <ul className="space-y-2">
            {recent.map((r) => {
              const cfg = PLATFORMS.find((p) => p.key === r.platform);
              const badge = STATUS_BADGE[r.status];
              const BadgeIcon = badge.Icon;
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground truncate">
                    {cfg?.name ?? r.platform} — {r.action_type}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                    <BadgeIcon className="h-3 w-3" />
                    {badge.label}
                    {r.status === "approved" && ` · +${r.points}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirmReturn && (
        <ReturnConfirmModal
          platform={confirmReturn}
          onYes={() => {
            const p = confirmReturn;
            setConfirmReturn(null);
            setPending({ platform: p, visitedAt: Date.now() });
          }}
          onNo={() => setConfirmReturn(null)}
        />
      )}

      {pending && user && (
        <ProofModal
          platform={pending.platform}
          memberId={memberId}
          userId={user.id}
          onClose={() => setPending(null)}
          onSuccess={() => {
            setPending(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReturnConfirmModal({
  platform,
  onYes,
  onNo,
}: {
  platform: PlatformConfig;
  onYes: () => void;
  onNo: () => void;
}) {
  const Icon = platform.icon;
  const isReview = platform.key === "google_review";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${platform.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {isReview ? "Did you complete your review?" : "Did you complete this action?"}
            </h3>
            <p className="text-xs text-muted-foreground">{platform.name}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onNo}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={onYes}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Yes, I completed
          </button>
        </div>
      </div>
    </div>
  );
}

function ProofModal({
  platform,
  memberId,
  userId,
  onClose,
  onSuccess,
}: {
  platform: PlatformConfig;
  memberId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [actionType, setActionType] = useState<ActionType>(platform.actions[0].value);
  const [proofLink, setProofLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!proofLink.trim() && !file) {
      toast.error("Please provide a screenshot or a link as proof.");
      return;
    }
    if (proofLink && !/^https?:\/\//i.test(proofLink.trim())) {
      toast.error("Link must start with http(s)://");
      return;
    }

    setSubmitting(true);
    try {
      // Fraud control:
      // - Google Review: 1 submission per 30 days
      // - Other platforms: 1 submission per day
      const isGoogleReview = platform.key === "google_review";
      let startISO: string;
      if (isGoogleReview) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startISO = d.toISOString();
      } else {
        const today = new Date();
        startISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      }

      const { data: existing } = await supabase
        .from("social_engagements")
        .select("id")
        .eq("member_id", memberId)
        .eq("platform", platform.key)
        .gte("created_at", startISO)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error(
          isGoogleReview
            ? "You already submitted a review this month"
            : "You've already submitted for this platform today."
        );
        setSubmitting(false);
        return;
      }

      let proofUrl: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File must be under 5MB.");
          setSubmitting(false);
          return;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${platform.key}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("engagement-proofs")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("engagement-proofs").getPublicUrl(path);
        proofUrl = pub.publicUrl;
      }

      const { data: inserted, error } = await supabase
        .from("social_engagements")
        .insert({
          member_id: memberId,
          platform: platform.key,
          action_type: actionType,
          proof_url: proofUrl,
          proof_link: proofLink.trim() || null,
          points: platform.points,
          status: "pending",
        })
        .select("id, created_at")
        .single();

      if (error) {
        console.error("[SocialEngagement] insert failed", error);
        throw error;
      }

      console.info("[SocialEngagement] saved", inserted);
      toast.success("Your activity is under review");
      onSuccess();
    } catch (err) {
      console.error("[SocialEngagement] submit error", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  };

  const Icon = platform.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${platform.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Did you complete this action?</h3>
              <p className="text-xs text-muted-foreground">{platform.name} · +{platform.points} points</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground">Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {platform.actions.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Link to your post / comment / review
            </label>
            <input
              type="url"
              value={proofLink}
              onChange={(e) => setProofLink(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">or</div>

          <div>
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Screenshot
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
            />
            {file && <p className="mt-1 text-[11px] text-muted-foreground">{file.name}</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit proof"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
