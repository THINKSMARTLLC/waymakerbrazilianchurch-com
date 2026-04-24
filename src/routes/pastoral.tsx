import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, UserX, UserPlus, AlertTriangle, Heart, Activity as ActivityIcon, ChevronRight, X, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/pastoral")({
  head: () => ({
    meta: [
      { title: "Pastoral Dashboard — Way Maker Church" },
      { name: "description", content: "Insights and alerts on member engagement" },
    ],
  }),
  component: PastoralDashboard,
});

type HealthStatus = "healthy" | "attention" | "risk";
type FilterKey = "all" | "active" | "inactive" | "risk" | "new";

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  member_id: string;
  activity_type: string;
  activity_date: string;
  source: string;
  notes: string | null;
  created_at: string;
}

interface EngagementRow {
  id: string;
  member_id: string;
  platform: string;
  action_type: string;
  points: number;
  status: string;
  created_at: string;
}

interface PastoralNoteRow {
  id: string;
  member_id: string;
  book: string;
  chapter: number;
  verse: number;
  note_text: string;
  updated_at: string;
}

interface MemberHealth {
  member: MemberRow;
  lastActivityDate: string | null;
  lastCheckinDate: string | null;
  totalPoints: number;
  daysSinceActivity: number;
  daysSinceCheckin: number;
  isNew: boolean;
  health: HealthStatus;
  alerts: string[];
}

const NEW_MEMBER_DAYS = 14;
const RISK_DAYS = 14;

function daysBetween(from: string | null): number {
  if (!from) return Infinity;
  const d = new Date(from).getTime();
  if (Number.isNaN(d)) return Infinity;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

function computeHealth(m: MemberHealth): HealthStatus {
  if (m.daysSinceActivity >= RISK_DAYS && m.daysSinceCheckin >= RISK_DAYS) return "risk";
  if (m.daysSinceActivity >= 7 || m.daysSinceCheckin >= 7) return "attention";
  return "healthy";
}

function statusBadge(h: HealthStatus) {
  if (h === "risk") return <Badge className="bg-destructive text-destructive-foreground">At Risk</Badge>;
  if (h === "attention") return <Badge className="bg-amber-500 text-white">Attention</Badge>;
  return <Badge className="bg-emerald-600 text-white">Healthy</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function PastoralDashboard() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [pastoralNotes, setPastoralNotes] = useState<PastoralNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [mRes, aRes, eRes, nRes] = await Promise.all([
      supabase.from("members").select("id, name, email, status, created_at").order("created_at", { ascending: false }),
      supabase.from("member_activities").select("id, member_id, activity_type, activity_date, source, notes, created_at").order("activity_date", { ascending: false }).limit(2000),
      supabase.from("social_engagements").select("id, member_id, platform, action_type, points, status, created_at").order("created_at", { ascending: false }).limit(2000),
      supabase
        .from("bible_notes")
        .select("id, member_id, book, chapter, verse, note_text, updated_at")
        .eq("share_with_pastor", true)
        .order("updated_at", { ascending: false })
        .limit(500),
    ]);
    setMembers(mRes.data ?? []);
    setActivities(aRes.data ?? []);
    setEngagements(eRes.data ?? []);
    setPastoralNotes((nRes.data ?? []) as PastoralNoteRow[]);
    setLoading(false);
  }

  const healthList: MemberHealth[] = useMemo(() => {
    const actByMember = new Map<string, ActivityRow[]>();
    for (const a of activities) {
      if (!actByMember.has(a.member_id)) actByMember.set(a.member_id, []);
      actByMember.get(a.member_id)!.push(a);
    }
    const engByMember = new Map<string, EngagementRow[]>();
    for (const e of engagements) {
      if (!engByMember.has(e.member_id)) engByMember.set(e.member_id, []);
      engByMember.get(e.member_id)!.push(e);
    }

    return members.map((m) => {
      const acts = actByMember.get(m.id) ?? [];
      const engs = engByMember.get(m.id) ?? [];
      const lastActivity = acts[0]?.activity_date ?? null;
      const checkins = acts.filter((a) => a.source === "self_checkin" || a.activity_type === "attendance");
      const lastCheckin = checkins[0]?.activity_date ?? null;
      const totalPoints = engs.filter((e) => e.status === "approved").reduce((s, e) => s + (e.points ?? 0), 0);
      const isNew = daysBetween(m.created_at) <= NEW_MEMBER_DAYS;

      const base: MemberHealth = {
        member: m,
        lastActivityDate: lastActivity,
        lastCheckinDate: lastCheckin,
        totalPoints,
        daysSinceActivity: daysBetween(lastActivity),
        daysSinceCheckin: daysBetween(lastCheckin),
        isNew,
        health: "healthy",
        alerts: [],
      };
      base.health = computeHealth(base);

      if (base.daysSinceActivity >= RISK_DAYS) base.alerts.push("No activity 14+ days");
      if (base.daysSinceCheckin >= RISK_DAYS) base.alerts.push("No check-in 14+ days");
      if (isNew && acts.length === 0 && engs.length === 0) base.alerts.push("New member — needs connection");

      return base;
    });
  }, [members, activities, engagements]);

  const sorted = useMemo(() => {
    const order: Record<HealthStatus, number> = { risk: 0, attention: 1, healthy: 2 };
    return [...healthList].sort((a, b) => order[a.health] - order[b.health] || a.member.name.localeCompare(b.member.name));
  }, [healthList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((h) => {
      if (q && !h.member.name.toLowerCase().includes(q) && !(h.member.email ?? "").toLowerCase().includes(q)) return false;
      if (filter === "active") return h.member.status === "active";
      if (filter === "inactive") return h.member.status !== "active";
      if (filter === "risk") return h.health === "risk";
      if (filter === "new") return h.isNew;
      return true;
    });
  }, [sorted, filter, search]);

  const stats = useMemo(() => {
    const total = members.length;
    const active7 = healthList.filter((h) => h.daysSinceActivity <= 7 || h.daysSinceCheckin <= 7).length;
    const inactive = healthList.filter((h) => h.member.status !== "active").length;
    const newCount = healthList.filter((h) => h.isNew).length;
    return { total, active7, inactive, newCount };
  }, [members, healthList]);

  const alerts = useMemo(() => {
    const noCheckin = healthList.filter((h) => h.daysSinceCheckin >= RISK_DAYS).slice(0, 8);
    const noActivity = healthList.filter((h) => h.daysSinceActivity >= RISK_DAYS).slice(0, 8);
    const newNoFollow = healthList.filter((h) => h.isNew && h.daysSinceActivity === Infinity).slice(0, 8);
    return { noCheckin, noActivity, newNoFollow };
  }, [healthList]);

  const selected = selectedId ? healthList.find((h) => h.member.id === selectedId) ?? null : null;
  const selectedActivities = selected ? activities.filter((a) => a.member_id === selected.member.id).slice(0, 30) : [];
  const selectedEngagements = selected ? engagements.filter((e) => e.member_id === selected.member.id).slice(0, 30) : [];
  const selectedNotes = selected ? pastoralNotes.filter((n) => n.member_id === selected.member.id) : [];

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown member";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Pastoral Dashboard</h1>
        <p className="text-sm text-muted-foreground">Identify who needs care, who is growing, and who is disengaging.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={String(stats.total)} icon={Users} />
        <StatCard title="Active (7 days)" value={String(stats.active7)} icon={UserCheck} />
        <StatCard title="Inactive" value={String(stats.inactive)} icon={UserX} />
        <StatCard title="New Members" value={String(stats.newCount)} icon={UserPlus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AlertCard title="No check-in 14+ days" icon={<AlertTriangle className="h-4 w-4 text-destructive" />} items={alerts.noCheckin} onSelect={setSelectedId} emptyText="Everyone checked in recently 🙌" />
        <AlertCard title="No activity 14+ days" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} items={alerts.noActivity} onSelect={setSelectedId} emptyText="All members are engaging" />
        <AlertCard title="New members no follow-up" icon={<Heart className="h-4 w-4 text-primary" />} items={alerts.newNoFollow} onSelect={setSelectedId} emptyText="All new members connected" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Member Health</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full sm:w-56" />
            {(["all", "active", "inactive", "risk", "new"] as FilterKey[]).map((k) => (
              <Button key={k} type="button" variant={filter === k ? "default" : "outline"} size="sm" onClick={() => setFilter(k)}>
                {k === "all" ? "All" : k === "active" ? "Active" : k === "inactive" ? "Inactive" : k === "risk" ? "At Risk" : "New"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members match the filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Last check-in</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.member.id} className="cursor-pointer" onClick={() => setSelectedId(h.member.id)}>
                    <TableCell>
                      <div className="font-medium">{h.member.name}</div>
                      <div className="text-xs text-muted-foreground">{h.member.email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(h.lastActivityDate)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(h.lastCheckinDate)}</TableCell>
                    <TableCell className="text-sm">{h.totalPoints}</TableCell>
                    <TableCell>{statusBadge(h.health)}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>{selected.member.name}</span>
                  {statusBadge(selected.health)}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">{selected.member.email ?? "No email"}</p>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-semibold">{selected.totalPoints}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Last activity</p>
                  <p className="font-semibold">{fmtDate(selected.lastActivityDate)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Last check-in</p>
                  <p className="font-semibold">{fmtDate(selected.lastCheckinDate)}</p>
                </div>
              </div>

              {selected.alerts.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="mb-1 text-xs font-medium text-destructive">Alerts</p>
                  <ul className="space-y-1 text-sm">
                    {selected.alerts.map((a) => <li key={a}>• {a}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ActivityIcon className="h-4 w-4" /> Activity Timeline</h3>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {selectedActivities.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No activities yet.</p>
                  ) : selectedActivities.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span>{a.activity_type}{a.source === "self_checkin" ? " (check-in)" : ""}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(a.activity_date)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4" /> Pastoral Notes ({selectedNotes.length})</h3>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {selectedNotes.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No notes shared yet.</p>
                  ) : selectedNotes.map((n) => (
                    <div key={n.id} className="border-b pb-2 last:border-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-primary">{n.book} {n.chapter}:{n.verse}</span>
                        <span className="text-muted-foreground">{fmtDate(n.updated_at)}</span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{n.note_text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4" /> Points History</h3>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {selectedEngagements.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No engagement history.</p>
                  ) : selectedEngagements.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span>{e.platform} · {e.action_type} <span className="text-xs text-muted-foreground">({e.status})</span></span>
                      <span className="text-xs">+{e.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertCard({ title, icon, items, onSelect, emptyText }: { title: string; icon: React.ReactNode; items: MemberHealth[]; onSelect: (id: string) => void; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-1">
            {items.map((h) => (
              <li key={h.member.id}>
                <button onClick={() => onSelect(h.member.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <span className="truncate">{h.member.name}</span>
                  {statusBadge(h.health)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
