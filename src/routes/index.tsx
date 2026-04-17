import { createFileRoute } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ChurchFlow" },
      { name: "description", content: "Church financial management dashboard" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    weeklyExpected: 0,
    monthlyExpected: 0,
    collectedThisMonth: 0,
    outstanding: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, paymentsRes] = await Promise.all([
        supabase.from("members").select("id, weekly_contribution_usd, status"),
        supabase.from("payments").select("amount").gte("payment_date", startOfMonth).eq("status", "paid"),
      ]);

      const activeMembers = (membersRes.data || []).filter((m) => m.status === "active");
      const weeklyExpected = activeMembers.reduce((s, m) => s + Number(m.weekly_contribution_usd || 0), 0);
      const monthlyExpected = weeklyExpected * 4;
      const collectedThisMonth = (paymentsRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Math.max(monthlyExpected - collectedThisMonth, 0);

      setStats({
        totalMembers: (membersRes.data || []).length,
        weeklyExpected,
        monthlyExpected,
        collectedThisMonth,
        outstanding,
      });
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={String(stats.totalMembers)} icon={Users} />
        <StatCard title="Weekly Expected" value={formatUSD(stats.weeklyExpected)} icon={TrendingUp} />
        <StatCard title="Monthly Expected" value={formatUSD(stats.monthlyExpected)} icon={DollarSign} />
        <StatCard title="Collected This Month" value={formatUSD(stats.collectedThisMonth)} icon={DollarSign} />
        <StatCard title="Outstanding" value={formatUSD(stats.outstanding)} icon={AlertTriangle} />
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
