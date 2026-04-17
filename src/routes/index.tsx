import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { NewSignupsBanner } from "@/components/NewSignupsBanner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";

export const Route = createFileRoute("/")({
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
  const [stats, setStats] = useState({
    totalMembers: 0,
    weeklyExpected: 0,
    collectedThisMonth: 0,
    outstanding: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

      const [membersRes, monthRes, recentRes] = await Promise.all([
        supabase.from("members").select("id, weekly_contribution_usd, status"),
        supabase.from("payments").select("amount").gte("payment_date", startOfMonth).eq("status", "paid"),
        supabase.from("payments").select("amount").gte("payment_date", fourWeeksAgoStr).eq("status", "paid"),
      ]);

      const activeMembers = (membersRes.data || []).filter((m) => m.status === "active");
      const expectedWeekly = activeMembers.reduce((s, m) => s + Number(m.weekly_contribution_usd || 0), 0);

      // Weekly Expected = average of last 4 weeks of real payments
      const recentTotal = (recentRes.data || []).reduce((s, p) => s + Number(p.amount), 0);
      const weeklyExpected = recentTotal / 4;

      const collectedThisMonth = (monthRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      // Outstanding = expected monthly contributions - collected this month
      const outstanding = Math.max(expectedWeekly * 4 - collectedThisMonth, 0);

      setStats({
        totalMembers: (membersRes.data || []).length,
        weeklyExpected,
        collectedThisMonth,
        outstanding,
      });
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <NewSignupsBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={String(stats.totalMembers)} icon={Users} />
        <StatCard title="Weekly Expected (avg 4w)" value={formatUSD(stats.weeklyExpected)} icon={TrendingUp} />
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
