import { useEffect, useState } from "react";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ACTIVITY_LABEL, type ActivityType } from "@/lib/engagement";

interface EventType {
  id: string;
  name: string;
  category: string;
  base_activity_type: ActivityType;
  icon: string | null;
  active: boolean;
  is_custom: boolean;
}

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

const CATEGORY_KEYS = ["service", "group", "event", "other"] as const;
const BASE_TYPES: ActivityType[] = ["attendance", "cell_group", "visit_scheduled", "leadership_contact"];

export function EventTypeManagerModal({ onClose, onChanged }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("event");
  const [baseType, setBaseType] = useState<ActivityType>("attendance");
  const [icon, setIcon] = useState("✨");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("event_types").select("*").order("category").order("name");
    setItems((data ?? []) as EventType[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("event_types").insert([
      {
        name: name.trim(),
        category,
        base_activity_type: baseType,
        icon: icon.trim() || null,
        is_custom: true,
        created_by: user?.id ?? null,
      },
    ]);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setIcon("✨");
    await load();
    onChanged();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("event_types").update({ active: !active }).eq("id", id);
    await load();
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("modals.deleteEventConfirm"))) return;
    await supabase.from("event_types").delete().eq("id", id);
    await load();
    onChanged();
  };

  const catLabel = (key: string) => t(`modals.categories.${key}`, { defaultValue: key });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("modals.eventTypes")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("modals.defaultsCustom")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <form onSubmit={handleAdd} className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium text-foreground">{t("modals.createNewEvent")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={t("modals.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder={t("modals.iconPlaceholder")}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                maxLength={4}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORY_KEYS.map((c) => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
              <select
                value={baseType}
                onChange={(e) => setBaseType(e.target.value as ActivityType)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {BASE_TYPES.map((tp) => (
                  <option key={tp} value={tp}>{t("modals.base", { label: ACTIVITY_LABEL[tp] })}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="btn-google inline-flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("modals.add")}
            </button>
          </form>

          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${it.active ? "bg-card" : "bg-muted/40 opacity-60"}`}
                >
                  <span className="text-xl">{it.icon ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{it.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {catLabel(it.category)} · base: {ACTIVITY_LABEL[it.base_activity_type]}
                      {it.is_custom && ` · ${t("modals.custom")}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(it.id, it.active)}
                    className="text-xs rounded-md border border-input px-2 py-1 hover:bg-muted"
                  >
                    {it.active ? t("modals.deactivate") : t("modals.activate")}
                  </button>
                  {it.is_custom && (
                    <button
                      type="button"
                      onClick={() => handleDelete(it.id)}
                      className="text-destructive p-1 rounded-md hover:bg-destructive/10"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
