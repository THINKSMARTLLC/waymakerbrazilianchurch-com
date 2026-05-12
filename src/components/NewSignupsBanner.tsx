import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface SignupRow {
  id: string;
  user_email: string | null;
  created_at: string;
  metadata: { full_name?: string; phone?: string; member_id?: string } | null;
}

export function NewSignupsBanner() {
  const { t } = useTranslation();
  const { isSuperAdmin, loading } = useUserRole();
  const [rows, setRows] = useState<SignupRow[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (loading || !isSuperAdmin) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, user_email, created_at, metadata")
        .eq("action", "new_member_registered")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      // Group by unique normalized email — one person = one row.
      const seen = new Set<string>();
      const unique: SignupRow[] = [];
      for (const r of (data as SignupRow[]) || []) {
        const key = (r.user_email ?? r.id).trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
      }
      setRows(unique.slice(0, 10));
    })();
  }, [isSuperAdmin, loading]);

  if (loading || !isSuperAdmin || dismissed || rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              {t("signupsBanner.title", { count: rows.length })}
            </h3>
            <ul className="mt-2 space-y-1">
              {rows.slice(0, 5).map((r) => {
                const name = r.metadata?.full_name || r.user_email || "Unknown";
                const memberId = r.metadata?.member_id;
                const inner = (
                  <>
                    <span className="font-medium text-foreground">{name}</span>
                    {r.user_email && r.user_email !== name ? ` · ${r.user_email}` : ""}
                    {" · "}
                    {new Date(r.created_at).toLocaleString("en-US")}
                  </>
                );
                return (
                  <li key={r.id} className="text-xs text-muted-foreground">
                    {memberId ? (
                      <Link
                        to="/members/$memberId"
                        params={{ memberId }}
                        className="hover:underline cursor-pointer"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <Link to="/members" className="hover:underline cursor-pointer">
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
              {rows.length > 5 && (
                <li className="text-xs text-muted-foreground">{t("signupsBanner.more", { count: rows.length - 5 })}</li>
              )}
            </ul>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label={t("common.dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
