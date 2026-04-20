import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Heart, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatCard } from "@/components/StatCard";
import { JourneyPath } from "@/components/JourneyPath";
import { CheckInModal } from "@/components/CheckInModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatUSD } from "@/lib/format";
import { ACTIVITY_ICON, ACTIVITY_LABEL, calculatePoints, type ActivityType } from "@/lib/engagement";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STRIPE_CONNECTED = false;

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
}

interface ActivityRow {
  id: string;
  activity_type: ActivityType;
  activity_date: string;
  source: string;
}

export const Route = createFileRoute("/portal/")({
  component: MemberDashboard,
});

function MemberDashboard() {
  const { user } = useAuth();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>("");
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [chartData, setChartData] = useState<{ month: string; amount: number }[]>([]);
  const [recent, setRecent] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckIn, setShowCheckIn] = useState(false);

  const loadActivities = async (mid: string) => {
    const { data } = await supabase
      .from("member_activities")
      .select("id, activity_type, activity_date, source")
      .eq("member_id", mid)
      .order("activity_date", { ascending: false })
      .limit(20);
    setActivities((data ?? []) as ActivityRow[]);
  };

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: member } = await supabase
        .from("members")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) {
        setLoading(false);
        return;
      }
      setMemberId(member.id);
      setMemberName(member.name);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfChart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, payment_date, payment_method, status")
        .eq("member_id", member.id)
        .eq("status", "paid")
        .gte("payment_date", startOfChart.toISOString().split("T")[0])
        .order("payment_date", { ascending: false });

      const list = (payments || []) as Payment[];

      let week = 0;
      let month = 0;
      const buckets: { month: string; amount: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(startOfChart.getFullYear(), startOfChart.getMonth() + i, 1);
        buckets.push({ month: MONTH_LABELS[d.getMonth()], amount: 0 });
      }

      for (const p of list) {
        const d = new Date(p.payment_date);
        if (d >= startOfWeek) week += Number(p.amount);
        if (d >= startOfMonth) month += Number(p.amount);
        const diff = (d.getFullYear() - startOfChart.getFullYear()) * 12 + (d.getMonth() - startOfChart.getMonth());
        if (diff >= 0 && diff < 12) buckets[diff].amount += Number(p.amount);
      }

      setWeekTotal(week);
      setMonthTotal(month);
      setChartData(buckets);
      setRecent(list.slice(0, 5));
      await loadActivities(member.id);
      setLoading(false);
    }
    load();
  }, [user]);

  const points = calculatePoints(activities);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Olá{memberName ? `, ${memberName}` : ""} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe sua jornada, contribuições e mantenha seu perfil atualizado.
          </p>
        </div>
        {memberId && (
          <button
            onClick={() => setShowCheckIn(true)}
            className="btn-google inline-flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            Check-in na Igreja
          </button>
        )}
      </div>

      {memberId && <JourneyPath points={points} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Coletado Esta Semana" value={formatUSD(weekTotal)} icon={DollarSign} />
        <StatCard title="Doações Este Mês" value={formatUSD(monthTotal)} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 card-elevated p-5">
          <h3 className="font-display text-base font-medium text-foreground mb-4">Suas Doações Mensais</h3>
          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : !memberId ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sua conta ainda não está vinculada a um registro de membro.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 240)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "oklch(0.55 0.02 260)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "oklch(0.55 0.02 260)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip formatter={(v: number) => [formatUSD(v), "Doações"]} contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.92 0.005 240)", fontSize: "13px" }} />
                  <Bar dataKey="amount" fill="oklch(0.55 0.19 260)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-elevated p-5">
          <h3 className="font-display text-base font-medium text-foreground mb-4">Suas Contribuições</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma contribuição registrada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-foreground">{formatUSD(p.amount)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.payment_method}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.payment_date).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 pt-4 border-t border-border">
            <button
              disabled
              title="Em breve — pagamentos online ainda não estão configurados"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
            >
              <Heart className="h-4 w-4" />
              {STRIPE_CONNECTED ? "Fazer uma Doação" : "Doação Online — Em breve"}
            </button>
          </div>
        </div>
      </div>

      {memberId && (
        <div className="card-elevated p-5">
          <h3 className="font-display text-base font-medium text-foreground mb-4">Atividades Recentes</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda. Faça seu primeiro check-in!
            </p>
          ) : (
            <ul className="space-y-2">
              {activities.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden>{ACTIVITY_ICON[a.activity_type]}</span>
                    <div>
                      <p className="font-medium text-foreground">{ACTIVITY_LABEL[a.activity_type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.source === "self_checkin" ? "Self check-in" : "Registrado pela liderança"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.activity_date).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showCheckIn && memberId && (
        <CheckInModal
          memberId={memberId}
          memberName={memberName}
          onClose={() => setShowCheckIn(false)}
          onSuccess={() => memberId && loadActivities(memberId)}
        />
      )}
    </div>
  );
}
