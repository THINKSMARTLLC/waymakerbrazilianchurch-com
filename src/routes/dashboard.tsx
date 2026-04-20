import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { NewSignupsBanner } from "@/components/NewSignupsBanner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { getWeeklyExpectedTarget } from "@/lib/settings";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WAY MAKER FLOW" },
      { name: "description", content: "Church financial management dashboard" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const weeklyExpected = getWeeklyExpectedTarget();
  const [stats, setStats] = useState({
    totalMembers: 0,
    collectedThisMonth: 0,
    outstanding: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, monthRes] = await Promise.all([
        supabase.from("members").select("id"),
        supabase.from("payments").select("amount").gte("payment_date", startOfMonth).eq("status", "paid"),
      ]);

      const collectedThisMonth = (monthRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Math.max(weeklyExpected * 4 - collectedThisMonth, 0);

      setStats({
        totalMembers: (membersRes.data || []).length,
        collectedThisMonth,
        outstanding,
      });
    }
    fetchStats();
  }, [weeklyExpected]);

  return (
    <div className="space-y-6">
      <NewSignupsBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={String(stats.totalMembers)} icon={Users} />
        <StatCard title="Weekly Expected (Target)" value={formatUSD(weeklyExpected)} icon={TrendingUp} />
        <StatCard title="Collected This Month" value={formatUSD(stats.collectedThisMonth)} icon={DollarSign} />
        <StatCard
          title="Outstanding"
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
    </div>
  );
}
