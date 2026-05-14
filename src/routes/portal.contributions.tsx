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
  status: string;
  payer_member_id: string | null;
  beneficiary_member_id: string | null;
  member_id: string;
  stripe_subscription_id: string | null;
  payer?: { id: string; name: string } | null;
  beneficiary?: { id: string; name: string } | null;
}

export const Route = createFileRoute("/portal/contributions")({
  component: ContributionsHistory,
});

function ContributionsHistory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
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
      setMemberId(member.id);

      // Fetch payments where the member is payer OR beneficiary OR legacy member_id
      const { data } = await supabase
        .from("payments")
        .select(
          "id, amount, payment_date, payment_method, contribution_type, notes, status, payer_member_id, beneficiary_member_id, member_id, stripe_subscription_id, payer:members!payments_payer_member_id_fkey(id, name), beneficiary:members!payments_beneficiary_member_id_fkey(id, name)",
        )
        .eq("status", "paid")
        .or(
          `member_id.eq.${member.id},payer_member_id.eq.${member.id},beneficiary_member_id.eq.${member.id}`,
        )
        .order("payment_date", { ascending: false });

      // Fallback: relation join may fail if FK isn't named — fetch separately if needed
      let rows = (data || []) as unknown as Payment[];

      const missingNames = rows.some((r) => (r.payer_member_id && !r.payer) || (r.beneficiary_member_id && !r.beneficiary));
      if (missingNames || !data) {
        const { data: fallback } = await supabase
          .from("payments")
          .select(
            "id, amount, payment_date, payment_method, contribution_type, notes, status, payer_member_id, beneficiary_member_id, member_id, stripe_subscription_id",
          )
          .eq("status", "paid")
          .or(`member_id.eq.${member.id},payer_member_id.eq.${member.id},beneficiary_member_id.eq.${member.id}`)
          .order("payment_date", { ascending: false });
        rows = (fallback || []) as Payment[];
        const ids = new Set<string>();
        for (const r of rows) {
          if (r.payer_member_id) ids.add(r.payer_member_id);
          if (r.beneficiary_member_id) ids.add(r.beneficiary_member_id);
          if (r.member_id) ids.add(r.member_id);
        }
        if (ids.size > 0) {
          const { data: mems } = await supabase
            .from("members")
            .select("id, name")
            .in("id", Array.from(ids));
          const map = new Map((mems || []).map((m) => [m.id, m]));
          rows = rows.map((r) => ({
            ...r,
            payer: r.payer_member_id ? (map.get(r.payer_member_id) ?? null) : null,
            beneficiary: r.beneficiary_member_id
              ? (map.get(r.beneficiary_member_id) ?? null)
              : (r.member_id ? (map.get(r.member_id) ?? null) : null),
          }));
        }
      }

      setPayments(rows);
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
                  <th className="px-4 py-3">{t("payerBeneficiary.paidBy")}</th>
                  <th className="px-4 py-3">{t("payerBeneficiary.benefiting")}</th>
                  <th className="px-4 py-3">{t("common.method")}</th>
                  <th className="px-4 py-3">{t("common.status")}</th>
                  <th className="px-4 py-3 text-right">{t("common.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const payerName = p.payer?.name ?? "—";
                  const beneficiaryName = p.beneficiary?.name ?? "—";
                  const isPayer = memberId && p.payer_member_id === memberId;
                  const isBeneficiary = memberId && (p.beneficiary_member_id === memberId || (!p.beneficiary_member_id && p.member_id === memberId));
                  const isFamily = isPayer && p.beneficiary_member_id && p.beneficiary_member_id !== memberId;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 text-foreground">{formatLocalDateOnly(p.payment_date)}</td>
                      <td className="px-4 py-3 capitalize text-foreground">{p.contribution_type.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-foreground">
                        {payerName}
                        {isFamily && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {t("payerBeneficiary.familySupport")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {beneficiaryName}
                        {isBeneficiary && !isPayer && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                            {t("payerBeneficiary.sponsored")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{p.payment_method}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          {p.status}
                        </span>
                        {p.stripe_subscription_id && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {t("payerBeneficiary.subscriptionStatus")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatUSD(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
