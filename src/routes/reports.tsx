import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DollarSign, CreditCard, Users, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — ChurchFlow" },
      { name: "description", content: "Financial reports and donation tracking" },
    ],
  }),
  component: ReportsPage,
});

type FilterRange = "this_month" | "last_month" | "custom";

const paidMembers = [
  { name: "Sarah Johnson", amount: 100, method: "card", date: "Dec 1, 2024" },
  { name: "Emily Davis", amount: 100, method: "card", date: "Dec 1, 2024" },
  { name: "Olivia Martinez", amount: 75, method: "card", date: "Dec 3, 2024" },
  { name: "Sophia Thomas", amount: 50, method: "cash", date: "Dec 5, 2024" },
  { name: "Daniel Anderson", amount: 100, method: "card", date: "Dec 1, 2024" },
];

const pastDueMembers = [
  { name: "James Brown", amount: 100, dueDate: "Nov 1, 2024", daysPastDue: 31 },
  { name: "David Wilson", amount: 75, dueDate: "Nov 15, 2024", daysPastDue: 17 },
];

function ReportsPage() {
  const [filter, setFilter] = useState<FilterRange>("this_month");

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "this_month" as const, label: "This Month" },
          { value: "last_month" as const, label: "Last Month" },
          { value: "custom" as const, label: "Custom Range" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Paid Members
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{paidMembers.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Past Due
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-destructive">{pastDueMembers.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Card Donations
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">$375.00</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Cash Donations
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">$50.00</p>
        </div>
      </div>

      {/* Paid Members */}
      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-medium text-foreground">Paid Members</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="table-header px-5 py-3 text-left">Name</th>
              <th className="table-header px-5 py-3 text-left">Amount</th>
              <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Method</th>
              <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {paidMembers.map((m, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{m.name}</td>
                <td className="px-5 py-3 text-sm text-foreground">${m.amount.toFixed(2)}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground capitalize hidden sm:table-cell">{m.method}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{m.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Past Due Members */}
      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-medium text-destructive">Past Due Members</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="table-header px-5 py-3 text-left">Name</th>
              <th className="table-header px-5 py-3 text-left">Amount</th>
              <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Due Date</th>
              <th className="table-header px-5 py-3 text-left">Days Past Due</th>
            </tr>
          </thead>
          <tbody>
            {pastDueMembers.map((m, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{m.name}</td>
                <td className="px-5 py-3 text-sm text-foreground">${m.amount.toFixed(2)}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{m.dueDate}</td>
                <td className="px-5 py-3">
                  <span className="status-badge status-past-due">{m.daysPastDue} days</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
