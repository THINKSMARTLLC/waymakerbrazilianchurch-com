import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, CreditCard, Users, AlertTriangle, Receipt, Pencil, Trash2, UserX, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportPaymentsCSV, exportPaymentsXLSX, type PaymentsExportOpts } from "@/lib/dataExportImport";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD, toTitleCase } from "@/lib/format";
import { computeMemberStatus, STATUS_LABEL, statusBadgeClasses, statusDotClasses, type MemberPaymentStatus } from "@/lib/memberStatus";
import { PAYMENT_METHOD_LABEL } from "@/components/RecordPaymentModal";
import { EditPaymentModal } from "@/components/EditPaymentModal";
import { MemberFinancialDrawer } from "@/components/MemberFinancialDrawer";
import type { Database } from "@/integrations/supabase/types";

interface ReportsSearch {
  range?: "this_month" | "last_month" | "all" | "custom";
}

export const Route = createFileRoute("/reports")({
  validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
    range: (search.range as ReportsSearch["range"]) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reports — Way Maker Church" },
      { name: "description", content: "Financial reports and donations" },
    ],
  }),
  component: ReportsPage,
});

type FilterRange = "this_month" | "last_month" | "all" | "custom";
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

interface PaymentWithMember extends Payment {
  members: { id: string; name: string; email: string | null; phone: string | null; stripe_customer_id: string | null } | null;
}

function getDateRange(filter: FilterRange, customStart?: string, customEnd?: string): { start: string | null; end: string | null } {
  const now = new Date();
  if (filter === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  if (filter === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  if (filter === "custom") {
    return { start: customStart || null, end: customEnd || null };
  }
  return { start: null, end: null };
}

function ReportsPage() {
  const { t } = useTranslation();
  const { range } = Route.useSearch();
  const [filter, setFilter] = useState<FilterRange>(range ?? "this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [memberIdFilter, setMemberIdFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MemberPaymentStatus | "all" | "paid">("all");
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [groupBy, setGroupBy] = useState<"transactions" | "member" | "payer" | "beneficiary" | "household">("member");

  // Latest payment dates per member (status — uses ALL payments, not just filtered range)
  const [lastByMember, setLastByMember] = useState<Map<string, string>>(new Map());
  const [monthsByMember, setMonthsByMember] = useState<Map<string, Set<string>>>(new Map());

  // Edit modal
  const [editing, setEditing] = useState<Payment | null>(null);
  const { isSuperAdmin } = useUserRole();
  const [exportingPayments, setExportingPayments] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);

  const buildExportOpts = (mode: "all" | "filtered" | "selected"): PaymentsExportOpts => {
    if (mode === "all") return {};
    const { start, end } = getDateRange(filter, customStart, customEnd);
    const opts: PaymentsExportOpts = { start, end };
    if (methodFilter !== "all") opts.method = methodFilter;
    if (mode === "selected") opts.memberIds = Array.from(selectedIds);
    else if (mode === "filtered") {
      // visible member ids in the current member view
      opts.memberIds = filteredMembers.map((m) => m.id);
    }
    return opts;
  };

  const handleExportPayments = async (format: "csv" | "xlsx", mode: "all" | "filtered" | "selected" = "all") => {
    setExportingPayments(true);
    try {
      const opts = buildExportOpts(mode);
      if (format === "csv") await exportPaymentsCSV(opts);
      else await exportPaymentsXLSX(opts);
    } finally {
      setExportingPayments(false);
    }
  };

  const handleResyncStripe = async () => {
    if (resyncing) return;
    setResyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/resync-stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Resync failed: ${json?.error ?? "Unknown error"}`);
      } else {
        const s = json.stats ?? {};
        alert(
          `Stripe resync complete.\n\nCustomers scanned: ${s.customersScanned ?? 0}\nMembers updated: ${s.membersUpdated ?? 0}\nPayments inserted: ${s.paymentsInserted ?? 0}\nPayments skipped (already synced): ${s.paymentsSkipped ?? 0}\nUnmatched Stripe customers: ${s.membersUnmatched ?? 0}`,
        );
        await refresh();
      }
    } catch (err) {
      alert(`Resync error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResyncing(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    const { start, end } = getDateRange(filter, customStart, customEnd);

    let query = supabase
      .from("payments")
      .select("*, members(id, name, email, phone, stripe_customer_id)")
      .order("payment_date", { ascending: false });

    if (start) query = query.gte("payment_date", start);
    if (end) query = query.lte("payment_date", end);

    const [{ data: paysData }, { data: lastData }, { data: membersData }] = await Promise.all([
      query,
      supabase.from("payments").select("member_id, payment_date, payment_frequency, reference_month").order("payment_date", { ascending: false }),
      supabase.from("members").select("*").order("name", { ascending: true }),
    ]);

    setPayments((paysData as PaymentWithMember[]) || []);
    setMembers((membersData as MemberRow[]) || []);

    const map = new Map<string, string>();
    const monthsMap = new Map<string, Set<string>>();
    for (const p of lastData || []) {
      if (!map.has(p.member_id)) map.set(p.member_id, p.payment_date);
      if (p.payment_frequency === "monthly" && p.reference_month) {
        const d = new Date(p.reference_month);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (!monthsMap.has(p.member_id)) monthsMap.set(p.member_id, new Set());
        monthsMap.get(p.member_id)!.add(key);
      }
    }
    setLastByMember(map);
    setMonthsByMember(monthsMap);

    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [filter, customStart, customEnd]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }
    refresh();
  };

  // Status per member id
  const statusByMember = useMemo(() => {
    const m = new Map<string, MemberPaymentStatus>();
    for (const mem of members) {
      const status = computeMemberStatus(
        lastByMember.get(mem.id) ?? null,
        mem.contribution_frequency ?? "weekly",
        monthsByMember.get(mem.id) ?? null,
      );
      m.set(mem.id, status);
    }
    return m;
  }, [members, lastByMember, monthsByMember]);

  // Sorted alphabetical members
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => toTitleCase(a.name).localeCompare(toTitleCase(b.name))),
    [members],
  );

  // Filter payments by name/method/status/member dropdown
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (memberIdFilter !== "all" && p.members?.id !== memberIdFilter) return false;
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        const m = p.members;
        const hit =
          m?.name?.toLowerCase().includes(q) ||
          m?.email?.toLowerCase().includes(q) ||
          m?.phone?.toLowerCase().includes(q) ||
          m?.stripe_customer_id?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (methodFilter !== "all") {
        const normalized = p.payment_method === "stripe" ? "card" : p.payment_method;
        if (normalized !== methodFilter) return false;
      }
      if (statusFilter !== "all" && p.members) {
        const s = statusByMember.get(p.members.id) ?? "no_payment";
        if (statusFilter === "paid") {
          if (s !== "on_time" && s !== "active") return false;
        } else if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [payments, memberIdFilter, nameFilter, methodFilter, statusFilter, statusByMember]);

  // Members visible in table (member-centric)
  const filteredMembers = useMemo(() => {
    return sortedMembers.filter((m) => {
      if (memberIdFilter !== "all" && m.id !== memberIdFilter) return false;
      if (nameFilter && !m.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      const status = statusByMember.get(m.id) ?? "no_payment";
      if (statusFilter !== "all") {
        if (statusFilter === "paid") {
          if (status !== "on_time" && status !== "active") return false;
        } else if (status !== statusFilter) return false;
      }
      // Method filter: member must have at least one payment of this method (in range)
      if (methodFilter !== "all") {
        const has = payments.some((p) => {
          if (p.member_id !== m.id) return false;
          const norm = p.payment_method === "stripe" ? "card" : p.payment_method;
          return norm === methodFilter;
        });
        if (!has) return false;
      }
      return true;
    });
  }, [sortedMembers, memberIdFilter, nameFilter, statusFilter, methodFilter, statusByMember, payments]);

  // Metrics
  const totalMembers = members.length;

  const noPaymentCount = useMemo(
    () => members.filter((m) => (statusByMember.get(m.id) ?? "no_payment") === "no_payment").length,
    [members, statusByMember],
  );

  const lateMembersCount = useMemo(
    () => members.filter((m) => (statusByMember.get(m.id) ?? "no_payment") === "late").length,
    [members, statusByMember],
  );

  const distinctPaidMembers = useMemo(() => {
    const ids = new Set<string>();
    for (const p of filteredPayments) {
      if (p.status === "paid" && p.members) ids.add(p.members.id);
    }
    return ids.size;
  }, [filteredPayments]);

  const totalPayments = filteredPayments.length;

  const cardTotal = filteredPayments
    .filter((p) => p.status === "paid" && (p.payment_method === "stripe" || p.payment_method === "card"))
    .reduce((s, p) => s + Number(p.amount), 0);

  const cashTotal = filteredPayments
    .filter((p) => p.status === "paid" && p.payment_method === "cash")
    .reduce((s, p) => s + Number(p.amount), 0);

  // Per-member aggregation (includes members without payments)
  const memberRows = useMemo(() => {
    const agg = new Map<string, { count: number; total: number; last: string | null }>();
    for (const p of filteredPayments) {
      if (!p.members) continue;
      const cur = agg.get(p.members.id);
      if (cur) {
        cur.count += 1;
        cur.total += Number(p.amount);
        if (!cur.last || p.payment_date > cur.last) cur.last = p.payment_date;
      } else {
        agg.set(p.members.id, { count: 1, total: Number(p.amount), last: p.payment_date });
      }
    }
    return filteredMembers.map((m) => {
      const a = agg.get(m.id);
      return {
        id: m.id,
        name: toTitleCase(m.name),
        email: m.email,
        count: a?.count ?? 0,
        total: a?.total ?? 0,
        last: a?.last ?? null,
        status: statusByMember.get(m.id) ?? "no_payment",
      };
    });
  }, [filteredPayments, filteredMembers, statusByMember]);

  // Aggregations by payer / beneficiary
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  type RelRow = { id: string; name: string; count: number; total: number; partners: Set<string> };
  const buildRelRows = (key: "payer_member_id" | "beneficiary_member_id", partnerKey: "payer_member_id" | "beneficiary_member_id") => {
    const agg = new Map<string, RelRow>();
    for (const p of filteredPayments) {
      const id = (p as Payment)[key] ?? p.member_id;
      if (!id) continue;
      const partnerId = (p as Payment)[partnerKey] ?? p.member_id;
      const m = memberById.get(id);
      const cur = agg.get(id) ?? { id, name: toTitleCase(m?.name ?? p.members?.name ?? "—"), count: 0, total: 0, partners: new Set<string>() };
      cur.count += 1;
      cur.total += Number(p.amount);
      if (partnerId && partnerId !== id) cur.partners.add(partnerId);
      agg.set(id, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.total - a.total);
  };

  const payerRows = useMemo(() => buildRelRows("payer_member_id", "beneficiary_member_id"), [filteredPayments, memberById]);
  const beneficiaryRows = useMemo(() => buildRelRows("beneficiary_member_id", "payer_member_id"), [filteredPayments, memberById]);

  // Households: group by payer where payer has 2+ distinct beneficiaries
  const householdRows = useMemo(() => payerRows.filter((r) => r.partners.size >= 1), [payerRows]);

  const handleStatusCardClick = (status: MemberPaymentStatus | "paid") => {
    setStatusFilter((cur) => (cur === status ? "all" : status));
    setShowAllMembers(false);
    setGroupBy("member");
  };

  const handleTotalMembersClick = () => {
    setShowAllMembers((v) => !v);
    setStatusFilter("all");
    setMemberIdFilter("all");
    setNameFilter("");
    setMethodFilter("all");
    setGroupBy("member");
  };

  const handleMethodCardClick = (method: "card" | "cash") => {
    setMethodFilter((cur) => (cur === method ? "all" : method));
    setStatusFilter("all");
    setShowAllMembers(false);
    setGroupBy("transactions");
  };

  const handleTotalPaymentsClick = () => {
    setGroupBy((cur) => (cur === "transactions" ? "member" : "transactions"));
    setShowAllMembers(true);
  };

  const hasActiveFilter =
    memberIdFilter !== "all" ||
    nameFilter.trim() !== "" ||
    methodFilter !== "all" ||
    statusFilter !== "all" ||
    showAllMembers ||
    groupBy === "transactions";

  const clearFilters = () => {
    setMemberIdFilter("all");
    setNameFilter("");
    setMethodFilter("all");
    setStatusFilter("all");
    setShowAllMembers(false);
    setGroupBy("member");
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: "this_month" as const, label: "This Month" },
          { value: "last_month" as const, label: "Last Month" },
          { value: "all" as const, label: "All Time" },
          { value: "custom" as const, label: "Custom" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
        {filter === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        {isSuperAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleResyncStripe}
              disabled={resyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Re-fetch all Stripe customers, subscriptions and invoices and rebuild member payment status"
            >
              <CreditCard className="h-4 w-4" />
              {resyncing ? "Resyncing…" : "Resync Stripe Data"}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={exportingPayments}
                  className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Payments
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPayments("csv")}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPayments("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <button
          onClick={handleTotalMembersClick}
          className={`stat-card text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${showAllMembers ? "ring-2 ring-primary" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Total Members</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{totalMembers}</p>
        </button>
        <button
          onClick={() => handleStatusCardClick("paid")}
          className={`stat-card text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${statusFilter === "paid" ? "ring-2 ring-emerald-500" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Paid Members</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{distinctPaidMembers}</p>
        </button>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="h-4 w-4" />Total Payments</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{totalPayments}</p>
        </div>
        <button
          onClick={() => handleStatusCardClick("late")}
          className={`stat-card text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${statusFilter === "late" ? "ring-2 ring-destructive" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />Late Members</div>
          <p className="mt-1 font-display text-2xl font-semibold text-destructive">{lateMembersCount}</p>
        </button>
        <button
          onClick={() => handleStatusCardClick("no_payment")}
          className={`stat-card text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${statusFilter === "no_payment" ? "ring-2 ring-primary" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><UserX className="h-4 w-4" />No Payment Yet</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{noPaymentCount}</p>
        </button>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" />Card</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatUSD(cardTotal)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Cash</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{formatUSD(cashTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filters</span>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Select Member</label>
          <select
            value={memberIdFilter}
            onChange={(e) => setMemberIdFilter(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Members</option>
            {sortedMembers.map((m) => (
              <option key={m.id} value={m.id}>{toTitleCase(m.name)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder={t("payerBeneficiary.searchPlaceholder")}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="zelle">Zelle</option>
            <option value="venmo">Venmo</option>
            <option value="card">Card</option>
            <option value="paypal">PayPal</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Member Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberPaymentStatus | "all" | "paid")}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid (Active)</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="no_payment">No Payment Yet</option>
            <option value="active">Active</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("payerBeneficiary.groupBy")}</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="member">{t("payerBeneficiary.groupMember")}</option>
            <option value="transactions">{t("payerBeneficiary.groupTransactions")}</option>
            <option value="payer">{t("payerBeneficiary.groupPayer")}</option>
            <option value="beneficiary">{t("payerBeneficiary.groupBeneficiary")}</option>
            <option value="household">{t("payerBeneficiary.groupHousehold")}</option>
          </select>
        </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !hasActiveFilter ? (
        <div className="card-elevated p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 font-display text-base font-medium text-foreground">Select filters to view data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a member, search a name, or apply a status/method filter to display results.
          </p>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-display text-base font-medium text-foreground">
              {groupBy === "member"
                ? "Members Summary"
                : groupBy === "payer"
                ? t("payerBeneficiary.groupPayer")
                : groupBy === "beneficiary"
                ? t("payerBeneficiary.groupBeneficiary")
                : groupBy === "household"
                ? t("payerBeneficiary.groupHousehold")
                : "All Transactions"}
            </h3>
          </div>
          {(groupBy === "payer" || groupBy === "beneficiary" || groupBy === "household") ? (
            (() => {
              const rows = groupBy === "payer" ? payerRows : groupBy === "beneficiary" ? beneficiaryRows : householdRows;
              if (rows.length === 0) {
                return <div className="py-8 text-center text-sm text-muted-foreground">{t("common.noResults")}</div>;
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="table-header px-5 py-3 text-left">{groupBy === "payer" ? t("payerBeneficiary.payer") : groupBy === "beneficiary" ? t("payerBeneficiary.beneficiary") : t("payerBeneficiary.household")}</th>
                        <th className="table-header px-5 py-3 text-right">Payments</th>
                        <th className="table-header px-5 py-3 text-right">Total</th>
                        <th className="table-header px-5 py-3 text-left">{groupBy === "payer" ? t("payerBeneficiary.beneficiaries") : t("payerBeneficiary.payer")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-foreground">
                            {r.name}
                            {r.partners.size >= 2 && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                {t("payerBeneficiary.familySupport")}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm text-foreground text-right tabular-nums">{r.count}</td>
                          <td className="px-5 py-3 text-sm font-medium text-foreground text-right tabular-nums">{formatUSD(r.total)}</td>
                          <td className="px-5 py-3 text-sm text-muted-foreground">
                            {r.partners.size === 0 ? "—" : `${r.partners.size} ${t("payerBeneficiary.members")}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          ) : groupBy === "member" ? (
            memberRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No members found in this category</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="table-header px-5 py-3 text-left">Name</th>
                      <th className="table-header px-5 py-3 text-left">Status</th>
                      <th className="table-header px-5 py-3 text-right">Payments</th>
                      <th className="table-header px-5 py-3 text-right">Total</th>
                      <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Last Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((g) => (
                      <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-foreground">{g.name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(g.status)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(g.status)}`} />
                            {STATUS_LABEL[g.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-foreground text-right tabular-nums">{g.count}</td>
                        <td className="px-5 py-3 text-sm font-medium text-foreground text-right tabular-nums">{g.count > 0 ? formatUSD(g.total) : "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{g.last ? new Date(g.last).toLocaleDateString("en-US") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No transactions match the filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="table-header px-5 py-3 text-left">Name</th>
                    <th className="table-header px-5 py-3 text-right">Amount</th>
                    <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Method</th>
                    <th className="table-header px-5 py-3 text-left hidden sm:table-cell">Date</th>
                    <th className="table-header px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{toTitleCase(p.members?.name) || "—"}</td>
                      <td className="px-5 py-3 text-sm text-foreground text-right tabular-nums">{formatUSD(p.amount)}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{new Date(p.payment_date).toLocaleDateString("en-US")}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(p)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit Payment"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditPaymentModal payment={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </div>
  );
}
