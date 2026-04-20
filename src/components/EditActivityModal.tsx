import { useEffect, useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVITY_LABEL, type ActivityType } from "@/lib/engagement";

interface EventTypeOption {
  id: string;
  name: string;
  category: string;
  base_activity_type: ActivityType;
  icon: string | null;
}

interface ActivityRecord {
  id: string;
  member_id: string;
  activity_type: ActivityType;
  activity_date: string;
  notes: string | null;
  event_type_id: string | null;
}

interface Props {
  activity: ActivityRecord;
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: ActivityType[] = ["attendance", "cell_group", "visit_scheduled", "leadership_contact"];

export function EditActivityModal({ activity, memberName, onClose, onSaved }: Props) {
  const [type, setType] = useState<ActivityType>(activity.activity_type);
  const [date, setDate] = useState(activity.activity_date.slice(0, 10));
  const [notes, setNotes] = useState(activity.notes ?? "");
  const [eventTypeId, setEventTypeId] = useState<string>(activity.event_type_id ?? "");
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("event_types")
      .select("id, name, category, base_activity_type, icon")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setEventTypes((data ?? []) as EventTypeOption[]));
  }, []);

  const filteredEvents = eventTypes.filter((e) => e.base_activity_type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase
      .from("member_activities")
      .update({
        activity_type: type,
        activity_date: date,
        notes: notes.trim() || null,
        event_type_id: eventTypeId || null,
      })
      .eq("id", activity.id);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta atividade?")) return;
    setDeleting(true);
    const { error: err } = await supabase.from("member_activities").delete().eq("id", activity.id);
    setDeleting(false);
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
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Editar Atividade</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{memberName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo base</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ActivityType);
                setEventTypeId("");
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{ACTIVITY_LABEL[t]}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Evento específico</label>
              <select
                value={eventTypeId}
                onChange={(e) => setEventTypeId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Nenhum —</option>
                {filteredEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.icon ?? ""} {ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || submitting}
              className="rounded-xl border border-destructive/30 text-destructive px-3 py-2.5 text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-google inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
