import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { getMonthlyRevenueSeries } from "@/lib/finance";

interface MonthlyPoint {
  month: string;
  amount: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DonationsChart() {
  const { t } = useTranslation();
  const [data, setData] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const series = await getMonthlyRevenueSeries(12);
      const points: MonthlyPoint[] = series.map((s) => ({
        month: MONTH_LABELS[s.month - 1],
        amount: s.total,
      }));
      setData(points);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight">
            {t("dashboard.overview", { defaultValue: "Visão Geral" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("dashboard.last12Months", { defaultValue: "Últimos 12 meses" })}
          </p>
        </div>
      </div>
      <div className="h-72">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.13 80)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="oklch(0.78 0.13 80)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.012 245)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                cursor={{ stroke: "oklch(0.78 0.13 80)", strokeWidth: 1, strokeDasharray: "3 3" }}
                formatter={(value: number) => [
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value),
                  t("dashboard.donations", { defaultValue: "Contribuições" }),
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid oklch(0.91 0.012 245)",
                  boxShadow: "0 12px 32px -8px oklch(0.20 0.03 255 / 0.14)",
                  fontSize: "12px",
                  padding: "10px 12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="oklch(0.68 0.14 78)"
                strokeWidth={2.5}
                fill="url(#gradGold)"
                dot={{ r: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "oklch(1 0 0)", fill: "oklch(0.68 0.14 78)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
