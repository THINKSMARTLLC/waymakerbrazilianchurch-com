import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, onClick }: StatCardProps) {
  const interactive = !!onClick;
  const Wrapper: "button" | "div" = interactive ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`stat-card text-left w-full ${interactive ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trendUp ? "text-success" : "text-destructive"}`}>
          {trend}
        </p>
      )}
    </Wrapper>
  );
}
