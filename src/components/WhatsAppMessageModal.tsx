import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";

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
}

const TEMPLATES: Template[] = [
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
Passando para te lembrar que sua contribuição vence no dia {due_date}.
Só para você se programar 🙏`,
  },
  {
    id: "sunday",
    title: "5. Culto de domingo",
    body: `Olá {name}!
Domingo temos nosso culto às 10:30am 🙌
E às 9:00am temos um café da manhã gratuito para comunhão.
Será muito especial ter você conosco!`,
    suggestedWeekday: 0,
  },
  {
    id: "monday",
    title: "6. Ensino bíblico (segunda-feira)",
    body: `Olá {name}!
Hoje temos ensino bíblico às 8:00pm 📖
Te esperamos!`,
    suggestedWeekday: 1,
  },
  {
    id: "wednesday",
    title: "7. Culto de quarta-feira",
    body: `Olá {name}!
Hoje temos culto às 8:00pm 🙌
Será um tempo poderoso!`,
    suggestedWeekday: 3,
  },
  {
    id: "friday_youth",
    title: "8. Culto de jovens (sexta-feira)",
    body: `Olá {name}!
Hoje temos culto de jovens às 8:00pm 🔥
Vai ser incrível, esperamos você!`,
    suggestedWeekday: 5,
  },
  {
    id: "communion",
    title: "9. Santa Ceia (primeiro domingo)",
    body: `Olá {name}!
Neste domingo teremos Santa Ceia 🙏
Um momento especial como igreja.
Esperamos você!`,
  },
  {
    id: "general_invite",
    title: "10. Convite geral",
    body: `Olá {name}!
Quero te convidar para estar conosco em um dos nossos cultos durante a semana.
Será um prazer te receber!`,
  },
];

/** Strip everything but digits. If number is 10 digits (US local), prefix 1. */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

function replaceVariables(body: string, member: WhatsAppMember): string {
  const today = new Date().toLocaleDateString("pt-BR");
  const due = member.due_date
    ? new Date(member.due_date).toLocaleDateString("pt-BR")
    : "—";
  const firstName = (member.name || "").split(" ")[0] || member.name || "";
  return body
    .replace(/\{name\}/g, firstName)
    .replace(/\{due_date\}/g, due)
    .replace(/\{today\}/g, today);
}

export function WhatsAppMessageModal({ open, onOpenChange, member }: WhatsAppMessageModalProps) {
  const todayWeekday = new Date().getDay();

  const orderedTemplates = useMemo(() => {
    const suggested = TEMPLATES.filter((t) => t.suggestedWeekday === todayWeekday);
    const rest = TEMPLATES.filter((t) => t.suggestedWeekday !== todayWeekday);
    return [...suggested, ...rest];
  }, [todayWeekday]);

  const [selectedId, setSelectedId] = useState<string>(orderedTemplates[0]?.id ?? TEMPLATES[0].id);

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];
  const preview = member ? replaceVariables(selected.body, member) : selected.body;

  const phone = normalizePhone(member?.phone);
  const canSend = phone.length >= 10;

  const handleSend = () => {
    if (!canSend) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(preview)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
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
            Selecione uma mensagem. Variáveis como {"{name}"} e {"{due_date}"} serão substituídas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden flex-1">
          <div className="overflow-y-auto pr-1 space-y-1.5 max-h-[55vh]">
            {orderedTemplates.map((t) => {
              const isSuggested = t.suggestedWeekday === todayWeekday;
              const isSelected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isSuggested && <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    <span className="font-medium">{t.title}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col overflow-hidden">
            <label className="text-xs font-medium text-muted-foreground mb-1.5">Pré-visualização</label>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap overflow-y-auto flex-1 max-h-[55vh]">
              {preview}
            </div>
            {!canSend && (
              <p className="mt-2 text-xs text-destructive">
                Este membro não possui número de telefone válido.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar via WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
