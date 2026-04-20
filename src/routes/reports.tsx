import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { DollarSign, CreditCard, Users, AlertTriangle, Receipt, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/format";
import { computeMemberStatus, STATUS_LABEL, statusBadgeClasses, statusDotClasses, type MemberPaymentStatus } from "@/lib/memberStatus";
import { PAYMENT_METHOD_LABEL } from "@/components/RecordPaymentModal";
import { EditPaymentModal } from "@/components/EditPaymentModal";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios — WAY MAKER FLOW" },
      { name: "description", content: "Relatórios financeiros e doações" },
    ],
  }),
  component: ReportsPage,
});

type FilterRange = "this_month" | "last_month" | "all" | "custom";
type Payment = Database["public"]["Tables"]["payments"]["Row"];

interface PaymentWithMember extends Payment {
  members: { id: string; name: string; email: string | null } | null;
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
  const [filter, setFilter] = useState<FilterRange>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MemberPaymentStatus | "all">("all");
  const [groupBy, setGroupBy] = useState<"transactions" | "member">("transactions");

  // Latest payment dates per member (for status filter — uses ALL payments, not just filtered range)
  const [lastByMember, setLastByMember] = useState<Map<string, string>>(new Map());
  const [monthsByMember, setMonthsByMember] = useState<Map<string, Set<string>>>(new Map());
  const [freqByMember, setFreqByMember] = useState<Map<string, "weekly" | "monthly" | "one_time" | "flexible">>(new Map());

  // Edit modal
  const [editing, setEditing] = useState<Payment | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { start, end } = getDateRange(filter, customStart, customEnd);

    let query = supabase
      .from("payments")
      .select("*, members(id, name, email)")
      .order("payment_date", { ascending: false });

    if (start) query = query.gte("payment_date", start);
    if (end) query = query.lte("payment_date", end);

    const { data } = await query;
    setPayments((data as PaymentWithMember[]) || []);

    // Fetch latest payment per member globally for accurate status
    const { data: lastData } = await supabase
      .from("payments")
      .select("member_id, payment_date, payment_frequency, reference_month")
      .order("payment_date", { ascending: false });
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

    // Fetch frequency per member for status calc
    const { data: memberFreq } = await supabase
      .from("members")
      .select("id, contribution_frequency");
    const freqMap = new Map<string, "weekly" | "monthly" | "one_time" | "flexible">();
    for (const m of (memberFreq as { id: string; contribution_frequency: "weekly" | "monthly" | "one_time" | "flexible" }[]) || []) {
      freqMap.set(m.id, m.contribution_frequency ?? "weekly");
    }
    setFreqByMember(freqMap);

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

  // Apply filters
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (nameFilter && !(p.members?.name.toLowerCase().includes(nameFilter.toLowerCase()))) return false;
      if (methodFilter !== "all") {
        const normalized = p.payment_method === "stripe" ? "card" : p.payment_method;
        if (normalized !== methodFilter) return false;
      }
      if (statusFilter !== "all" && p.members) {
        const status = computeMemberStatus(lastByMember.get(p.members.id) ?? null, freqByMember.get(p.members.id) ?? "weekly");
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [payments, nameFilter, methodFilter, statusFilter, lastByMember, freqByMember]);

  // Metrics — distinct members from filtered payments
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

  // Late count from current member set (status filter aware)
  const lateMembers = useMemo(() => {
    const ids = new Set<string>();
    for (const p of filteredPayments) {
      if (!p.members) continue;
      const status = computeMemberStatus(lastByMember.get(p.members.id) ?? null, freqByMember.get(p.members.id) ?? "weekly");
      if (status === "late") ids.add(p.members.id);
    }
    return ids.size;
  }, [filteredPayments, lastByMember, freqByMember]);

  // Grouped view
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; email: string | null; count: number; total: number; last: string }>();
    for (const p of filteredPayments) {
      if (!p.members) continue;
      const key = p.members.id;
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        cur.total += Number(p.amount);
        if (p.payment_date > cur.last) cur.last = p.payment_date;
      } else {
        map.set(key, {
          name: p.members.name,
          email: p.members.email,
          count: 1,
          total: Number(p.amount),
          last: p.payment_date,
        });
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [filteredPayments]);

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
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Paid Members</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{distinctPaidMembers}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="h-4 w-4" />Total Payments</div>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{totalPayments}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />Late Members</div>
          <p className="mt-1 font-display text-2xl font-semibold text-destructive">{lateMembers}</p>
        </div>
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
      <div className="card-elevated p-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by name..."
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
            onChange={(e) => setStatusFilter(e.target.value as MemberPaymentStatus | "all")}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="no_payment">No Payment Yet</option>
            <option value="active">Active</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "transactions" | "member")}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="transactions">Individual Transactions</option>
            <option value="member">By Member</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-display text-base font-medium text-foreground">
              {groupBy === "member" ? "Members Summary" : "All Transactions"}
            </h3>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No results match the filters.</div>
          ) : groupBy === "member" ? (
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
                  {grouped.map((g) => {
                    const status = computeMemberStatus(lastByMember.get(g.id) ?? null, freqByMember.get(g.id) ?? "weekly");
                    return (
                      <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-foreground">{g.name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(status)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(status)}`} />
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-foreground text-right tabular-nums">{g.count}</td>
                        <td className="px-5 py-3 text-sm font-medium text-foreground text-right tabular-nums">{formatUSD(g.total)}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{new Date(g.last).toLocaleDateString("en-US")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{p.members?.name || "—"}</td>
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
