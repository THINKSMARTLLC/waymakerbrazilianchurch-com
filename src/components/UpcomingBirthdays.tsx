import { useEffect, useState } from "react";
import { Cake, Phone, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getBirthdayInfo, formatBirthdayLabel, type BirthdayInfo } from "@/lib/birthday";
import { toTitleCase } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  date_of_birth: string | null;
  phone: string | null;
  info: BirthdayInfo;
}

export function UpcomingBirthdays() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "week" | "month">("week");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, date_of_birth, phone, status")
        .eq("status", "active")
        .not("date_of_birth", "is", null);
      const list: Row[] = [];
      for (const m of data ?? []) {
        const info = getBirthdayInfo(m.date_of_birth);
        if (!info || info.daysUntil > 30) continue;
        list.push({ id: m.id, name: toTitleCase(m.name), date_of_birth: m.date_of_birth, phone: m.phone, info });
      }
      list.sort((a, b) => a.info.daysUntil - b.info.daysUntil);
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const todayCount = rows.filter((r) => r.info.daysUntil === 0).length;
  const weekCount = rows.filter((r) => r.info.daysUntil <= 7).length;
  const monthCount = rows.length;

  const filtered = rows.filter((r) => {
    if (tab === "today") return r.info.daysUntil === 0;
    if (tab === "week") return r.info.daysUntil <= 7;
    return true;
  });

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-medium text-foreground">Próximos Aniversariantes</h3>
        </div>
      </div>

      <div className="flex gap-1 mb-4 rounded-xl bg-muted p-1 text-xs">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")} label={`Hoje (${todayCount})`} />
        <TabBtn active={tab === "week"} onClick={() => setTab("week")} label={`7 dias (${weekCount})`} />
        <TabBtn active={tab === "month"} onClick={() => setTab("month")} label={`30 dias (${monthCount})`} />
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Nenhum aniversariante neste período.</div>
      ) : (
        <ul className="space-y-2 max-h-[280px] overflow-y-auto">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 hover:bg-muted/40 transition-colors">
              <Link to="/members/$memberId" params={{ memberId: r.id }} className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs">
                  {r.info.daysUntil === 0 ? "🎂" : "🎁"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.info.monthDay} · {formatBirthdayLabel(r.info)}
                    {r.info.turningAge !== null && r.info.daysUntil <= 7 ? ` · ${r.info.turningAge} anos` : ""}
                  </p>
                </div>
              </Link>
              {r.phone && (
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`tel:${r.phone}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Ligar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <a
                    href={`https://wa.me/${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Feliz aniversário, ${r.name.split(" ")[0]}! 🎉🎂 Que Deus abençoe sua vida.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Enviar mensagem"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition-colors ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}
