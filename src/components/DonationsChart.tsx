import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyPoint {
  month: string;
  amount: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DonationsChart() {
  const [data, setData] = useState<MonthlyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Last 12 months window
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const startStr = startDate.toISOString().split("T")[0];

      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .gte("payment_date", startStr)
        .eq("status", "paid");

      // Build 12-month bucket
      const buckets: MonthlyPoint[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        buckets.push({ month: MONTH_LABELS[d.getMonth()], amount: 0 });
      }

      for (const p of payments || []) {
        const d = new Date(p.payment_date);
        const monthsDiff = (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth());
        if (monthsDiff >= 0 && monthsDiff < 12) {
          buckets[monthsDiff].amount += Number(p.amount);
        }
      }

      setData(buckets);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="card-elevated p-5">
      <h3 className="font-display text-base font-medium text-foreground mb-4">
        Monthly Donations
      </h3>
      <div className="h-72">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 240)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "oklch(0.55 0.02 260)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "oklch(0.55 0.02 260)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                formatter={(value: number) => [new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value), "Donations"]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid oklch(0.92 0.005 240)",
                  boxShadow: "0 4px 12px oklch(0 0 0 / 0.08)",
                  fontSize: "13px",
                }}
              />
              <Bar dataKey="amount" fill="oklch(0.55 0.19 260)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
