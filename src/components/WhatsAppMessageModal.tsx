import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageCircle, Sparkles, Plus, Trash2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/datetime";

export interface WhatsAppMember {
  name: string;
  phone: string | null;
  due_date?: string | null;
}

interface WhatsAppMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WhatsAppMember | null;
}

interface Template {
  id: string;
  title: string;
  body: string;
  /** 0=Sun, 1=Mon, ..., 6=Sat. If set, highlighted on this weekday. */
  suggestedWeekday?: number;
  custom?: boolean;
}

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "initial",
    title: "1. Contato inicial",
    body: `Olá {name}, tudo bem? Recebemos seu interesse em contribuir com a igreja e com o salário do pastor 🙏
Já estamos organizando tudo por aqui.
Temos a opção de contribuição recorrente (automática).
Você prefere fazer por cartão?`,
  },
  {
    id: "validation",
    title: "2. Confirmação / validação de dados",
    body: `Olá {name}! Só confirmando suas informações para organizar sua contribuição:
Nome completo, e-mail, telefone e qual o melhor dia do vencimento para você. Pode me enviar por aqui?`,
  },
  {
    id: "payment_link",
    title: "3. Link de pagamento",
    body: `Olá {name}! Aqui está o link para você configurar sua contribuição de forma rápida e segura:
[INSERIR LINK AQUI]
Qualquer dúvida, estou por aqui 🙏`,
  },
  {
    id: "reminder",
    title: "4. Lembrete de pagamento (3 dias antes)",
    body: `Olá {name}, tudo bem?
Passando para te lembrar que sua contribuição vence no dia {due_date} (daqui a 3 dias).
Só para você se programar 🙏`,
  },
  {
    id: "overdue",
    title: "5. Pagamento em atraso",
    body: `Olá {name}, tudo bem?
Percebemos que sua contribuição está em aberto.
Se precisar de ajuda ou quiser regularizar, estou por aqui para te ajudar 🙏`,
  },
  {
    id: "sunday",
    title: "6. Culto de domingo",
    body: `Olá {name}!
Domingo temos nosso culto às 10:30am 🙌
E às 9:00am temos um café da manhã gratuito para comunhão.
Será muito especial ter você conosco!`,
    suggestedWeekday: 0,
  },
  {
    id: "monday",
    title: "7. Ensino bíblico (segunda-feira)",
    body: `Olá {name}!
Hoje temos ensino bíblico às 8:00pm 📖
Te esperamos!`,
    suggestedWeekday: 1,
  },
  {
    id: "wednesday",
    title: "8. Culto de quarta-feira",
    body: `Olá {name}!
Hoje temos culto às 8:00pm 🙌
Será um tempo poderoso!`,
    suggestedWeekday: 3,
  },
  {
    id: "friday_youth",
    title: "9. Culto de jovens (sexta-feira)",
    body: `Olá {name}!
Hoje temos culto de jovens às 8:00pm 🔥
Vai ser incrível, esperamos você!`,
    suggestedWeekday: 5,
  },
  {
    id: "communion",
    title: "10. Santa Ceia (primeiro domingo)",
    body: `Olá {name}!
Neste domingo teremos Santa Ceia 🙏
Um momento especial como igreja.
Esperamos você!`,
  },
  {
    id: "general_invite",
    title: "11. Convite geral",
    body: `Olá {name}!
Quero te convidar para estar conosco em um dos nossos cultos durante a semana.
Será um prazer te receber!`,
  },
];

const CUSTOM_STORAGE_KEY = "wa_custom_templates_v1";

function loadCustomTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.body === "string")
      .map((t) => ({ ...t, custom: true }));
  } catch {
    return [];
  }
}

function saveCustomTemplates(list: Template[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Strip everything but digits. If number is 10 digits (US local), prefix 1. */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

/** Today's date in America/New_York as Date components (y/m/d). */
function nyToday(): { y: number; m: number; d: number } {
  const parts = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd").split("-");
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

/** Format US-style MM/DD/YYYY using NY-anchored arithmetic. addDays may be negative. */
function nyDatePlusDays(addDays: number): string {
  const { y, m, d } = nyToday();
  // Use UTC math to avoid local DST drift; we treat the NY date as a calendar date.
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + addDays);
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  const yyyy = base.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function todayUS(): string {
  return nyDatePlusDays(0);
}

function replaceVariables(body: string, member: WhatsAppMember, templateId: string): string {
  // For payment reminder template (id "reminder"), {due_date} = today + 3 days (NY).
  // Otherwise, fall back to member.due_date if provided, else today.
  let dueDate: string;
  if (templateId === "reminder") {
    dueDate = nyDatePlusDays(3);
  } else if (member.due_date) {
    // Parse YYYY-MM-DD as local-only and reformat to MM/DD/YYYY.
    const match = String(member.due_date).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      dueDate = `${match[2]}/${match[3]}/${match[1]}`;
    } else {
      dueDate = todayUS();
    }
  } else {
    dueDate = todayUS();
  }

  const firstName = (member.name || "").split(" ")[0] || member.name || "";
  return body
    .replace(/\{name\}/g, firstName)
    .replace(/\{due_date\}/g, dueDate)
    .replace(/\{today\}/g, todayUS());
}

export function WhatsAppMessageModal({ open, onOpenChange, member }: WhatsAppMessageModalProps) {
  const { t: tr } = useTranslation();
  const todayWeekday = useMemo(() => {
    // Weekday in NY tz (0=Sun..6=Sat)
    const dayName = formatInTimeZone(new Date(), APP_TIMEZONE, "i"); // 1=Mon..7=Sun (ISO)
    const iso = Number(dayName);
    return iso === 7 ? 0 : iso;
  }, [open]);

  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [editedBody, setEditedBody] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  // Load custom templates each time modal opens.
  useEffect(() => {
    if (open) {
      setCustomTemplates(loadCustomTemplates());
      setCreating(false);
      setNewTitle("");
      setNewBody("");
    }
  }, [open]);

  const allTemplates = useMemo(() => {
    return [...BUILTIN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  const orderedTemplates = useMemo(() => {
    const suggested = allTemplates.filter((t) => t.suggestedWeekday === todayWeekday);
    const rest = allTemplates.filter((t) => t.suggestedWeekday !== todayWeekday);
    return [...suggested, ...rest];
  }, [allTemplates, todayWeekday]);

  // Reset selection if current id no longer exists (e.g. after delete).
  useEffect(() => {
    if (!orderedTemplates.find((t) => t.id === selectedId)) {
      setSelectedId(orderedTemplates[0]?.id ?? BUILTIN_TEMPLATES[0].id);
    }
  }, [orderedTemplates, selectedId]);

  const selected = allTemplates.find((t) => t.id === selectedId) ?? BUILTIN_TEMPLATES[0];

  // Recompute preview when template or member changes (and reset user edits).
  useEffect(() => {
    if (!member) {
      setEditedBody(selected.body);
      return;
    }
    setEditedBody(replaceVariables(selected.body, member, selected.id));
  }, [selected.id, member, open]);

  const phone = normalizePhone(member?.phone);
  const canSend = phone.length >= 10 && editedBody.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(editedBody)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleSaveCustom = () => {
    const title = newTitle.trim();
    const body = newBody.trim();
    if (!title || !body) return;
    const tpl: Template = {
      id: `custom_${Date.now()}`,
      title,
      body,
      custom: true,
    };
    const next = [...customTemplates, tpl];
    setCustomTemplates(next);
    saveCustomTemplates(next);
    setSelectedId(tpl.id);
    setCreating(false);
    setNewTitle("");
    setNewBody("");
  };

  const handleDeleteCustom = (id: string) => {
    const tpl = customTemplates.find((t) => t.id === id);
    if (!tpl) return;
    if (!confirm(tr("whatsapp.confirmDelete", { title: tpl.title }))) return;
    const next = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(next);
    saveCustomTemplates(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            WhatsApp — {member?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            {tr("whatsapp.selectAndEdit")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden flex-1">
          <div className="overflow-y-auto pr-1 space-y-1.5 max-h-[55vh]">
            {orderedTemplates.map((t) => {
              const isSuggested = t.suggestedWeekday === todayWeekday;
              const isSelected = t.id === selectedId;
              return (
                <div
                  key={t.id}
                  className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className="flex-1 text-left flex items-center gap-1.5 px-1"
                  >
                    {isSuggested && <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    <span className="font-medium">{t.title}</span>
                  </button>
                  {t.custom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustom(t.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title={tr("whatsapp.deleteMessage")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {tr("whatsapp.createNew")}
              </button>
            ) : (
              <div className="rounded-lg border border-border p-2 space-y-2 bg-muted/20">
                <Input
                  placeholder={tr("whatsapp.messageTitle")}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-sm"
                />
                <Textarea
                  placeholder={tr("whatsapp.messageBody")}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="text-sm min-h-[80px]"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCreating(false);
                      setNewTitle("");
                      setNewBody("");
                    }}
                  >
                    {tr("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCustom}
                    disabled={!newTitle.trim() || !newBody.trim()}
                  >
                    {tr("common.save")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col overflow-hidden">
            <label className="text-xs font-medium text-muted-foreground mb-1.5">
              {tr("whatsapp.preview")}
            </label>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="text-sm flex-1 max-h-[55vh] min-h-[200px] resize-none"
            />
            {!phone && (
              <p className="mt-2 text-xs text-destructive">
                {tr("whatsapp.noPhone")}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr("common.cancel")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {tr("whatsapp.send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
