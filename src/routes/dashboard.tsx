import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { NewSignupsBanner } from "@/components/NewSignupsBanner";
import { UpcomingBirthdays } from "@/components/UpcomingBirthdays";
import { BirthdayLoginAlert } from "@/components/BirthdayLoginAlert";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { getWeeklyExpectedTarget } from "@/lib/settings";

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
    supportedByOthers: 0,
    payingForFamily: 0,
    totalSponsored: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, monthRes, relRes] = await Promise.all([
        supabase.from("members").select("id"),
        supabase.from("payments").select("amount").gte("payment_date", startOfMonth).eq("status", "paid"),
        supabase.from("payments").select("payer_member_id, beneficiary_member_id").not("payer_member_id", "is", null).not("beneficiary_member_id", "is", null),
      ]);

      const collectedThisMonth = (monthRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Math.max(weeklyExpected * 4 - collectedThisMonth, 0);

      const beneficiaries = new Set<string>();
      const payers = new Set<string>();
      const sponsored = new Set<string>();
      for (const r of relRes.data || []) {
        if (r.payer_member_id !== r.beneficiary_member_id) {
          payers.add(r.payer_member_id as string);
          beneficiaries.add(r.beneficiary_member_id as string);
          sponsored.add(r.beneficiary_member_id as string);
        }
      }

      setStats({
        totalMembers: (membersRes.data || []).length,
        collectedThisMonth,
        outstanding,
        supportedByOthers: beneficiaries.size,
        payingForFamily: payers.size,
        totalSponsored: sponsored.size,
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
        <StatCard title={t("payerBeneficiary.supportedByOthers")} value={String(stats.supportedByOthers)} icon={Users} />
        <StatCard title={t("payerBeneficiary.payingForFamily")} value={String(stats.payingForFamily)} icon={Users} />
        <StatCard title={t("payerBeneficiary.totalSponsored")} value={String(stats.totalSponsored)} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <UpcomingBirthdays />
        </div>
      </div>
    </div>
  );
}
