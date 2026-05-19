import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users as UsersIcon, Crown, CreditCard, Settings2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatUSD, toTitleCase } from "@/lib/format";
import {
  getFamilyHierarchy,
  type FamilyHierarchy,
  type FamilyMemberSummary,
  roleBadgeClasses,
  roleLabel,
} from "@/lib/familyHierarchy";
import { FinancialRelationshipsDrawer } from "@/components/FinancialRelationshipsDrawer";

interface Props {
  memberId: string;
  /** Bump this number from the parent to force a re-fetch. */
  reloadKey?: number;
  /** Called when the edit drawer mutates relationships. */
  onChanged?: () => void;
}

export function FamilyHierarchyPanel({ memberId, reloadKey, onChanged }: Props) {
  const [data, setData] = useState<FamilyHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [expanded, setExpanded] = useState(true);

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
  }, [memberId, reloadKey]);

  const me = data?.members.find((m) => m.id === memberId) ?? null;
  const sponsor = data?.members.find((m) => m.id === data.sponsorId) ?? null;
  const isSponsor = !!me && me.computed_role === "sponsor";
  const dependents = data?.members.filter((m) => m.computed_role === "dependent") ?? [];

  // Consolidated total for sponsor view (own + all dependents)
  const sponsorTotal = isSponsor
    ? (me?.personal_paid ?? 0) +
      dependents.reduce((s, d) => s + d.personal_paid + d.paid_by_others, 0)
    : 0;

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2 mb-4">
        <UsersIcon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-medium text-foreground">
          Financial Relationships
        </h3>
        {me && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClasses(
              me.computed_role,
            )}`}
          >
            {me.computed_role === "sponsor" && <Crown className="h-3 w-3" />}
            {roleLabel(me.computed_role)}
          </span>
        )}
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
      ) : me.computed_role === "dependent" ? (
        <DependentView me={me} sponsor={sponsor} />
      ) : (
        <SponsorView
          me={me}
          dependents={dependents}
          consolidatedTotal={sponsorTotal}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      )}

      <FinancialRelationshipsDrawer
        memberId={memberId}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onChanged={() => {
          reload();
          onChanged?.();
        }}
      />
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

function DependentView({ me, sponsor }: { me: FamilyMemberSummary; sponsor: FamilyMemberSummary | null }) {
  return (
    <div className="space-y-3">
      {sponsor && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <CreditCard className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Paid by Sponsor
            </span>
          </div>
          <Link
            to="/members/$memberId"
            params={{ memberId: sponsor.id }}
            className="flex items-center justify-between hover:underline"
          >
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">{toTitleCase(sponsor.name)}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              View sponsor →
            </span>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-3">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Weekly Due</p>
          <p className="text-sm font-semibold tabular-nums">{formatUSD(me.weekly_due)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Paid by Sponsor</p>
          <p className="text-sm font-semibold tabular-nums">{formatUSD(me.paid_by_others)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Balance</p>
          <BalancePill balance={me.balance} weeksOverdue={me.weeks_overdue} />
        </div>
      </div>
    </div>
  );
}

function SponsorView({
  me,
  dependents,
  consolidatedTotal,
  expanded,
  onToggle,
}: {
  me: FamilyMemberSummary;
  dependents: FamilyMemberSummary[];
  consolidatedTotal: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Sponsor own card */}
      <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">{toTitleCase(me.name)}</span>
            <StripeBadge active={me.subscription_active} hasSubscription={!!me.stripe_subscription_id} />
          </div>
          <BalancePill balance={me.balance} weeksOverdue={me.weeks_overdue} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <p className="text-muted-foreground">Personal Paid</p>
            <p className="font-semibold tabular-nums text-foreground">{formatUSD(me.personal_paid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Paid for Family</p>
            <p className="font-semibold tabular-nums text-foreground">{formatUSD(me.paid_for_others)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Weekly Due</p>
            <p className="font-semibold tabular-nums text-foreground">{formatUSD(me.weekly_due)}</p>
          </div>
        </div>
      </div>

      {/* Dependents */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Dependents · {dependents.length}</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {dependents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No dependents linked.</p>
          ) : (
            dependents.map((d) => (
              <Link
                key={d.id}
                to="/members/$memberId"
                params={{ memberId: d.id }}
                className="block rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {toTitleCase(d.name)}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClasses("dependent")}`}>
                      Dependent
                    </span>
                    <StripeBadge active={d.subscription_active} hasSubscription={!!d.stripe_subscription_id} />
                  </div>
                  <BalancePill balance={d.balance} weeksOverdue={d.weeks_overdue} />
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Weekly</p>
                    <p className="font-medium tabular-nums">{formatUSD(d.weekly_due)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid by Sponsor</p>
                    <p className="font-medium tabular-nums">{formatUSD(d.paid_by_others)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Personal</p>
                    <p className="font-medium tabular-nums">{formatUSD(d.personal_paid)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Consolidated total */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Total Paid (Sponsor + Family)</p>
          <p className="text-lg font-display font-semibold tabular-nums text-foreground">
            {formatUSD(consolidatedTotal)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Family Size</p>
          <p className="text-lg font-display font-semibold tabular-nums text-foreground">
            {dependents.length + 1}
          </p>
        </div>
      </div>
    </div>
  );
}
