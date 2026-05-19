import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/lib/format";

interface AbsentRow {
  id: string;
  name: string;
  lastDate: string | null;
  photo: string | null;
}

function formatDateBR(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AbsentMembers() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AbsentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, last_payment_date, profile_photo_url, status")
        .eq("status", "active")
        .order("last_payment_date", { ascending: true, nullsFirst: true })
        .limit(6);
      const list: AbsentRow[] = (data ?? []).map((m) => ({
        id: m.id,
        name: toTitleCase(m.name),
        lastDate: m.last_payment_date,
        photo: m.profile_photo_url,
      }));
      setRows(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="card-elevated p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight">
            {t("dashboard.absentMembers", { defaultValue: "Membros Ausentes" })}
          </h3>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link
                to="/members/$memberId"
                params={{ memberId: r.id }}
                className="flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-muted/50 transition-colors"
              >
                <div className="h-9 w-9 shrink-0 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                  {r.photo ? (
                    <img src={r.photo} alt={r.name} className="h-full w-full object-cover" />
                  ) : (
                    initials(r.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("dashboard.lastCheckIn", { defaultValue: "Último pagamento" })}: {formatDateBR(r.lastDate)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/members" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">
        {t("dashboard.viewAll", { defaultValue: "Ver todos" })} →
      </Link>
    </div>
  );
}
