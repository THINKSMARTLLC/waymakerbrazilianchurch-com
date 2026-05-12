import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ACTIVITY_LABEL, ACTIVITY_ICON, todayLocalISO, type ActivityType } from "@/lib/engagement";

interface EventTypeOption {
  id: string;
  name: string;
  category: string;
  base_activity_type: ActivityType;
  icon: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: ActivityType[] = ["attendance", "cell_group", "visit_scheduled", "leadership_contact"];

export function RegisterActivityModal({ memberId, memberName, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [type, setType] = useState<ActivityType>("attendance");
  const [date, setDate] = useState(() => todayLocalISO());
  const [notes, setNotes] = useState("");
  const [eventTypeId, setEventTypeId] = useState<string>("");
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
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
    const { error: err } = await supabase.from("member_activities").insert([
      {
        member_id: memberId,
        activity_type: type,
        activity_date: date,
        source: "admin_manual",
        notes: notes.trim() || null,
        recorded_by: user?.id ?? null,
        event_type_id: eventTypeId || null,
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
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("modals.registerActivity")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{memberName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t("modals.activityType")}</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => {
                    setType(tp);
                    setEventTypeId("");
                  }}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                    type === tp
                      ? "border-primary bg-accent text-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">{ACTIVITY_ICON[tp]}</span>
                  <span className="font-medium">{ACTIVITY_LABEL[tp]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t("modals.specificEventOptional")}</label>
              <select
                value={eventTypeId}
                onChange={(e) => setEventTypeId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t("modals.noneOption")}</option>
                {filteredEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.icon ?? ""} {ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">{t("common.date")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayLocalISO()}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">{t("modals.notesOptional")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("modals.additionalNotes")}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-google inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("modals.register")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
