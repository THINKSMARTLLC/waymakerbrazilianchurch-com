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
      className={`stat-card text-left w-full ${interactive ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/60">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-3 font-display text-[28px] leading-tight font-bold text-foreground tracking-tight tabular-nums">
        {value}
      </p>
      {trend && (
        <p
          className={`mt-1.5 text-xs font-semibold ${
            trendUp ? "text-success" : "text-destructive"
          }`}
        >
          {trend}
        </p>
      )}
    </Wrapper>
  );
}
