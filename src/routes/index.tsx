import { createFileRoute } from "@tanstack/react-router";
import { Users, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DonationsChart } from "@/components/DonationsChart";
import { QuickActions } from "@/components/QuickActions";

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
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value="142"
          icon={Users}
          trend="+8 this month"
          trendUp
        />
        <StatCard
          title="Paid This Month"
          value="118"
          icon={DollarSign}
          trend="83% of members"
          trendUp
        />
        <StatCard
          title="Past Due"
          value="12"
          icon={AlertTriangle}
          trend="3 more than last month"
          trendUp={false}
        />
        <StatCard
          title="Total Donations"
          value="$6,420"
          icon={TrendingUp}
          trend="+12% vs last month"
          trendUp
        />
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DonationsChart />
        </div>
        <QuickActions />
      </div>
    </div>
  );
}
