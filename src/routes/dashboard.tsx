import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { NewSignupsBanner } from "@/components/NewSignupsBanner";
import { UpcomingBirthdays } from "@/components/UpcomingBirthdays";
import { BirthdayLoginAlert } from "@/components/BirthdayLoginAlert";
import { AbsentMembers } from "@/components/AbsentMembers";
import { RecentContributions } from "@/components/RecentContributions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { getWeeklyExpectedTarget, calculateExpectedMonthlyAmount } from "@/lib/settings";
import { getThisMonthSummary } from "@/lib/financialSummary";
import { computeFamilyRoleMap } from "@/lib/familyComputedRoles";
import { subscribeToFamilyFinancialsUpdated } from "@/lib/familySync";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Way Maker Church" },
      { name: "description", content: "Church financial management dashboard" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const weeklyExpected = getWeeklyExpectedTarget();
  const [stats, setStats] = useState({
    totalMembers: 0,
    collectedThisMonth: 0,
    outstanding: 0,
    activeFamilies: 0,
    payingForFamily: 0,
    sponsored: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();

      const [membersRes, summary] = await Promise.all([
        supabase.from("members").select("id, name, family_id, family_role, subscription_active, stripe_subscription_id, created_at, status"),
        getThisMonthSummary(),
      ]);

      const monthlyExpected = calculateExpectedMonthlyAmount(weeklyExpected, now.getMonth() + 1, now.getFullYear());
      const collectedThisMonth = summary.total;
      const outstanding = Math.max(monthlyExpected - collectedThisMonth, 0);

      const list = membersRes.data || [];
      const ids = list.map((member) => member.id as string);
      let computedRoleMap = new Map<string, { computedRole: "sponsor" | "individual_sponsor" | "dependent" | "individual" }>();
      if (ids.length > 0) {
        const { data: relationshipRows } = await supabase
          .from("payment_relationships")
          .select("payer_member_id, beneficiary_member_id")
          .or(ids.map((id) => `payer_member_id.eq.${id},beneficiary_member_id.eq.${id}`).join(","));
        computedRoleMap = computeFamilyRoleMap(list, (relationshipRows ?? []) as Array<{ payer_member_id: string; beneficiary_member_id: string }>);
      }

      const activeFamilyIds = new Set<string>();
      let payingForFamily = 0;
      let sponsored = 0;
      for (const m of list) {
        if (m.status === "active" && m.family_id) activeFamilyIds.add(m.family_id as string);
        const computedRole = computedRoleMap.get(m.id as string)?.computedRole;
        if (computedRole === "sponsor") payingForFamily += 1;
        if (computedRole === "dependent") sponsored += 1;
      }

      setStats({
        totalMembers: list.length,
        collectedThisMonth,
        outstanding,
        activeFamilies: activeFamilyIds.size,
        payingForFamily,
        sponsored,
      });
    }
    fetchStats();

    const unsubscribe = subscribeToFamilyFinancialsUpdated(() => {
      fetchStats();
    });

    return unsubscribe;
  }, [weeklyExpected]);

  return (
    <div className="space-y-6">
      <BirthdayLoginAlert />
      <NewSignupsBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dashboard.totalMembers")}
          value={String(stats.totalMembers)}
          icon={Users}
          onClick={() => navigate({ to: "/members" })}
        />
        <StatCard
          title={t("dashboard.weeklyExpected")}
          value={formatUSD(weeklyExpected)}
          icon={TrendingUp}
          onClick={() => navigate({ to: "/reports", search: { range: "all" } as never })}
        />
        <StatCard
          title={t("dashboard.collectedThisMonth")}
          value={formatUSD(stats.collectedThisMonth)}
          icon={DollarSign}
          onClick={() => navigate({ to: "/reports", search: { range: "this_month" } as never })}
        />
        <StatCard
          title={t("dashboard.outstanding")}
          value={formatUSD(stats.outstanding)}
          icon={AlertTriangle}
          onClick={() => navigate({ to: "/members", search: { status: "late" } as never })}
        />
      </div>

      {/* Chart + Absent Members (matches reference layout) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DonationsChart />
        </div>
        <AbsentMembers />
      </div>

      {/* Birthdays + Recent Contributions (matches reference layout) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingBirthdays />
        <RecentContributions />
      </div>

      {/* Family stats removed — individual-only system */}
      <div className="grid gap-6">
        <QuickActions />
      </div>

    </div>
  );
}
