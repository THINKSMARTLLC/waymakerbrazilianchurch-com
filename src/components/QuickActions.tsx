import { UserPlus, DollarSign, CreditCard } from "lucide-react";
import { Link } from "@tanstack/react-router";

const actions = [
  { label: "Add Member", icon: UserPlus, to: "/members", color: "bg-primary" },
  { label: "Add Cash Offering", icon: DollarSign, to: "/members", color: "bg-success" },
  { label: "Create Subscription", icon: CreditCard, to: "/members", color: "bg-warning" },
];

export function QuickActions() {
  return (
    <div className="card-elevated p-5">
      <h3 className="font-display text-base font-medium text-foreground mb-4">
        Quick Actions
      </h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
              <action.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
