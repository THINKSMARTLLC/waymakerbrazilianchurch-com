import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, Users, AlertCircle, Plus, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import {
  ACTIVITY_LABEL,
  ACTIVITY_ICON,
  ACTIVITY_POINTS,
  calculatePoints,
  computeEngagementLevel,
  daysSince,
  type ActivityType,
} from "@/lib/engagement";
import { RegisterActivityModal } from "@/components/RegisterActivityModal";
import { toTitleCase } from "@/lib/format";

export const Route = createFileRoute("/engagement/")({
  head: () => ({
    meta: [
      { title: "Engajamento — WAY MAKER FLOW" },
      { name: "description", content: "Acompanhe o engajamento dos membros" },
    ],
  }),
  component: EngagementDashboard,
});

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
}

interface ActivityRow {
  id: string;
  member_id: string;
  activity_type: ActivityType;
  activity_date: string;
  source: string;
  created_at: string;
}

type Filter = "all" | "high" | "low" | "inactive";

function EngagementDashboard() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState<{ memberId: string; memberName: string } | null>(null);
  const [inactivityDays, setInactivityDays] = useState(30);

  const load = async () => {
    setLoading(true);
    const [mRes, aRes, sRes] = await Promise.all([
      supabase.from("members").select("id, name, email, status").eq("status", "active").order("name"),
      supabase
        .from("member_activities")
        .select("id, member_id, activity_type, activity_date, source, created_at")
        .order("activity_date", { ascending: false }),
      supabase.from("church_settings").select("inactivity_days").maybeSingle(),
    ]);
    setMembers((mRes.data ?? []) as MemberRow[]);
    setActivities((aRes.data ?? []) as ActivityRow[]);
    setInactivityDays(sRes.data?.inactivity_days ?? 30);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Aggregations per member
  const perMember = useMemo(() => {
    const map = new Map<string, { last: string | null; count7: number; count30: number; total: number; points: number }>();
    const now = Date.now();
    for (const m of members) {
      map.set(m.id, { last: null, count7: 0, count30: 0, total: 0, points: 0 });
    }
    for (const a of activities) {
      const entry = map.get(a.member_id);
      if (!entry) continue;
      entry.total += 1;
      entry.points += ACTIVITY_POINTS[a.activity_type] ?? 0;
      if (!entry.last || a.activity_date > entry.last) entry.last = a.activity_date;
      const days = (now - new Date(a.activity_date).getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) entry.count7 += 1;
      if (days <= 30) entry.count30 += 1;
    }
    return map;
  }, [members, activities]);

  // Top metrics
  const totalCheckinsWeek = useMemo(() => {
    const now = Date.now();
    return activities.filter((a) => {
      const days = (now - new Date(a.activity_date).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;
  }, [activities]);

  const totalCheckinsMonth = useMemo(() => {
    const now = Date.now();
    return activities.filter((a) => {
      const days = (now - new Date(a.activity_date).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length;
  }, [activities]);

  const inactiveCount = useMemo(() => {
    let count = 0;
    perMember.forEach((v) => {
      const lvl = computeEngagementLevel(v.last, inactivityDays).level;
      if (lvl === "inactive") count += 1;
    });
    return count;
  }, [perMember, inactivityDays]);

  const activeCount = members.length - inactiveCount;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const stats = perMember.get(m.id);
      const lvl = computeEngagementLevel(stats?.last ?? null, inactivityDays).level;
      if (filter === "high" && lvl !== "high") return false;
      if (filter === "low" && lvl !== "low" && lvl !== "medium") return false;
      if (filter === "inactive" && lvl !== "inactive") return false;
      if (q && !m.name.toLowerCase().includes(q) && !(m.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, perMember, filter, search, inactivityDays]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Engajamento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral da presença e atividade dos membros.
          </p>
        </div>
        <Link to="/engagement/visits" className="btn-google inline-flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Visitas
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Check-ins (7 dias)" value={String(totalCheckinsWeek)} icon={MapPin} />
        <StatCard title="Atividades (30 dias)" value={String(totalCheckinsMonth)} icon={Activity} />
        <StatCard title="Membros Ativos" value={String(activeCount)} icon={Users} />
        <StatCard title="Sem Atividade" value={String(inactiveCount)} icon={AlertCircle} />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border flex flex-wrap items-center gap-3">
          <h3 className="font-display text-base font-medium text-foreground">Membros</h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            />
            {(["all", "high", "low", "inactive"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {f === "all" ? "Todos" : f === "high" ? "Alto engaj." : f === "low" ? "Baixo engaj." : "Inativos"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header px-5 py-3 text-left">Membro</th>
                <th className="table-header px-5 py-3 text-left">Engajamento</th>
                <th className="table-header px-5 py-3 text-left">Última atividade</th>
                <th className="table-header px-5 py-3 text-left">Total / Pontos</th>
                <th className="table-header px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const stats = perMember.get(m.id) ?? { last: null, total: 0, points: 0, count7: 0, count30: 0 };
                const lvl = computeEngagementLevel(stats.last, inactivityDays);
                const ds = daysSince(stats.last);
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 text-sm">
                      <div className="font-medium text-foreground">{toTitleCase(m.name)}</div>
                      {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`status-badge ${lvl.className}`}>{lvl.label}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {stats.last
                        ? `${new Date(stats.last).toLocaleDateString("pt-BR")} (${ds}d atrás)`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">
                      {stats.total} ativ. · <span className="text-muted-foreground">{stats.points} pts</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setShowRegister({ memberId: m.id, memberName: toTitleCase(m.name) })}
                        className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                        Registrar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-elevated p-5">
        <h3 className="font-display text-base font-medium text-foreground mb-4">Atividades Recentes</h3>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {activities.slice(0, 12).map((a) => {
              const member = members.find((m) => m.id === a.member_id);
              return (
                <li key={a.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden>{ACTIVITY_ICON[a.activity_type]}</span>
                    <div>
                      <p className="font-medium text-foreground">
                        {member ? toTitleCase(member.name) : "—"} · {ACTIVITY_LABEL[a.activity_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.source === "self_checkin" ? "Self check-in" : "Registro manual"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.activity_date).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showRegister && (
        <RegisterActivityModal
          memberId={showRegister.memberId}
          memberName={showRegister.memberName}
          onClose={() => setShowRegister(null)}
          onSaved={() => {
            setShowRegister(null);
            load();
          }}
        />
      )}
    </div>
  );
}
