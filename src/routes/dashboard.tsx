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
import { getMonthlyRevenue } from "@/lib/finance";
import { getWeeklyExpectedTarget, calculateExpectedMonthlyAmount } from "@/lib/settings";
import { getMonthlyRevenue } from "@/lib/finance";

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

      const [membersRes, collectedThisMonth] = await Promise.all([
        supabase.from("members").select("id, family_id, family_role, status"),
        getMonthlyRevenue(now.getMonth() + 1, now.getFullYear()),
      ]);

      const monthlyExpected = calculateExpectedMonthlyAmount(weeklyExpected, now.getMonth() + 1, now.getFullYear());
      const outstanding = Math.max(monthlyExpected - collectedThisMonth, 0);

      const list = membersRes.data || [];
      const activeFamilyIds = new Set<string>();
      let payingForFamily = 0;
      let sponsored = 0;
      for (const m of list) {
        if (m.status === "active" && m.family_id) activeFamilyIds.add(m.family_id as string);
        if (m.family_role === "family_owner") payingForFamily += 1;
        if (m.family_role === "sponsored") sponsored += 1;
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DonationsChart />
        </div>
        <QuickActions />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("payerBeneficiary.activeFamilies")}
          value={String(stats.activeFamilies)}
          icon={Users}
          onClick={() => navigate({ to: "/members", search: { group: "family" } as never })}
        />
        <StatCard
          title={t("payerBeneficiary.payingForFamily")}
          value={String(stats.payingForFamily)}
          icon={Users}
          onClick={() => navigate({ to: "/members", search: { group: "family" } as never })}
        />
        <StatCard
          title={t("payerBeneficiary.totalSponsored")}
          value={String(stats.sponsored)}
          icon={Users}
          onClick={() => navigate({ to: "/members", search: { group: "family" } as never })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <UpcomingBirthdays />
        </div>
      </div>
    </div>
  );
}
