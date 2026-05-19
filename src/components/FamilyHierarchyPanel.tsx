import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users as UsersIcon, Crown, User as UserIcon, CreditCard, Settings2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatUSD, toTitleCase } from "@/lib/format";
import {
  getFamilyHierarchy,
  type FamilyHierarchy,
  type FamilyMemberSummary,
} from "@/lib/familyHierarchy";
import { FinancialRelationshipsDrawer } from "@/components/FinancialRelationshipsDrawer";

interface Props {
  memberId: string;
  reloadKey?: number;
  onChanged?: () => void;
}

export function FamilyHierarchyPanel({ memberId, reloadKey, onChanged }: Props) {
  const [data, setData] = useState<FamilyHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [localKey, setLocalKey] = useState(0);

  const reload = async () => {
    setLoading(true);
    try {
      const h = await getFamilyHierarchy(memberId);
      setData(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, reloadKey, localKey]);

  const me = data?.members.find((m) => m.id === memberId) ?? null;
  const sponsors = data?.sponsors ?? [];
  const individualSponsors = data?.individualSponsors ?? [];
  const dependents = data?.dependents ?? [];

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <UsersIcon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-medium text-foreground">
          Financial Relationships
        </h3>
        {data?.familyName && (
          <span className="text-xs text-muted-foreground">· {data.familyName}</span>
        )}
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          title="Edit relationships"
        >
          <Settings2 className="h-3 w-3" /> Edit
        </button>
      </div>

      {loading || !data || !me ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : me.computed_role === "individual" ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            This member is not part of a family. They pay their own subscription.
          </p>
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Assign to a family →
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* SPONSORS */}
          {(sponsors.length > 0 || individualSponsors.length > 0) && (
            <section>
              <SectionHeader
                label="Sponsors"
                count={sponsors.length + individualSponsors.length}
              />
              <div className="space-y-3 mt-2">
                {sponsors.map((s) => (
                  <SponsorCard
                    key={s.id}
                    sponsor={s}
                    dependents={dependents.filter((d) => d.sponsored_by === s.id)}
                    highlight={s.id === memberId}
                  />
                ))}
                {individualSponsors.map((s) => (
                  <IndividualSponsorCard key={s.id} sponsor={s} highlight={s.id === memberId} />
                ))}
              </div>
            </section>
          )}

          {/* DEPENDENTS */}
          {dependents.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Dependents · {dependents.length}</span>
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {expanded && (
                <div className="space-y-2 mt-2">
                  {dependents.map((d) => (
                    <DependentCard
                      key={d.id}
                      dep={d}
                      sponsor={data.members.find((m) => m.id === d.sponsored_by) ?? null}
                      highlight={d.id === memberId}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* FAMILY TOTALS */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Family Weekly Due</p>
              <p className="text-lg font-display font-semibold tabular-nums text-foreground">
                {formatUSD(data.familyWeeklyDue)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Total Family Paid</p>
              <p className="text-lg font-display font-semibold tabular-nums text-foreground">
                {formatUSD(data.totalFamilyPaid)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-muted-foreground">Family Size</p>
              <p className="text-lg font-display font-semibold tabular-nums text-foreground">
                {data.members.length}
              </p>
            </div>
          </div>
        </div>
      )}

      <FinancialRelationshipsDrawer
        memberId={memberId}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onChanged={() => {
          // Bump localKey so reload re-runs even if parent doesn't.
          setLocalKey((k) => k + 1);
          onChanged?.();
        }}
      />
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label} · {count}
    </div>
  );
}

function StripeBadge({ active, hasSubscription }: { active: boolean; hasSubscription: boolean }) {
  if (!hasSubscription) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Sponsored Account
      </span>
    );
  }
  return active ? (
    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
      Stripe Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
      Stripe Inactive
    </span>
  );
}

function BalancePill({ balance, weeksOverdue }: { balance: number; weeksOverdue: number }) {
  if (balance >= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success tabular-nums">
        <CheckCircle2 className="h-3 w-3" /> {formatUSD(balance)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive tabular-nums">
      <AlertTriangle className="h-3 w-3" /> {formatUSD(balance)}
      {weeksOverdue > 0 && <span className="text-[10px] font-normal">· {weeksOverdue}w</span>}
    </span>
  );
}

function NameLink({ id, name, currentId }: { id: string; name: string; currentId?: boolean }) {
  const inner = <span className="text-sm font-semibold text-foreground">{toTitleCase(name)}</span>;
  if (currentId) return inner;
  return (
    <Link to="/members/$memberId" params={{ memberId: id }} className="hover:underline">
      {inner}
    </Link>
  );
}

function SponsorCard({
  sponsor,
  dependents,
  highlight,
}: {
  sponsor: FamilyMemberSummary;
  dependents: FamilyMemberSummary[];
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-amber-300 bg-gradient-to-br from-amber-50/80 to-transparent dark:from-amber-950/30"
          : "border-amber-200 bg-amber-50/40 dark:bg-amber-950/15"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-600" />
          <NameLink id={sponsor.id} name={sponsor.name} currentId={highlight} />
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
            Sponsor
          </span>
          <StripeBadge active={sponsor.subscription_active} hasSubscription={!!sponsor.stripe_subscription_id} />
        </div>
        <BalancePill balance={sponsor.balance} weeksOverdue={sponsor.weeks_overdue} />
      </div>

      {dependents.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Pays for:{" "}
          <span className="text-foreground font-medium">
            {[sponsor.name, ...dependents.map((d) => d.name)].map(toTitleCase).join(", ")}
          </span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        <Metric label="Weekly Responsibility" value={formatUSD(sponsor.weekly_responsibility)} />
        <Metric label="Personal Paid" value={formatUSD(sponsor.personal_paid + sponsor.paid_by_others)} />
        <Metric label="Dependents Paid" value={formatUSD(Math.max(0, sponsor.sponsor_total - (sponsor.personal_paid + sponsor.paid_by_others)))} />
        <Metric label="Sponsor Total" value={formatUSD(sponsor.sponsor_total)} highlight />
      </div>
    </div>
  );
}

function IndividualSponsorCard({
  sponsor,
  highlight,
}: {
  sponsor: FamilyMemberSummary;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-violet-300 bg-gradient-to-br from-violet-50/80 to-transparent dark:from-violet-950/30"
          : "border-violet-200 bg-violet-50/40 dark:bg-violet-950/15"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-violet-600" />
          <NameLink id={sponsor.id} name={sponsor.name} currentId={highlight} />
          <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:text-violet-200">
            Individual Sponsor
          </span>
          <StripeBadge active={sponsor.subscription_active} hasSubscription={!!sponsor.stripe_subscription_id} />
        </div>
        <BalancePill balance={sponsor.balance} weeksOverdue={sponsor.weeks_overdue} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">Pays only for: <span className="text-foreground font-medium">{toTitleCase(sponsor.name)}</span></p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        <Metric label="Weekly Responsibility" value={formatUSD(sponsor.weekly_responsibility)} />
        <Metric label="Personal Paid" value={formatUSD(sponsor.personal_paid)} />
        <Metric label="Paid for Family" value={formatUSD(sponsor.paid_for_others)} />
        <Metric label="Sponsor Total" value={formatUSD(sponsor.sponsor_total)} highlight />
      </div>
    </div>
  );
}

function DependentCard({
  dep,
  sponsor,
  highlight,
}: {
  dep: FamilyMemberSummary;
  sponsor: FamilyMemberSummary | null;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-blue-300 bg-blue-50/60 dark:bg-blue-950/20" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <UserIcon className="h-4 w-4 text-blue-600" />
          <NameLink id={dep.id} name={dep.name} currentId={highlight} />
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-200">
            Dependent
          </span>
        </div>
        <BalancePill balance={dep.balance} weeksOverdue={dep.weeks_overdue} />
      </div>
      {sponsor && (
        <p className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
          <CreditCard className="h-3 w-3" /> Paid by{" "}
          <Link
            to="/members/$memberId"
            params={{ memberId: sponsor.id }}
            className="text-foreground font-medium hover:underline"
          >
            {toTitleCase(sponsor.name)}
          </Link>
        </p>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <Metric label="Weekly" value={formatUSD(dep.weekly_due)} />
        <Metric label="Paid by Sponsor" value={formatUSD(dep.paid_by_others)} />
        <Metric label="Balance" value={formatUSD(dep.balance)} />
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
