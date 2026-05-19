import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase, formatUSD } from "@/lib/format";

interface Row {
  id: string;
  memberId: string | null;
  name: string;
  amount: number;
  photo: string | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function RecentContributions() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, member_id, payment_date, status, members:member_id(name, profile_photo_url)")
        .eq("status", "paid")
        .order("payment_date", { ascending: false })
        .limit(6);
      const list: Row[] = (data ?? []).map((p) => {
        const m = (p as { members?: { name: string | null; profile_photo_url: string | null } | null }).members;
        return {
          id: p.id as string,
          memberId: (p.member_id as string | null) ?? null,
          name: m?.name ? toTitleCase(m.name) : "—",
          amount: Number(p.amount ?? 0),
          photo: m?.profile_photo_url ?? null,
        };
      });
      setRows(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="card-elevated p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight">
            {t("dashboard.recentContributions", { defaultValue: "Contribuições Recentes" })}
          </h3>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 5).map((r) => {
            const inner = (
              <div className="flex items-center justify-between gap-3 rounded-xl p-2 -mx-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                    {r.photo ? (
                      <img src={r.photo} alt={r.name} className="h-full w-full object-cover" />
                    ) : (
                      initials(r.name)
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums">{formatUSD(r.amount)}</span>
              </div>
            );
            return (
              <li key={r.id}>
                {r.memberId ? (
                  <Link to="/members/$memberId" params={{ memberId: r.memberId }}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/reports" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">
        {t("dashboard.viewAll", { defaultValue: "Ver todas" })} →
      </Link>
    </div>
  );
}
