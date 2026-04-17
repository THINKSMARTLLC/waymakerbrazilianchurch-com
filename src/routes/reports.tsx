import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DollarSign, CreditCard, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios — ChurchFlow" },
      { name: "description", content: "Relatórios financeiros e doações" },
    ],
  }),
  component: ReportsPage,
});

type FilterRange = "this_month" | "last_month" | "custom";

interface PaymentWithMember {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  members: { name: string } | null;
}

function getDateRange(filter: FilterRange) {
  const now = new Date();
  if (filter === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

function ReportsPage() {
  const [filter, setFilter] = useState<FilterRange>("this_month");
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { start, end } = getDateRange(filter);
      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_method, payment_date, status, members(name)")
        .gte("payment_date", start)
        .lte("payment_date", end)
        .order("payment_date", { ascending: false });
      setPayments((data as PaymentWithMember[]) || []);
      setLoading(false);
    }
    fetch();
  }, [filter]);

  const paid = payments.filter((p) => p.status === "paid");
  const pastDue = payments.filter((p) => p.status === "past_due");
  const cardTotal = paid.filter((p) => p.payment_method === "stripe").reduce((s, p) => s + Number(p.amount), 0);
  const cashTotal = paid.filter((p) => p.payment_method === "cash").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { value: "this_month" as const, label: "Este Mês" },
          { value: "last_month" as const, label: "Mês Passado" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Membros Pagos</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{paid.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />Em Atraso</div>
          <p className="mt-1 font-display text-2xl font-semibold text-destructive">{pastDue.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" />Doações Cartão</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatUSD(cardTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Doações Dinheiro</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatUSD(cashTotal)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="card-elevated overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-display text-base font-medium text-foreground">Membros Pagos</h3>
            </div>
            {paid.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento neste período.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="table-header px-5 py-3 text-left">Nome</th>
                    <th className="table-header px-5 py-3 text-left">Valor</th>
                    <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Método</th>
                    <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{p.members?.name || "—"}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{formatUSD(p.amount)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{p.payment_method === "stripe" ? "Cartão" : "Dinheiro"}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{new Date(p.payment_date).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pastDue.length > 0 && (
            <div className="card-elevated overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="font-display text-base font-medium text-destructive">Membros em Atraso</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="table-header px-5 py-3 text-left">Nome</th>
                    <th className="table-header px-5 py-3 text-left">Valor</th>
                    <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pastDue.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{p.members?.name || "—"}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{formatUSD(p.amount)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{new Date(p.payment_date).toLocaleDateString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
