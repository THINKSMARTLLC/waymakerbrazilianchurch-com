import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toTitleCase } from "@/lib/format";
import { formatLocalDateOnly } from "@/lib/datetime";

export const Route = createFileRoute("/engagement/visits")({
  head: () => ({
    meta: [{ title: "Visitas — Way Maker Church" }],
  }),
  component: VisitsPage,
});

interface VisitRow {
  id: string;
  member_id: string;
  scheduled_date: string;
  completed_at: string | null;
  status: "scheduled" | "completed" | "cancelled";
  notes: string | null;
}

interface MemberLite {
  id: string;
  name: string;
}

function VisitsPage() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const [vRes, mRes] = await Promise.all([
      supabase
        .from("member_visits")
        .select("id, member_id, scheduled_date, completed_at, status, notes")
        .order("scheduled_date", { ascending: false }),
      supabase.from("members").select("id, name").eq("status", "active").order("name"),
    ]);
    setVisits((vRes.data ?? []) as VisitRow[]);
    setMembers((mRes.data ?? []) as MemberLite[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleComplete = async (id: string, memberId: string) => {
    const { error } = await supabase
      .from("member_visits")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    // Auto-record an activity for completed visit
    await supabase.from("member_activities").insert([
      {
        member_id: memberId,
        activity_type: "visit_scheduled",
        source: "admin_manual",
        recorded_by: user?.id ?? null,
        notes: "Visita concluída",
      },
    ]);
    load();
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancelar esta visita?")) return;
    await supabase.from("member_visits").update({ status: "cancelled" }).eq("id", id);
    load();
  };

  const memberName = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? toTitleCase(m.name) : "—";
  };

  const scheduled = visits.filter((v) => v.status === "scheduled");
  const others = visits.filter((v) => v.status !== "scheduled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link to="/engagement" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <h2 className="font-display text-2xl font-semibold text-foreground mt-2">Visitas</h2>
          <p className="text-sm text-muted-foreground mt-1">Agende e acompanhe visitas aos membros.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-google inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Agendar visita
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className="card-elevated overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-display text-base font-medium text-foreground">Agendadas ({scheduled.length})</h3>
            </div>
            {scheduled.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma visita agendada.</div>
            ) : (
              <ul>
                {scheduled.map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-4 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{memberName(v.member_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        Agendada para {formatLocalDateOnly(v.scheduled_date)}
                        {v.notes ? ` · ${v.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleComplete(v.id, v.member_id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 text-success px-3 py-1.5 text-xs font-medium hover:bg-success/25"
                      >
                        <Check className="h-3 w-3" /> Concluir
                      </button>
                      <button
                        onClick={() => handleCancel(v.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-muted text-muted-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-elevated overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-display text-base font-medium text-foreground">Histórico</h3>
            </div>
            {others.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma visita no histórico.</div>
            ) : (
              <ul>
                {others.map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-4 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{memberName(v.member_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLocalDateOnly(v.scheduled_date)} · {v.status === "completed" ? "Concluída" : "Cancelada"}
                        {v.notes ? ` · ${v.notes}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {showNew && (
        <NewVisitModal
          members={members}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewVisitModal({
  members,
  onClose,
  onSaved,
}: {
  members: MemberLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("member_visits").insert([
      {
        member_id: memberId,
        scheduled_date: date,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      },
    ]);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Agendar Visita</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Membro</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{toTitleCase(m.name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Motivo, contexto..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn-google inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Agendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
