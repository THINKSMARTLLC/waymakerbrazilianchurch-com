import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatUSD } from "@/lib/format";
import { formatLocalDateOnly } from "@/lib/datetime";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  contribution_type: string;
  notes: string | null;
}

export const Route = createFileRoute("/portal/contributions")({
  component: ContributionsHistory,
});

function ContributionsHistory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_date, payment_method, contribution_type, notes, status")
        .eq("member_id", member.id)
        .eq("status", "paid")
        .order("payment_date", { ascending: false });

      setPayments((data || []) as Payment[]);
      setLoading(false);
    }
    load();
  }, [user]);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="card-elevated p-5">
        <p className="text-sm text-muted-foreground">{t("portal.totalContributed")}</p>
        <p className="font-display text-3xl font-semibold text-foreground mt-1">{formatUSD(total)}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("portal.contributionsCount", { count: payments.length })}</p>
      </div>

      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            {t("portal.noContributionsHistory")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">{t("common.date")}</th>
                  <th className="px-4 py-3">{t("portal.contributionType")}</th>
                  <th className="px-4 py-3">{t("common.method")}</th>
                  <th className="px-4 py-3 text-right">{t("common.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">
                      {formatLocalDateOnly(p.payment_date)}
                    </td>
                    <td className="px-4 py-3 capitalize text-foreground">{p.contribution_type.replace("_", " ")}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.payment_method}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{formatUSD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
