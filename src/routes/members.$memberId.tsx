import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, DollarSign, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatUSD, toTitleCase } from "@/lib/format";
import { EditPaymentModal } from "@/components/EditPaymentModal";
import { computeMemberStatus, STATUS_LABEL, statusBadgeClasses, statusDotClasses, buildMonthsCovered } from "@/lib/memberStatus";
import { PAYMENT_METHOD_LABEL, RecordPaymentModal } from "@/components/RecordPaymentModal";
import { formatPhoneDisplay } from "@/lib/phone";

export const Route = createFileRoute("/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Perfil do Membro — WAY MAKER FLOW" },
      { name: "description", content: "Visualizar perfil e histórico de pagamentos" },
    ],
  }),
  component: MemberProfilePage,
});

type Member = Database["public"]["Tables"]["members"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

function MemberProfilePage() {
  const { memberId } = Route.useParams();
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    const [memberRes, paymentsRes] = await Promise.all([
      supabase.from("members").select("*").eq("id", memberId).single(),
      supabase.from("payments").select("*").eq("member_id", memberId).order("payment_date", { ascending: false }),
    ]);
    setMember(memberRes.data);
    setPayments(paymentsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [memberId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Membro não encontrado.</p>
        <Link to="/members" className="mt-4 btn-google inline-block">Voltar</Link>
      </div>
    );
  }

  const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const lastPaymentDate = payments[0]?.payment_date ?? null;
  const monthsCovered = buildMonthsCovered(payments as Array<{ payment_frequency?: string | null; reference_month?: string | null }>);
  const memberStatus = computeMemberStatus(
    lastPaymentDate,
    (member as Member & { contribution_frequency?: "weekly" | "monthly" | "one_time" | "flexible" }).contribution_frequency ?? "weekly",
    monthsCovered,
  );

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("payments").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    fetchData();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Membros
      </Link>

      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-primary overflow-hidden">
            {member.profile_photo_url ? (
              <img src={member.profile_photo_url} alt={member.name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">{member.name}</h2>
            <div className="mt-2 space-y-1.5">
              {member.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {member.email}</p>}
              {member.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> {formatPhoneDisplay(member.phone)}</p>}
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" /> {member.payment_type === "card" ? "Cartão" : "Dinheiro"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`status-badge ${member.status === "active" ? "status-active" : "status-inactive"}`}>
              {member.status === "active" ? "Ativo" : "Inativo"}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(memberStatus)}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(memberStatus)}`} />
              {STATUS_LABEL[memberStatus]}
            </span>
          </div>
        </div>
      </div>

      <div className="card-elevated p-6">
        <h3 className="font-display text-base font-medium text-foreground mb-4">Ações</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            Registrar Pagamento
          </button>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-medium text-foreground">Histórico de Pagamentos</h3>
        </div>
        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header px-5 py-3 text-left">Data</th>
                <th className="table-header px-5 py-3 text-left">Valor</th>
                <th className="table-header px-5 py-3 text-left">Método</th>
                <th className="table-header px-5 py-3 text-left">Status</th>
                <th className="table-header px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-sm text-foreground">
                    {new Date(p.payment_date).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">
                    {formatUSD(p.amount)}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`status-badge status-${p.status === "past_due" ? "past-due" : p.status}`}>
                      {p.status === "paid" ? "Pago" : p.status === "pending" ? "Pendente" : "Em atraso"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingPayment(p)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit Payment"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        disabled={deletingId === p.id}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Delete Payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          memberId={memberId}
          memberName={member.name}
          onClose={() => setShowPaymentModal(false)}
          onSaved={fetchData}
        />
      )}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
