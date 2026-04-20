import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Search, Eye, Edit, MoreVertical, UserX, UserCheck, DollarSign, History, KeyRound, Copy, Check, AlertTriangle } from "lucide-react";
import { useState, useEffect, useMemo, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUSD, toTitleCase } from "@/lib/format";
import { RecordPaymentModal } from "@/components/RecordPaymentModal";
import { ContributionsModal } from "@/components/ContributionsModal";
import { computeMemberStatus, STATUS_LABEL, statusBadgeClasses, statusDotClasses, FREQUENCY_LABEL, type MemberPaymentStatus, type ContributionFrequency } from "@/lib/memberStatus";
import { formatPhoneDisplay } from "@/lib/phone";
import { findDuplicates, findDuplicateGroups, generateTempAccessCode, type DuplicateMatch, type DuplicateGroup } from "@/lib/duplicates";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { MergeMembersModal } from "@/components/MergeMembersModal";
import { DuplicateResolutionModal } from "@/components/DuplicateResolutionModal";

interface MembersSearch {
  status?: MemberPaymentStatus;
}

export const Route = createFileRoute("/members/")({
  validateSearch: (search: Record<string, unknown>): MembersSearch => ({
    status: (search.status as MemberPaymentStatus | undefined) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Members — WAY MAKER FLOW" },
      { name: "description", content: "Manage church members and weekly contributions" },
    ],
  }),
  component: MembersPage,
});

type Member = Database["public"]["Tables"]["members"]["Row"];

interface MemberWithStatus extends Member {
  last_payment_date: string | null;
  last_payment_method: string | null;
  payment_status: MemberPaymentStatus;
  monthly_total: number;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  zelle: "Zelle",
  venmo: "Venmo",
  card: "Card",
  stripe: "Card",
  paypal: "PayPal",
  other: "Other",
};

function MembersPage() {
  const { status: statusParam } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<MemberPaymentStatus | "all">(statusParam ?? "all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [recordingFor, setRecordingFor] = useState<Member | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Member | null>(null);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [activeDupGroup, setActiveDupGroup] = useState<DuplicateGroup | null>(null);

  useEffect(() => {
    if (statusParam) setStatusFilter(statusParam);
  }, [statusParam]);

  const fetchMembers = async () => {
    const { data: membersData } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });

    const list = membersData || [];
    const ids = list.map((m) => m.id);

    let lastByMember = new Map<string, { payment_date: string; payment_method: string }>();
    const monthsByMember = new Map<string, Set<string>>();
    const monthlyTotalByMember = new Map<string, number>();

    // Current month boundaries (local time) for dynamic monthly total.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (ids.length > 0) {
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("member_id, payment_date, payment_method, payment_frequency, reference_month, amount")
        .in("member_id", ids)
        .order("payment_date", { ascending: false });

      const monthStartStr = toYMD(monthStart);
      const monthEndStr = toYMD(monthEnd);

      for (const p of paymentsData || []) {
        if (!lastByMember.has(p.member_id)) {
          lastByMember.set(p.member_id, { payment_date: p.payment_date, payment_method: p.payment_method });
        }
        if (p.payment_frequency === "monthly" && p.reference_month) {
          const d = new Date(p.reference_month);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          if (!monthsByMember.has(p.member_id)) monthsByMember.set(p.member_id, new Set());
          monthsByMember.get(p.member_id)!.add(key);
        }
        // Sum real payments inside current calendar month (by payment_date).
        if (p.payment_date >= monthStartStr && p.payment_date < monthEndStr) {
          monthlyTotalByMember.set(
            p.member_id,
            (monthlyTotalByMember.get(p.member_id) ?? 0) + Number(p.amount || 0),
          );
        }
      }
    }

    const withStatus: MemberWithStatus[] = list.map((m) => {
      const last = lastByMember.get(m.id);
      const freq = (m as Member & { contribution_frequency?: ContributionFrequency }).contribution_frequency ?? "weekly";
      return {
        ...m,
        name: toTitleCase(m.name),
        last_payment_date: last?.payment_date ?? null,
        last_payment_method: last?.payment_method ?? null,
        payment_status: computeMemberStatus(last?.payment_date ?? null, freq, monthsByMember.get(m.id) ?? null),
        monthly_total: monthlyTotalByMember.get(m.id) ?? 0,
      };
    });

    // Default alphabetical sort by first name (A → Z), case-insensitive.
    withStatus.sort((a, b) => {
      const aFirst = (a.name || "").split(" ")[0] || "";
      const bFirst = (b.name || "").split(" ")[0] || "";
      return aFirst.localeCompare(bFirst, undefined, { sensitivity: "base" });
    });

    setMembers(withStatus);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    await supabase.from("members").update({ status: newStatus }).eq("id", member.id);
    fetchMembers();
  };

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        if (selectedMemberId && m.id !== selectedMemberId) return false;
        if (statusFilter !== "all" && m.payment_status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
      }),
    [members, search, statusFilter, selectedMemberId]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberPaymentStatus | "all")}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by payment status"
          >
            <option value="all">All Payment Statuses</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="no_payment">No Payment Yet</option>
          </select>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[220px]"
            aria-label="Select Member"
          >
            <option value="">Select Member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-google inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          New Member
        </button>
      </div>

      <div className="card-elevated overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {members.length === 0 ? "No members yet." : "No results."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header px-5 py-3 text-left">Name</th>
                  <th className="table-header px-5 py-3 text-left hidden lg:table-cell">Email</th>
                  <th className="table-header px-5 py-3 text-left hidden xl:table-cell">Phone</th>
                  <th className="table-header px-5 py-3 text-right">Weekly</th>
                  <th className="table-header px-5 py-3 text-right hidden md:table-cell">Monthly</th>
                  <th className="table-header px-5 py-3 text-left hidden md:table-cell">Last Payment</th>
                  <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Method</th>
                  <th className="table-header px-5 py-3 text-left">Status</th>
                  <th className="table-header px-5 py-3 text-left">Payment</th>
                  <th className="table-header px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => {
                  const weekly = Number(member.weekly_contribution_usd) || 0;
                  return (
                    <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary overflow-hidden">
                            {member.profile_photo_url ? (
                              <img src={member.profile_photo_url} alt={member.name} className="h-full w-full object-cover" />
                            ) : (
                              member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                            )}
                          </div>
                          <span className="text-sm font-medium text-foreground">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground hidden lg:table-cell">{member.email}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground hidden xl:table-cell">{formatPhoneDisplay(member.phone)}</td>
                      <td className="px-5 py-3.5 text-sm text-foreground text-right tabular-nums">{formatUSD(weekly)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground text-right tabular-nums hidden md:table-cell" title="Sum of payments in current month">{formatUSD(member.monthly_total)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">
                        {member.last_payment_date ? new Date(member.last_payment_date).toLocaleDateString("en-US") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground hidden sm:table-cell">
                        {member.last_payment_method ? (PAYMENT_METHOD_LABEL[member.last_payment_method] ?? member.last_payment_method) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`status-badge ${member.status === "active" ? "status-active" : "status-inactive"}`}>
                          {member.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(member.payment_status)}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(member.payment_status)}`} />
                          {STATUS_LABEL[member.payment_status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setRecordingFor(member)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Record Payment"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setViewingHistoryFor(member)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="View Contributions"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <Link
                            to="/members/$memberId"
                            params={{ memberId: member.id }}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(member)}>
                                {member.status === "active" ? (
                                  <>
                                    <UserX className="h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Reactivate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <MemberFormModal onClose={() => setShowAddModal(false)} onSaved={fetchMembers} />}
      {editingMember && <MemberFormModal member={editingMember} onClose={() => setEditingMember(null)} onSaved={fetchMembers} />}
      {recordingFor && (
        <RecordPaymentModal
          memberId={recordingFor.id}
          memberName={recordingFor.name}
          defaultAmount={Number(recordingFor.weekly_contribution_usd) || undefined}
          onClose={() => setRecordingFor(null)}
          onSaved={fetchMembers}
        />
      )}
      {viewingHistoryFor && (
        <ContributionsModal
          memberId={viewingHistoryFor.id}
          memberName={viewingHistoryFor.name}
          onClose={() => setViewingHistoryFor(null)}
          onChanged={fetchMembers}
        />
      )}
    </div>
  );
}

type CountryKey = "US" | "BR" | "OTHER";
const COUNTRIES: Record<CountryKey, { label: string; dial: string; flag: string }> = {
  US: { label: "United States", dial: "+1", flag: "🇺🇸" },
  BR: { label: "Brazil", dial: "+55", flag: "🇧🇷" },
  OTHER: { label: "Other", dial: "", flag: "🌎" },
};

function detectCountryFromPhone(phone: string | null): { country: CountryKey; number: string } {
  if (!phone) return { country: "US", number: "" };
  const trimmed = phone.trim();
  if (trimmed.startsWith("+1")) return { country: "US", number: trimmed.slice(2).trim() };
  if (trimmed.startsWith("+55")) return { country: "BR", number: trimmed.slice(3).trim() };
  if (trimmed.startsWith("+")) return { country: "OTHER", number: trimmed };
  return { country: "US", number: trimmed };
}

function MemberFormModal({ member, onClose, onSaved }: { member?: Member; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [weekly, setWeekly] = useState<string>(String(member?.weekly_contribution_usd ?? ""));
  const initialFreq = ((member as Member & { contribution_frequency?: ContributionFrequency })?.contribution_frequency) ?? "weekly";
  const [frequency, setFrequency] = useState<ContributionFrequency>(initialFreq);
  const isEditing = !!member;

  const initial = detectCountryFromPhone(member?.phone ?? null);
  const [country, setCountry] = useState<CountryKey>(initial.country);
  const [phoneNumber, setPhoneNumber] = useState(initial.number);
  const [otherDial, setOtherDial] = useState(country === "OTHER" && initial.number.startsWith("+")
    ? initial.number.split(" ")[0]
    : "+");

  // Duplicate detection state.
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [allowOverride, setAllowOverride] = useState(false);
  const [mergeWith, setMergeWith] = useState<Member | null>(null);
  // Pending submit values used by the merge modal.
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  // Credential issued for admin-created members.
  const [tempCredential, setTempCredential] = useState<{ identifier: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const buildE164 = (): string | null => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (!digits) return null;
    if (country === "US") return `+1${digits}`;
    if (country === "BR") return `+55${digits}`;
    const dial = otherDial.startsWith("+") ? otherDial.replace(/[^\d+]/g, "") : `+${otherDial.replace(/\D/g, "")}`;
    return `${dial}${digits}`;
  };

  const weeklyNum = Number(weekly) || 0;
  const monthlyNum = weeklyNum * 4;

  const runDuplicateCheck = async (email: string | null, phone: string | null) => {
    if (!email && !phone) {
      setDuplicates([]);
      return [];
    }
    setCheckingDupes(true);
    const found = await findDuplicates({ email, phone, excludeMemberId: member?.id });
    setCheckingDupes(false);
    setDuplicates(found);
    return found;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const emailRaw = ((form.get("email") as string) || "").trim() || null;
    const phoneRaw = buildE164();
    const payload = {
      name: toTitleCase(form.get("name") as string),
      email: emailRaw,
      phone: phoneRaw,
      payment_type: form.get("payment_type") as "card" | "cash",
      contribution_frequency: frequency,
      weekly_contribution_usd: weeklyNum,
    };

    // Duplicate detection — only block if user hasn't chosen "create anyway".
    if (!allowOverride) {
      const found = await runDuplicateCheck(emailRaw, phoneRaw);
      if (found.length > 0) {
        setPendingPayload(payload);
        return; // Stop submit — admin must resolve via the warning UI.
      }
    }

    await persistMember(payload);
  };

  const persistMember = async (payload: Record<string, unknown>) => {
    setSaving(true);
    const { data, error: dbErr } = isEditing
      ? await supabase.from("members").update(payload as never).eq("id", member!.id).select().single()
      : await supabase.from("members").insert(payload as never).select().single();

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }

    // For new admin-created members: generate a temp access code and show it.
    if (!isEditing && data) {
      const code = generateTempAccessCode();
      const identifier = (payload.email as string) || (payload.phone as string) || (payload.name as string);
      setTempCredential({ identifier, code });
      setSaving(false);
      onSaved(); // Refresh the list behind the credential screen.
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleKeepExisting = (_match: DuplicateMatch) => {
    onClose();
  };

  const handleMerge = (match: DuplicateMatch) => {
    if (!match.member) return;
    setMergeWith(match.member);
  };

  const handleCreateAnyway = () => {
    setAllowOverride(true);
    setDuplicates([]);
    if (pendingPayload) {
      persistMember(pendingPayload);
    }
  };

  const handleMergeCompleted = () => {
    setMergeWith(null);
    onSaved();
    onClose();
  };

  const copyCredential = async () => {
    if (!tempCredential) return;
    const text = `Login: ${tempCredential.identifier}\nTemporary code: ${tempCredential.code}\nPlease log in and change your password.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  // Credential success screen (after admin-created member).
  if (tempCredential) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
        <div className="card-elevated w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-primary/10 p-2">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">Member Created</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Share these temporary credentials with the new member. They should log in and change their password on first access.
          </p>
          <div className="rounded-xl bg-muted p-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Login</div>
              <div className="text-sm font-medium text-foreground break-all">{tempCredential.identifier}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Temporary code</div>
              <div className="font-mono text-lg font-bold tracking-wider text-foreground">{tempCredential.code}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={copyCredential}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy credentials</>}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-google w-full mt-2"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="card-elevated w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-semibold text-foreground mb-5">
          {isEditing ? "Edit Member" : "New Member"}
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          {duplicates.length > 0 && (
            <DuplicateWarning
              matches={duplicates}
              onKeepExisting={handleKeepExisting}
              onMerge={handleMerge}
              onCreateAnyway={handleCreateAnyway}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
            <input name="name" type="text" required defaultValue={member?.name ?? ""} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input name="email" type="email" defaultValue={member?.email ?? ""} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
            <div className="flex gap-2">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryKey)}
                className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Country"
              >
                {(Object.keys(COUNTRIES) as CountryKey[]).map((k) => (
                  <option key={k} value={k}>
                    {COUNTRIES[k].flag} {COUNTRIES[k].label} {COUNTRIES[k].dial && `(${COUNTRIES[k].dial})`}
                  </option>
                ))}
              </select>
              {country === "OTHER" && (
                <input
                  type="text"
                  value={otherDial}
                  onChange={(e) => setOtherDial(e.target.value)}
                  placeholder="+44"
                  className="w-20 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Dial code"
                />
              )}
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={country === "US" ? "215 555 1234" : country === "BR" ? "11 99999 9999" : "phone number"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Weekly Contribution (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weekly}
                onChange={(e) => setWeekly(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-input bg-background pl-7 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Monthly (auto): <span className="font-medium text-foreground">{formatUSD(monthlyNum)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contribution Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ContributionFrequency)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(FREQUENCY_LABEL) as ContributionFrequency[]).map((k) => (
                <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {frequency === "weekly" && "Late after 7 days without payment."}
              {frequency === "monthly" && "Late after 30 days without payment."}
              {frequency === "one_time" && "Never marked Late once a payment is recorded."}
              {frequency === "flexible" && "Always shown as Active regardless of payment timing."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Default Payment Method</label>
            <select name="payment_type" defaultValue={member?.payment_type ?? "card"} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="card">Card</option>
              <option value="cash">Cash</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Members can pay via Card, Cash, Zelle, Venmo, PayPal, or Other when recording a payment.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || checkingDupes} className="btn-google flex-1 disabled:opacity-50">
              {saving ? "Saving..." : checkingDupes ? "Checking..." : isEditing ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>

      {mergeWith && pendingPayload && (
        <MergeMembersModal
          existing={mergeWith}
          candidate={{
            name: String(pendingPayload.name ?? ""),
            email: (pendingPayload.email as string | null) ?? null,
            phone: (pendingPayload.phone as string | null) ?? null,
            payment_type: pendingPayload.payment_type as "card" | "cash",
            weekly_contribution_usd: weeklyNum,
          }}
          candidateMemberId={isEditing ? member!.id : undefined}
          onClose={() => setMergeWith(null)}
          onMerged={handleMergeCompleted}
        />
      )}
    </div>
  );
}
