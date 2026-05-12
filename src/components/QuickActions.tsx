import { UserPlus, DollarSign, CreditCard } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function QuickActions() {
  const { t } = useTranslation();
  const actions = [
    { label: t("quickActions.addMember"), icon: UserPlus, to: "/members" as const, color: "bg-primary" },
    { label: t("quickActions.addCashOffering"), icon: DollarSign, to: "/members" as const, color: "bg-success" },
    { label: t("quickActions.createSubscription"), icon: CreditCard, to: "/members" as const, color: "bg-warning" },
  ];
  return (
    <div className="card-elevated p-5">
      <h3 className="font-display text-base font-medium text-foreground mb-4">
        {t("quickActions.title")}
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
