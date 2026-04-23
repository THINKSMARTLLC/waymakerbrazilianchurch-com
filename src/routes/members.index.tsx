import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Search, Eye, Edit, MoreVertical, UserX, UserCheck, DollarSign, History, KeyRound, Copy, Check, AlertTriangle, Archive, Download, Upload, Cake } from "lucide-react";
import { getBirthdayInfo, type BirthdayWindow } from "@/lib/birthday";
import { exportMembersCSV, exportMembersXLSX } from "@/lib/dataExportImport";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { useUserRole } from "@/hooks/useUserRole";
import { inactivateMember, reactivateMember } from "@/lib/memberLifecycle";
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

type LifecycleFilter = "active" | "inactive" | "all";

interface MembersSearch {
  status?: MemberPaymentStatus;
  lifecycle?: LifecycleFilter;
}

export const Route = createFileRoute("/members/")({
  validateSearch: (search: Record<string, unknown>): MembersSearch => ({
    status: (search.status as MemberPaymentStatus | undefined) ?? undefined,
    lifecycle: (search.lifecycle as LifecycleFilter | undefined) ?? undefined,
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
  const { status: statusParam, lifecycle: lifecycleParam } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<MemberPaymentStatus | "all">(statusParam ?? "all");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>(lifecycleParam ?? "active");
  const [birthdayFilter, setBirthdayFilter] = useState<"all" | BirthdayWindow>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [recordingFor, setRecordingFor] = useState<Member | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Member | null>(null);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [activeDupGroup, setActiveDupGroup] = useState<DuplicateGroup | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { isSuperAdmin } = useUserRole();

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      if (format === "csv") await exportMembersCSV();
      else await exportMembersXLSX();
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (statusParam) setStatusFilter(statusParam);
  }, [statusParam]);

  useEffect(() => {
    if (lifecycleParam) setLifecycleFilter(lifecycleParam);
  }, [lifecycleParam]);

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
    setDuplicateGroups(findDuplicateGroups(list));
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const toggleStatus = async (member: Member) => {
    if (member.status === "active") {
      await inactivateMember(member.id);
    } else {
      await reactivateMember(member.id);
    }
    fetchMembers();
  };

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        if (lifecycleFilter === "active" && m.status !== "active") return false;
        if (lifecycleFilter === "inactive" && m.status !== "inactive") return false;
        if (selectedMemberId && m.id !== selectedMemberId) return false;
        if (statusFilter !== "all" && m.payment_status !== statusFilter) return false;
        if (birthdayFilter !== "all") {
          const bi = getBirthdayInfo(m.date_of_birth);
          if (!bi) return false;
          if (birthdayFilter === "today" && bi.daysUntil !== 0) return false;
          if (birthdayFilter === "week" && bi.daysUntil > 7) return false;
          if (birthdayFilter === "month" && bi.daysUntil > 30) return false;
        }
        if (!search) return true;
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
      }),
    [members, search, statusFilter, selectedMemberId, lifecycleFilter, birthdayFilter]
  );

  const inactiveCount = useMemo(
    () => members.filter((m) => m.status === "inactive").length,
    [members],
  );

  // Map member.id -> the duplicate group it belongs to (if any).
  const groupByMemberId = useMemo(() => {
    const map = new Map<string, DuplicateGroup>();
    for (const g of duplicateGroups) for (const id of g.memberIds) map.set(id, g);
    return map;
  }, [duplicateGroups]);

  const totalDuplicateMembers = useMemo(
    () => duplicateGroups.reduce((sum, g) => sum + g.memberIds.length, 0),
    [duplicateGroups],
  );

  const openGroupForMember = (memberId: string) => {
    const g = groupByMemberId.get(memberId);
    if (g) setActiveDupGroup(g);
  };

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
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value as LifecycleFilter)}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by lifecycle status"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive{inactiveCount > 0 ? ` (${inactiveCount})` : ""}</option>
            <option value="all">All</option>
          </select>
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
            value={birthdayFilter}
            onChange={(e) => setBirthdayFilter(e.target.value as "all" | BirthdayWindow)}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by birthday"
          >
            <option value="all">All Birthdays</option>
            <option value="today">🎂 Birthday Today</option>
            <option value="week">Birthday This Week</option>
            <option value="month">Birthday This Month</option>
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
        <div className="flex items-center gap-2">
          <Link
            to="/members/archive"
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            title="View inactive (archived) members"
          >
            <Archive className="h-4 w-4" />
            Inactive {inactiveCount > 0 && <span className="rounded-full bg-muted px-1.5 text-xs">{inactiveCount}</span>}
          </Link>
          {isSuperAdmin && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")}>CSV (.csv)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                title="Import members from CSV/Excel"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            </>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn-google inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            New Member
          </button>
        </div>
      </div>

      {duplicateGroups.length > 0 && (() => {
        const trueDups = duplicateGroups.filter((g) => g.severity === "duplicate");
        const warnings = duplicateGroups.filter((g) => g.severity === "warning");
        const first = trueDups[0] ?? warnings[0];
        return (
          <button
            type="button"
            onClick={() => setActiveDupGroup(first)}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-4 py-3 text-left hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {trueDups.length > 0 && `${trueDups.length} duplicate group${trueDups.length > 1 ? "s" : ""}`}
                  {trueDups.length > 0 && warnings.length > 0 && " · "}
                  {warnings.length > 0 && `${warnings.length} shared-phone alert${warnings.length > 1 ? "s" : ""}`}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Duplicates (same email, or same name + phone) can be merged. Shared-phone alerts are informational only — both members coexist.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-amber-900 dark:text-amber-100 underline">Review</span>
          </button>
        );
      })()}

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
                  const dupGroup = groupByMemberId.get(member.id);
                  return (
                    <tr key={member.id} className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${dupGroup ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary overflow-hidden">
                            {member.profile_photo_url ? (
                              <img src={member.profile_photo_url} alt={member.name} className="h-full w-full object-cover" />
                            ) : (
                              member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                              {member.name}
                              {(() => {
                                const bi = getBirthdayInfo(member.date_of_birth);
                                return bi?.daysUntil === 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary" title="Aniversário hoje">
                                    <Cake className="h-3 w-3" /> Hoje
                                  </span>
                                ) : null;
                              })()}
                            </span>
                            {dupGroup && (
                              <button
                                type="button"
                                onClick={() => openGroupForMember(member.id)}
                                className="mt-0.5 inline-flex items-center gap-1 self-start rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                                title={
                                  dupGroup.severity === "warning"
                                    ? "Shared phone with another member (different name/email) — both records coexist."
                                    : `Possible duplicate (matched by ${dupGroup.reason.join(", ")})`
                                }
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {dupGroup.severity === "warning" ? "Shared phone" : "Duplicate detected"}
                              </button>
                            )}
                          </div>
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

      {activeDupGroup && (
        <DuplicateResolutionModal
          members={activeDupGroup.memberIds
            .map((id) => members.find((m) => m.id === id))
            .filter((m): m is MemberWithStatus => !!m)}
          reasons={activeDupGroup.reason}
          severity={activeDupGroup.severity}
          onClose={() => setActiveDupGroup(null)}
          onResolved={() => {
            setActiveDupGroup(null);
            fetchMembers();
          }}
        />
      )}

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
      <ImportPreviewModal open={showImport} onClose={() => setShowImport(false)} onImported={fetchMembers} />
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

  // Controlled identity fields — needed for real-time duplicate detection.
  const [emailInput, setEmailInput] = useState(member?.email ?? "");
  const [nameInput, setNameInput] = useState(member?.name ?? "");

  // Duplicate detection state.
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [allowOverride, setAllowOverride] = useState(false);
  // Admin's explicit resolution of detected duplicates. Until set, Save is blocked.
  const [duplicateResolution, setDuplicateResolution] = useState<"update" | "merge" | null>(null);
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

  const runDuplicateCheck = async (email: string | null, phone: string | null, name: string | null) => {
    if (!email && !phone) {
      setDuplicates([]);
      setDuplicateResolution(null);
      return [];
    }
    setCheckingDupes(true);
    const found = await findDuplicates({ email, phone, name, excludeMemberId: member?.id });
    setCheckingDupes(false);
    setDuplicates(found);
    // Any change to detected duplicates clears the prior resolution — admin must reconfirm.
    setDuplicateResolution(null);
    return found;
  };

  // Real-time duplicate check: as the admin types email/phone/name, debounce
  // and hit the duplicate detector so the warning surfaces BEFORE saving.
  useEffect(() => {
    const emailNorm = emailInput.trim().toLowerCase() || null;
    const phoneNorm = buildE164();
    const nameNorm = nameInput.trim() || null;
    if (!emailNorm && !phoneNorm) {
      setDuplicates([]);
      return;
    }
    const handle = setTimeout(() => {
      runDuplicateCheck(emailNorm, phoneNorm, nameNorm);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailInput, phoneNumber, country, otherDial, nameInput]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    // Normalize identity fields: lowercase + trim email, trim name.
    const emailRaw = ((form.get("email") as string) || "").trim().toLowerCase() || null;
    const phoneRaw = buildE164();
    const nameRaw = toTitleCase((form.get("name") as string).trim());
    const payload = {
      name: nameRaw,
      email: emailRaw,
      phone: phoneRaw,
      payment_type: form.get("payment_type") as "card" | "cash",
      contribution_frequency: frequency,
      weekly_contribution_usd: weeklyNum,
    };

    // Duplicate detection — when true duplicates exist, REQUIRE the admin to
    // explicitly choose a resolution (Update existing or Merge records) before
    // we proceed. Shared-phone warnings are informational and do not block.
    if (!allowOverride) {
      const found = await runDuplicateCheck(emailRaw, phoneRaw, nameRaw);
      const blocking = found.filter((m) => m.severity === "duplicate");
      if (blocking.length > 0) {
        setPendingPayload(payload);
        if (duplicateResolution === "update") {
          // Admin confirmed: update the existing record (lookup-first in persistMember).
          await persistMember(payload);
          return;
        }
        if (duplicateResolution === "merge") {
          // Open merge modal with the first blocking match.
          const target = blocking.find((m) => m.source === "member" && m.member);
          if (target?.member) setMergeWith(target.member);
          return;
        }
        // No resolution chosen yet — stop and force the admin to pick one.
        setError("Duplicate detected. Please choose 'Update existing member' or 'Merge records' below before saving.");
        return;
      }
    }

    await persistMember(payload);
  };

  const persistMember = async (payload: Record<string, unknown>) => {
    setSaving(true);

    // Build a safe update patch — NEVER overwrite email or id on existing rows.
    // Merge only mutable identity/profile fields.
    const stripIdentity = (p: Record<string, unknown>) => {
      const { email: _e, id: _i, ...rest } = p;
      void _e; void _i;
      return rest;
    };

    const findExistingByEmail = async (email: string) => {
      const { data, error } = await supabase
        .from("members")
        .select("id, created_at")
        .eq("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return { data, error };
    };

    let data: Member | null = null;
    let dbErr: { message: string } | null = null;
    let createdNew = false;

    if (isEditing) {
      // Editing existing: keep original email — don't send email in patch.
      const patch = stripIdentity(payload);
      const res = await supabase.from("members").update(patch as never).eq("id", member!.id).select().single();
      data = res.data as Member | null;
      dbErr = res.error;
    } else {
      // CREATE flow: lookup-first by normalized email so no duplicate attempt
      // ever reaches the database layer.
      const emailVal = (payload.email as string | null) || null;
      if (emailVal) {
        const existingRes = await findExistingByEmail(emailVal);
        if (existingRes.data?.id) {
          console.warn(`Duplicate prevented for email: ${emailVal} — updating existing record ${existingRes.data.id}`);
          const patch = stripIdentity(payload); // never overwrite email/id
          const upd = await supabase.from("members").update(patch as never).eq("id", existingRes.data.id).select().single();
          data = upd.data as Member | null;
          dbErr = upd.error;
        } else if (existingRes.error && !/0 rows/i.test(existingRes.error.message)) {
          dbErr = existingRes.error;
        } else {
          const ins = await supabase.from("members").insert(payload as never).select().single();
          data = ins.data as Member | null;
          dbErr = ins.error;
          createdNew = !ins.error;
        }
      } else {
        const ins = await supabase.from("members").insert(payload as never).select().single();
        data = ins.data as Member | null;
        dbErr = ins.error;
        createdNew = !ins.error;
      }

      // Defensive fallback — if a race still produced a unique violation,
      // resolve it by updating the existing row instead of surfacing an error.
      if (dbErr && /duplicate|unique/i.test(dbErr.message) && emailVal) {
        console.warn(`Duplicate prevented (race) for email: ${emailVal}`);
        const existingRes = await findExistingByEmail(emailVal);
        if (existingRes.data?.id) {
          const patch = stripIdentity(payload);
          const upd = await supabase.from("members").update(patch as never).eq("id", existingRes.data.id).select().single();
          data = upd.data as Member | null;
          dbErr = upd.error;
          createdNew = false;
        }
      }
    }

    if (dbErr) {
      setError(dbErr.message);
      setSaving(false);
      return;
    }

    // For new admin-created members: generate a temp access code only when a
    // brand-new row was actually inserted.
    if (!isEditing && createdNew && data) {
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
            <input name="name" type="text" required value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input name="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="email@example.com" />
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
