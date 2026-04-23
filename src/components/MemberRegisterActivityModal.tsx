import { useState } from "react";
import { X, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ACTIVITY_LABEL, ACTIVITY_ICON, todayLocalISO, type ActivityType } from "@/lib/engagement";
import { toast } from "sonner";

interface Props {
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: ActivityType[] = ["attendance", "cell_group", "visit_scheduled", "leadership_contact"];

export function MemberRegisterActivityModal({ memberId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<ActivityType>("attendance");
  const [date, setDate] = useState(() => todayLocalISO());
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const requiresPhoto = type === "attendance";

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Foto deve ter no máximo 5MB.");
      return;
    }
    setError("");
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");

    if (requiresPhoto && !photoFile) {
      setError("Para Presença na Igreja é obrigatório enviar uma foto.");
      return;
    }

    setSubmitting(true);

    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/self-${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("checkin-photos")
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (upErr) {
        setSubmitting(false);
        setError(upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("checkin-photos").getPublicUrl(path);
      photoUrl = pub.publicUrl;
    }

    const { error: insertErr } = await supabase.from("member_activities").insert([
      {
        member_id: memberId,
        activity_type: type,
        activity_date: date,
        source: "self_checkin",
        status: "pending",
        notes: notes.trim() || null,
        photo_url: photoUrl,
      },
    ]);

    setSubmitting(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    toast.success("Atividade enviada para validação 🙌");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Registrar Atividade</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sua atividade ficará pendente até validação do líder.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Tipo de atividade</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                    type === t
                      ? "border-primary bg-accent text-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">{ACTIVITY_ICON[t]}</span>
                  <span className="font-medium">{ACTIVITY_LABEL[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Data</label>
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
            <label className="text-sm font-medium text-foreground mb-1 block">
              {requiresPhoto ? "Foto (obrigatória)" : "Foto (opcional)"}
            </label>
            <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted cursor-pointer">
              <Camera className="h-4 w-4" />
              {photoFile ? "Trocar foto" : "Selecionar foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
            </label>
            {photoPreview && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border">
                <img src={photoPreview} alt="Pré-visualização" className="w-full h-40 object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Algum detalhe que ajude na validação..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
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
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
