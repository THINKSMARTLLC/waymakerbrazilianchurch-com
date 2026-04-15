import { createFileRoute } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    paidThisMonth: 0,
    pastDue: 0,
    totalDonations: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, paymentsRes, pastDueRes] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount").gte("payment_date", startOfMonth).eq("status", "paid"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "past_due"),
      ]);

      const totalDonations = (paymentsRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);

      setStats({
        totalMembers: membersRes.count || 0,
        paidThisMonth: (paymentsRes.data || []).length,
        pastDue: pastDueRes.count || 0,
        totalDonations,
      });
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Membros" value={String(stats.totalMembers)} icon={Users} />
        <StatCard title="Pagos Este Mês" value={String(stats.paidThisMonth)} icon={DollarSign} />
        <StatCard title="Em Atraso" value={String(stats.pastDue)} icon={AlertTriangle} />
        <StatCard
          title="Doações do Mês"
          value={`R$ ${stats.totalDonations.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
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
