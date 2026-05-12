import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Users, AlertCircle, Plus, MapPin, Calendar, Settings2, Pencil, X, Check, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import {
  ACTIVITY_LABEL,
  ACTIVITY_ICON,
  ACTIVITY_POINTS,
  computeEngagementLevel,
  daysSince,
  formatLocalDate,
  parseLocalDate,
  type ActivityType,
} from "@/lib/engagement";
import { RegisterActivityModal } from "@/components/RegisterActivityModal";
import { EditActivityModal } from "@/components/EditActivityModal";
import { EventTypeManagerModal } from "@/components/EventTypeManagerModal";
import { toTitleCase } from "@/lib/format";

export const Route = createFileRoute("/engagement/")({
  head: () => ({
    meta: [
      { title: "Engajamento — Way Maker Church" },
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
  notes: string | null;
  event_type_id: string | null;
  status: "pending" | "approved" | "rejected";
  photo_url: string | null;
}

interface EventTypeRow {
  id: string;
  name: string;
  category: string;
  base_activity_type: ActivityType;
  icon: string | null;
  active: boolean;
}

type CardFilter = "all" | "checkins7" | "activities30" | "active" | "inactive";
type LevelFilter = "all" | "high" | "medium" | "low" | "inactive";

function EngagementDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | "all">("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRegister, setShowRegister] = useState<{ memberId: string; memberName: string } | null>(null);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [showEventManager, setShowEventManager] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(30);

  const load = async () => {
    setLoading(true);
    const [mRes, aRes, sRes, eRes] = await Promise.all([
      supabase.from("members").select("id, name, email, status").eq("status", "active").order("name"),
      supabase
        .from("member_activities")
        .select("id, member_id, activity_type, activity_date, source, created_at, notes, event_type_id, status, photo_url")
        .order("activity_date", { ascending: false }),
      supabase.from("church_settings").select("inactivity_days").maybeSingle(),
      supabase.from("event_types").select("id, name, category, base_activity_type, icon, active").order("name"),
    ]);
    setMembers((mRes.data ?? []) as MemberRow[]);
    setActivities((aRes.data ?? []) as ActivityRow[]);
    setInactivityDays(sRes.data?.inactivity_days ?? 30);
    setEventTypes((eRes.data ?? []) as EventTypeRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Filter activities by advanced filters (type/event/date)
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (activityTypeFilter !== "all" && a.activity_type !== activityTypeFilter) return false;
      if (eventTypeFilter !== "all" && a.event_type_id !== eventTypeFilter) return false;
      if (dateFrom && a.activity_date < dateFrom) return false;
      if (dateTo && a.activity_date > dateTo) return false;
      return true;
    });
  }, [activities, activityTypeFilter, eventTypeFilter, dateFrom, dateTo]);

  const perMember = useMemo(() => {
    const map = new Map<string, { last: string | null; count7: number; count30: number; total: number; points: number }>();
    for (const m of members) {
      map.set(m.id, { last: null, count7: 0, count30: 0, total: 0, points: 0 });
    }
    for (const a of filteredActivities) {
      if (a.status !== "approved") continue; // only approved counts toward engagement & points
      const entry = map.get(a.member_id);
      if (!entry) continue;
      entry.total += 1;
      entry.points += ACTIVITY_POINTS[a.activity_type] ?? 0;
      if (!entry.last || a.activity_date > entry.last) entry.last = a.activity_date;
      const days = daysSince(a.activity_date) ?? 9999;
      if (days <= 7) entry.count7 += 1;
      if (days <= 30) entry.count30 += 1;
    }
    return map;
  }, [members, filteredActivities]);


  const totalCheckinsWeek = useMemo(
    () => filteredActivities.filter((a) => (daysSince(a.activity_date) ?? 9999) <= 7).length,
    [filteredActivities],
  );
  const totalCheckinsMonth = useMemo(
    () => filteredActivities.filter((a) => (daysSince(a.activity_date) ?? 9999) <= 30).length,
    [filteredActivities],
  );

  const inactiveCount = useMemo(() => {
    let count = 0;
    perMember.forEach((v) => {
      if (computeEngagementLevel(v.last, inactivityDays).level === "inactive") count += 1;
    });
    return count;
  }, [perMember, inactivityDays]);

  const activeCount = members.length - inactiveCount;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const stats = perMember.get(m.id);
      const lvl = computeEngagementLevel(stats?.last ?? null, inactivityDays).level;

      if (cardFilter === "checkins7" && (stats?.count7 ?? 0) === 0) return false;
      if (cardFilter === "activities30" && (stats?.count30 ?? 0) === 0) return false;
      if (cardFilter === "active" && lvl === "inactive") return false;
      if (cardFilter === "inactive" && lvl !== "inactive") return false;

      if (levelFilter !== "all" && lvl !== levelFilter) return false;

      if (q && !m.name.toLowerCase().includes(q) && !(m.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, perMember, cardFilter, levelFilter, search, inactivityDays]);

  const hasAdvancedFilters =
    activityTypeFilter !== "all" || eventTypeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const clearAdvanced = () => {
    setActivityTypeFilter("all");
    setEventTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const reviewActivity = async (id: string, decision: "approved" | "rejected") => {
    const { error } = await supabase
      .from("member_activities")
      .update({
        status: decision,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        approved_by: decision === "approved" ? user?.id ?? null : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "approved" ? "Atividade aprovada" : "Atividade rejeitada");
    load();
  };

  const pendingActivities = useMemo(
    () => activities.filter((a) => a.status === "pending"),
    [activities],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Engajamento</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral da presença e atividade dos membros.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEventManager(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
            Tipos de Evento
          </button>
          <Link to="/engagement/visits" className="btn-google inline-flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Visitas
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Check-ins (7 dias)"
          value={String(totalCheckinsWeek)}
          icon={MapPin}
          onClick={() => setCardFilter(cardFilter === "checkins7" ? "all" : "checkins7")}
        />
        <StatCard
          title={t("engagementPage.activitiesMonth")}
          value={String(totalCheckinsMonth)}
          icon={Activity}
          onClick={() => setCardFilter(cardFilter === "activities30" ? "all" : "activities30")}
        />
        <StatCard
          title={t("engagementPage.activeMembers")}
          value={String(activeCount)}
          icon={Users}
          onClick={() => setCardFilter(cardFilter === "active" ? "all" : "active")}
        />
        <StatCard
          title={t("engagementPage.noActivity")}
          value={String(inactiveCount)}
          icon={AlertCircle}
          onClick={() => setCardFilter(cardFilter === "inactive" ? "all" : "inactive")}
        />
      </div>

      {pendingActivities.length > 0 && (
        <div className="card-elevated p-5 border-l-4 border-warning">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="font-display text-base font-medium text-foreground">
                {t("engagementPage.pendingActivities", { count: pendingActivities.length })}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">{t("engagementPage.approveAddsPoints")}</p>
          </div>
          <ul className="space-y-2">
            {pendingActivities.slice(0, 10).map((a) => {
              const member = members.find((m) => m.id === a.member_id);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg" aria-hidden>{ACTIVITY_ICON[a.activity_type]}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member ? toTitleCase(member.name) : "—"} · {ACTIVITY_LABEL[a.activity_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatLocalDate(a.activity_date)}
                        {a.notes && ` · ${a.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.photo_url && (
                      <a href={a.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {t("engagementPage.photo")}
                      </a>
                    )}
                    <button
                      onClick={() => reviewActivity(a.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-lg bg-success/15 text-success px-2 py-1 text-xs font-medium hover:bg-success/25"
                    >
                      <Check className="h-3 w-3" /> {t("engagementPage.approve")}
                    </button>
                    <button
                      onClick={() => reviewActivity(a.id, "rejected")}
                      className="inline-flex items-center gap-1 rounded-lg bg-destructive/15 text-destructive px-2 py-1 text-xs font-medium hover:bg-destructive/25"
                    >
                      <XCircle className="h-3 w-3" /> {t("engagementPage.reject")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {cardFilter !== "all" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t("engagementPage.activeFilterLabel")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 font-medium">
            {cardFilter === "checkins7" && t("engagementPage.checkins7")}
            {cardFilter === "activities30" && t("engagementPage.activities30")}
            {cardFilter === "active" && t("engagementPage.activeFilter")}
            {cardFilter === "inactive" && t("engagementPage.inactiveFilter")}
            <button onClick={() => setCardFilter("all")} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Advanced filters */}
      <div className="card-elevated p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de atividade</label>
            <select
              value={activityTypeFilter}
              onChange={(e) => setActivityTypeFilter(e.target.value as ActivityType | "all")}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">Todos</option>
              {(["attendance", "cell_group", "visit_scheduled", "leadership_contact"] as ActivityType[]).map((t) => (
                <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Evento</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">Todos</option>
              {eventTypes.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.icon ?? ""} {ev.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Engajamento</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">Todos</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>
        {hasAdvancedFilters && (
          <button
            onClick={clearAdvanced}
            className="mt-3 text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Limpar filtros avançados
          </button>
        )}
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border flex flex-wrap items-center gap-3">
          <h3 className="font-display text-base font-medium text-foreground">Membros</h3>
          <div className="ml-auto">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
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
                        {stats.last ? `${formatLocalDate(stats.last)} (${ds}d atrás)` : "—"}
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
          </div>
        )}
      </div>

      <div className="card-elevated p-5">
        <h3 className="font-display text-base font-medium text-foreground mb-4">
          Atividades Recentes {hasAdvancedFilters && <span className="text-xs font-normal text-muted-foreground">(filtradas)</span>}
        </h3>
        {filteredActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
        ) : (
          <ul className="space-y-2">
            {[...filteredActivities]
              .sort((a, b) => {
                // chronological order: most recent first; tiebreaker by created_at
                if (a.activity_date !== b.activity_date) return a.activity_date < b.activity_date ? 1 : -1;
                return a.created_at < b.created_at ? 1 : -1;
              })
              .slice(0, 20)
              .map((a) => {
                const member = members.find((m) => m.id === a.member_id);
                const ev = a.event_type_id ? eventTypes.find((e) => e.id === a.event_type_id) : null;
                return (
                  <li key={a.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg" aria-hidden>{ev?.icon ?? ACTIVITY_ICON[a.activity_type]}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {member ? toTitleCase(member.name) : "—"} · {ev?.name ?? ACTIVITY_LABEL[a.activity_type]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.source === "self_checkin" ? "Self check-in" : "Registro manual"}
                          {a.notes && ` · ${a.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatLocalDate(a.activity_date)}</span>
                      <button
                        onClick={() => setEditing(a)}
                        className="text-muted-foreground hover:text-primary p-1 rounded"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

      {editing && (
        <EditActivityModal
          activity={editing}
          memberName={toTitleCase(members.find((m) => m.id === editing.member_id)?.name ?? "—")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {showEventManager && (
        <EventTypeManagerModal
          onClose={() => setShowEventManager(false)}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}

// silence unused param warning when parseLocalDate is not used directly here
void parseLocalDate;
