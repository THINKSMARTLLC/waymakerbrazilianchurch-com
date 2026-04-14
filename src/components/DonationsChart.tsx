import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", amount: 4200 },
  { month: "Feb", amount: 3800 },
  { month: "Mar", amount: 5100 },
  { month: "Apr", amount: 4600 },
  { month: "May", amount: 5400 },
  { month: "Jun", amount: 4900 },
  { month: "Jul", amount: 5200 },
  { month: "Aug", amount: 4700 },
  { month: "Sep", amount: 5800 },
  { month: "Oct", amount: 6100 },
  { month: "Nov", amount: 5500 },
  { month: "Dec", amount: 6400 },
];

export function DonationsChart() {
  return (
    <div className="card-elevated p-5">
      <h3 className="font-display text-base font-medium text-foreground mb-4">
        Monthly Donations
      </h3>
      <div className="h-72">
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
              tickFormatter={(v) => `$${v / 1000}k`}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Donations"]}
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
      </div>
    </div>
  );
}
