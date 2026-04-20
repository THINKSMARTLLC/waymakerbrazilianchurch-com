import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, DollarSign, Mail, Phone, Pencil, Trash2, Calendar, MapPin, AlertCircle, Briefcase, Users as UsersIcon, Edit, Cake } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatUSD, toTitleCase } from "@/lib/format";
import { EditPaymentModal } from "@/components/EditPaymentModal";
import { EditMemberModal } from "@/components/EditMemberModal";
import { computeMemberStatus, statusBadgeClasses, statusDotClasses, buildMonthsCovered } from "@/lib/memberStatus";
import { PAYMENT_METHOD_LABEL, RecordPaymentModal } from "@/components/RecordPaymentModal";
import { formatPhoneDisplay } from "@/lib/phone";
import { useUserRole } from "@/hooks/useUserRole";
import { parseEmergencyContact, isLegacyEmergencyContact, type EmergencyContact } from "@/lib/emergencyContact";
import { getBirthdayInfo } from "@/lib/birthday";
import { formatLocalDateOnly } from "@/lib/datetime";

function FieldRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  const { t } = useTranslation();
  const display = value && String(value).trim() ? String(value) : null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm ${display ? "text-foreground" : "text-muted-foreground italic"}`}>
          {display ?? t("common.notProvided")}
        </p>
      </div>
    </div>
  );
}

function EmergencyBlock({ raw }: { raw: string | null }) {
  const { t } = useTranslation();
  const c = parseEmergencyContact(raw);
  const hasAny = !!(c.name || c.phone || c.relationship);
  const legacy = isLegacyEmergencyContact(raw);

  const localizedRelationship = (contact: EmergencyContact): string => {
    if (!contact.relationship) return "";
    if (contact.relationship === "other") {
      return contact.relationshipOther?.trim() || t("emergencyContact.relationships.other");
    }
    return t(`emergencyContact.relationships.${contact.relationship}`);
  };

  return (
    <div className="flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">{t("memberProfile.emergencyContact")}</p>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground italic">{t("common.notProvided")}</p>
        ) : (
          <div className="space-y-0.5 text-sm">
            <p className="text-foreground">
              <span className="text-muted-foreground text-xs">{t("memberProfile.contactName")}:</span>{" "}
              {c.name || <span className="italic text-muted-foreground">{t("common.notProvided")}</span>}
            </p>
            <p className="text-foreground">
              <span className="text-muted-foreground text-xs">{t("memberProfile.contactPhone")}:</span>{" "}
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="text-primary hover:underline">{formatPhoneDisplay(c.phone) || c.phone}</a>
              ) : (
                <span className="italic text-muted-foreground">{t("common.notProvided")}</span>
              )}
            </p>
            <p className="text-foreground">
              <span className="text-muted-foreground text-xs">{t("memberProfile.relationship")}:</span>{" "}
              {localizedRelationship(c) || <span className="italic text-muted-foreground">{t("common.notProvided")}</span>}
            </p>
            {legacy && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-1">
                {t("memberProfile.legacyDataWarning")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Member Profile — WAY MAKER FLOW" },
      { name: "description", content: "View profile and payment history" },
    ],
  }),
  component: MemberProfilePage,
});

type Member = Database["public"]["Tables"]["members"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];

function MemberProfilePage() {
  const { memberId } = Route.useParams();
  const { isStaff } = useUserRole();
  const { t } = useTranslation();
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditMember, setShowEditMember] = useState(false);
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
        <p className="text-muted-foreground">{t("memberProfile.memberNotFound")}</p>
        <Link to="/members" className="mt-4 btn-google inline-block">{t("common.back")}</Link>
      </div>
    );
  }

  const displayName = toTitleCase(member.name);
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const lastPaymentDate = payments[0]?.payment_date ?? null;
  const monthsCovered = buildMonthsCovered(payments as Array<{ payment_frequency?: string | null; reference_month?: string | null }>);
  const memberStatus = computeMemberStatus(
    lastPaymentDate,
    (member as Member & { contribution_frequency?: "weekly" | "monthly" | "one_time" | "flexible" }).contribution_frequency ?? "weekly",
    monthsCovered,
  );

  const handleDeletePayment = async (id: string) => {
    if (!confirm(t("memberProfile.deletePaymentConfirm"))) return;
    setDeletingId(id);
    const { error } = await supabase.from("payments").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(t("memberProfile.deleteFailed", { message: error.message }));
      return;
    }
    fetchData();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t("memberProfile.backToMembers")}
      </Link>

      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-primary overflow-hidden">
            {member.profile_photo_url ? (
              <img src={member.profile_photo_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-foreground">{displayName}</h2>
            <div className="mt-2 space-y-1.5">
              {member.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {member.email}</p>}
              {member.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> {formatPhoneDisplay(member.phone)}</p>}
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" /> {member.payment_type === "card" ? t("memberProfile.paymentTypeCard") : t("memberProfile.paymentTypeCash")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`status-badge ${member.status === "active" ? "status-active" : "status-inactive"}`}>
              {member.status === "active" ? t("memberStatus.active") : t("memberStatus.inactive")}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(memberStatus)}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(memberStatus)}`} />
              {t(`memberStatus.${memberStatus}`)}
            </span>
            {(() => {
              const bi = getBirthdayInfo(member.date_of_birth);
              if (bi?.daysUntil === 0) {
                return (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Cake className="h-3 w-3" /> {t("memberProfile.birthdayToday")} 🎂
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <h3 className="font-display text-base font-medium text-foreground mb-4">{t("memberProfile.personalInfo")}</h3>
          <div className="space-y-4">
            <FieldRow icon={Calendar} label={t("memberProfile.dateOfBirth")} value={member.date_of_birth ? formatLocalDateOnly(member.date_of_birth) : null} />
            <FieldRow icon={MapPin} label={t("memberProfile.address")} value={member.address} />
            <EmergencyBlock raw={member.emergency_contact} />
          </div>
        </div>

        <div className="card-elevated p-6">
          <h3 className="font-display text-base font-medium text-foreground mb-4">{t("memberProfile.churchInfo")}</h3>
          <div className="space-y-4">
            <FieldRow icon={Briefcase} label={t("memberProfile.role")} value={member.member_role} />
            <FieldRow icon={UsersIcon} label={t("memberProfile.department")} value={member.department} />
          </div>
        </div>
      </div>

      <div className="card-elevated p-6">
        <h3 className="font-display text-base font-medium text-foreground mb-4">{t("memberProfile.actions")}</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            {t("memberProfile.recordPayment")}
          </button>
          {isStaff && (
            <button
              onClick={() => setShowEditMember(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Edit className="h-4 w-4" />
              {t("memberProfile.editProfile")}
            </button>
          )}
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-medium text-foreground">{t("memberProfile.paymentHistory")}</h3>
        </div>
        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("memberProfile.noPayments")}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header px-5 py-3 text-left">{t("common.date")}</th>
                <th className="table-header px-5 py-3 text-left">{t("common.amount")}</th>
                <th className="table-header px-5 py-3 text-left">{t("common.method")}</th>
                <th className="table-header px-5 py-3 text-left">{t("common.status")}</th>
                <th className="table-header px-5 py-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-sm text-foreground">
                    {formatLocalDateOnly(p.payment_date)}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">
                    {formatUSD(p.amount)}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`status-badge status-${p.status === "past_due" ? "past-due" : p.status}`}>
                      {t(`paymentStatus.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingPayment(p)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title={t("memberProfile.editPayment")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        disabled={deletingId === p.id}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title={t("memberProfile.deletePayment")}
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
          memberName={displayName}
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
      {showEditMember && member && (
        <EditMemberModal
          member={member}
          onClose={() => setShowEditMember(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
