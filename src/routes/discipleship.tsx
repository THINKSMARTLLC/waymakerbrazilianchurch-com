import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { Users, AlertTriangle, TrendingUp, Sprout, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/discipleship")({
  head: () => ({
    meta: [
      { title: "Discipleship — Way Maker Church" },
      { name: "description", content: "Track spiritual growth and discipleship journey" },
    ],
  }),
  component: DiscipleshipPage,
});

type Stage = "visitor" | "new_believer" | "in_discipleship" | "committed" | "serving" | "leader";

const STAGE_ORDER: Stage[] = ["visitor", "new_believer", "in_discipleship", "committed", "serving", "leader"];
const STAGE_LABEL: Record<Stage, string> = {
  visitor: "Visitor",
  new_believer: "New Believer",
  in_discipleship: "In Discipleship",
  committed: "Committed",
  serving: "Serving",
  leader: "Leader",
};

const STEPS = [
  { key: "accepted_jesus", label: "Accepted Jesus" },
  { key: "baptized", label: "Baptized" },
  { key: "completed_course", label: "Completed course" },
  { key: "attending_regularly", label: "Attending regularly" },
  { key: "in_small_group", label: "In small group" },
  { key: "serving_ministry", label: "Serving" },
] as const;

type StepKey = typeof STEPS[number]["key"];

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  discipleship_stage: Stage;
  stage_updated_at: string;
  accepted_jesus: boolean;
  baptized: boolean;
  completed_course: boolean;
  attending_regularly: boolean;
  in_small_group: boolean;
  serving_ministry: boolean;
  assigned_leader_id: string | null;
}

interface Note {
  id: string;
  member_id: string;
  message: string;
  created_at: string;
  author_id: string | null;
}

function suggestStage(m: MemberRow): Stage {
  if (m.serving_ministry && m.in_small_group && m.completed_course && m.baptized) return "leader";
  if (m.in_small_group && m.completed_course && m.baptized) return "serving";
  if (m.attending_regularly && m.baptized) return "committed";
  if (m.accepted_jesus && m.completed_course) return "in_discipleship";
  if (m.accepted_jesus) return "new_believer";
  return "visitor";
}

function nextStep(m: MemberRow): string {
  for (const s of STEPS) {
    if (!m[s.key]) return s.label;
  }
  return "All steps completed 🙌";
}

function daysSince(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

function stageBadge(s: Stage) {
  const idx = STAGE_ORDER.indexOf(s);
  const colors = [
    "bg-muted text-muted-foreground",
    "bg-blue-500 text-white",
    "bg-indigo-500 text-white",
    "bg-emerald-500 text-white",
    "bg-amber-500 text-white",
    "bg-primary text-primary-foreground",
  ];
  return <Badge className={colors[idx]}>{STAGE_LABEL[s]}</Badge>;
}

function DiscipleshipPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [mRes, nRes] = await Promise.all([
      supabase.from("members" as any).select("id, name, email, created_at, discipleship_stage, stage_updated_at, accepted_jesus, baptized, completed_course, attending_regularly, in_small_group, serving_ministry, assigned_leader_id").order("name"),
      supabase.from("discipleship_notes" as any).select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setMembers((mRes.data as any) ?? []);
    setNotes((nRes.data as any) ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (stageFilter !== "all" && m.discipleship_stage !== stageFilter) return false;
      if (q && !m.name.toLowerCase().includes(q) && !(m.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, search, stageFilter]);

  const stageCounts = useMemo(() => {
    const out: Record<Stage, number> = { visitor: 0, new_believer: 0, in_discipleship: 0, committed: 0, serving: 0, leader: 0 };
    for (const m of members) out[m.discipleship_stage]++;
    return out;
  }, [members]);

  const alerts = useMemo(() => {
    const stuck = members.filter((m) => daysSince(m.stage_updated_at) >= 30 && m.discipleship_stage !== "leader");
    const newBelieverNoFollow = members.filter((m) => m.discipleship_stage === "new_believer" && !m.assigned_leader_id);
    const notBaptized = members.filter((m) => m.accepted_jesus && !m.baptized && daysSince(m.created_at) >= 60);
    const progressing = members.filter((m) => suggestStage(m) !== m.discipleship_stage && STAGE_ORDER.indexOf(suggestStage(m)) > STAGE_ORDER.indexOf(m.discipleship_stage));
    return { stuck, newBelieverNoFollow, notBaptized, progressing };
  }, [members]);

  const selected = selectedId ? members.find((m) => m.id === selectedId) ?? null : null;
  const selectedNotes = selected ? notes.filter((n) => n.member_id === selected.id) : [];

  async function updateMember(id: string, patch: Partial<MemberRow>) {
    const { error } = await supabase.from("members" as any).update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } as MemberRow : m));
    toast.success("Updated");
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("discipleship_notes" as any).insert({
      member_id: selected.id,
      message: newNote.trim(),
      author_id: auth.user?.id ?? null,
      visibility: "admin_only",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNotes((p) => [data as any, ...p]);
    setNewNote("");
    toast.success("Note added");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Discipleship Journey</h1>
        <p className="text-sm text-muted-foreground">Track spiritual growth, stages, and follow-up.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={String(members.length)} icon={Users} />
        <StatCard title="New Believers" value={String(stageCounts.new_believer)} icon={Sprout} />
        <StatCard title="Progressing" value={String(alerts.progressing.length)} icon={TrendingUp} />
        <StatCard title="Stuck 30+ days" value={String(alerts.stuck.length)} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AlertList title="Stuck in stage 30+ days" items={alerts.stuck} onSelect={setSelectedId} />
        <AlertList title="New believer no leader" items={alerts.newBelieverNoFollow} onSelect={setSelectedId} />
        <AlertList title="Not baptized after 60+ days" items={alerts.notBaptized} onSelect={setSelectedId} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {STAGE_ORDER.map((s) => (
              <button key={s} onClick={() => setStageFilter(s)} className={`rounded-lg border p-3 text-left transition-colors hover:border-primary ${stageFilter === s ? "border-primary bg-accent" : ""}`}>
                <div className="text-xs text-muted-foreground">{STAGE_LABEL[s]}</div>
                <div className="text-xl font-semibold">{stageCounts[s]}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Members</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-48" />
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as Stage | "all")}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Days in stage</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const completed = STEPS.filter((s) => m[s.key]).length;
                  return (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedId(m.id)}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
                      </TableCell>
                      <TableCell>{stageBadge(m.discipleship_stage)}</TableCell>
                      <TableCell className="text-sm">{completed}/{STEPS.length}</TableCell>
                      <TableCell className="text-sm">{daysSince(m.stage_updated_at)}d</TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.name} {stageBadge(selected.discipleship_stage)}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">{selected.email ?? "No email"}</p>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stage (suggested: {STAGE_LABEL[suggestStage(selected)]})</label>
                <Select value={selected.discipleship_stage} onValueChange={(v) => updateMember(selected.id, { discipleship_stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Leader</label>
                <Select value={selected.assigned_leader_id ?? "none"} onValueChange={(v) => updateMember(selected.id, { assigned_leader_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {members.filter((x) => x.id !== selected.id && (x.discipleship_stage === "leader" || x.discipleship_stage === "serving")).map((x) => (
                      <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Discipleship Steps</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STEPS.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                      <Checkbox checked={selected[s.key]} onCheckedChange={(v) => updateMember(selected.id, { [s.key]: !!v } as Partial<MemberRow>)} />
                      {s.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Next step: <span className="font-medium text-foreground">{nextStep(selected)}</span></p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Notes (admin only)</h3>
                <div className="space-y-2">
                  <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note..." rows={2} />
                  <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add Note</Button>
                </div>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {selectedNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                  ) : selectedNotes.map((n) => (
                    <div key={n.id} className="rounded-lg border p-2 text-sm">
                      <p>{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-US")}</p>
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

function AlertList({ title, items, onSelect }: { title: string; items: MemberRow[]; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" />{title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">All clear 🙌</p>
        ) : (
          <ul className="space-y-1">
            {items.slice(0, 6).map((m) => (
              <li key={m.id}>
                <button onClick={() => onSelect(m.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <span className="truncate">{m.name}</span>
                  {stageBadge(m.discipleship_stage)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
