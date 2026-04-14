import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, DollarSign, Mail, Phone, User } from "lucide-react";

export const Route = createFileRoute("/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Member Profile — ChurchFlow" },
      { name: "description", content: "View member profile and payment history" },
    ],
  }),
  component: MemberProfilePage,
});

const mockPayments = [
  { id: "1", date: "2024-12-01", amount: 100, method: "stripe", status: "paid" as const },
  { id: "2", date: "2024-11-01", amount: 100, method: "stripe", status: "paid" as const },
  { id: "3", date: "2024-10-01", amount: 100, method: "cash", status: "paid" as const },
  { id: "4", date: "2024-09-01", amount: 100, method: "stripe", status: "paid" as const },
  { id: "5", date: "2024-08-01", amount: 50, method: "cash", status: "paid" as const },
];

function MemberProfilePage() {
  const { memberId } = Route.useParams();

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Members
      </Link>

      {/* Member Info */}
      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-primary">
            SJ
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">Sarah Johnson</h2>
            <div className="mt-2 space-y-1.5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> sarah@email.com
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" /> (555) 123-4567
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" /> Card Payment
              </p>
            </div>
          </div>
          <span className="status-badge status-active">Active</span>
        </div>
      </div>

      {/* Subscription */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-medium text-foreground">Subscription</h3>
          <span className="status-badge status-active">Active</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Monthly recurring donation of <span className="font-semibold text-foreground">$100.00</span>
        </p>
        <div className="flex gap-3">
          <button className="btn-google inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Start Recurring Giving
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <DollarSign className="h-4 w-4" />
            Add Cash Donation
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-medium text-foreground">Payment History</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="table-header px-5 py-3 text-left">Date</th>
              <th className="table-header px-5 py-3 text-left">Amount</th>
              <th className="table-header px-5 py-3 text-left">Method</th>
              <th className="table-header px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockPayments.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-sm text-foreground">
                  {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-foreground">${p.amount.toFixed(2)}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground capitalize">{p.method}</td>
                <td className="px-5 py-3">
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
