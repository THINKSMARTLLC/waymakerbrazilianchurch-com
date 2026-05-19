import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Crown, Heart, Users, ChevronDown, ChevronRight, Trash2, UserPlus, CreditCard, Loader2, X } from "lucide-react";
import { formatUSD, toTitleCase } from "@/lib/format";
import { toast } from "sonner";

type Member = Database["public"]["Tables"]["members"]["Row"];
type FamilyRole = Database["public"]["Enums"]["family_role"];

interface Props {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface Node {
  id: string;
  name: string;
  family_role: FamilyRole | null;
  subscription_active: boolean;
  status_payment: string | null;
  stripe_subscription_id: string | null;
  last_payment_date: string | null;
  monthly_paid: number;
}

export function FinancialRelationshipsDrawer({ memberId, open, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [familyName, setFamilyName] = useState<string>("");
  const [siblings, setSiblings] = useState<Node[]>([]);
  const [payerNode, setPayerNode] = useState<Node | null>(null);
  const [relationshipLabel, setRelationshipLabel] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);

  const reload = async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const { data: m } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();
      setMember(m as Member | null);

      let sibs: Node[] = [];
      let famName = "";
      if (m?.family_id) {
        const [{ data: fam }, { data: rows }] = await Promise.all([
          supabase.from("families").select("name").eq("id", m.family_id).maybeSingle(),
          supabase
            .from("members")
            .select("id, name, family_role, subscription_active, status_payment, stripe_subscription_id, last_payment_date")
            .eq("family_id", m.family_id),
        ]);
        famName = (fam?.name as string) ?? "";
        const ids = (rows || []).map((r) => r.id as string);
        let paidMap = new Map<string, number>();
        if (ids.length) {
          const start = new Date();
          start.setDate(1);
          const startStr = start.toISOString().slice(0, 10);
          const { data: pays } = await supabase
            .from("payments")
            .select("member_id, amount")
            .in("member_id", ids)
            .gte("payment_date", startStr);
          for (const p of pays || []) {
            const k = p.member_id as string;
            paidMap.set(k, (paidMap.get(k) ?? 0) + Number(p.amount ?? 0));
          }
        }
        sibs = (rows || []).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          family_role: r.family_role as FamilyRole,
          subscription_active: !!r.subscription_active,
          status_payment: (r.status_payment as string) ?? null,
          stripe_subscription_id: (r.stripe_subscription_id as string) ?? null,
          last_payment_date: (r.last_payment_date as string) ?? null,
          monthly_paid: paidMap.get(r.id as string) ?? 0,
        }));
      }
      setFamilyName(famName);
      setSiblings(sibs);

      // Payer relationship (this member as beneficiary)
      const { data: rel } = await supabase
        .from("payment_relationships")
        .select("payer_member_id, relationship_label")
        .eq("beneficiary_member_id", memberId)
        .maybeSingle();
      setRelationshipLabel((rel?.relationship_label as string) ?? "");
      if (rel?.payer_member_id && rel.payer_member_id !== memberId) {
        const { data: payer } = await supabase
          .from("members")
          .select("id, name, family_role, subscription_active, status_payment, stripe_subscription_id, last_payment_date")
          .eq("id", rel.payer_member_id)
          .maybeSingle();
        if (payer) {
          setPayerNode({
            id: payer.id as string,
            name: payer.name as string,
            family_role: payer.family_role as FamilyRole,
            subscription_active: !!payer.subscription_active,
            status_payment: (payer.status_payment as string) ?? null,
            stripe_subscription_id: (payer.stripe_subscription_id as string) ?? null,
            last_payment_date: (payer.last_payment_date as string) ?? null,
            monthly_paid: 0,
          });
        } else setPayerNode(null);
      } else setPayerNode(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && memberId) reload();
  }, [open, memberId]);

  const owner = useMemo(() => siblings.find((s) => s.family_role === "family_owner") ?? null, [siblings]);
  const dependents = useMemo(
    () => siblings.filter((s) => s.id !== owner?.id),
    [siblings, owner],
  );
  const totalExpected = siblings.length * Number(member?.weekly_contribution_usd ?? 0) * 4;
  const totalPaid = siblings.reduce((s, n) => s + n.monthly_paid, 0);

  const setRole = async (id: string, role: FamilyRole) => {
    setSaving(true);
    const { error } = await supabase.from("members").update({ family_role: role }).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      await reload();
      onChanged?.();
    }
  };

  const removeFromFamily = async (id: string) => {
    if (!confirm(t("financialDrawer.confirmRemove", { defaultValue: "Remove this member from the family?" }))) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ family_id: null, family_role: "individual" })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      await reload();
      onChanged?.();
    }
  };

  const setAsPayer = async (id: string) => {
    if (!member?.family_id) return;
    setSaving(true);
    // Demote any existing owner to family_member
    if (owner && owner.id !== id) {
      await supabase.from("members").update({ family_role: "family_member" }).eq("id", owner.id);
    }
    const { error } = await supabase.from("members").update({ family_role: "family_owner" }).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Payer updated");
      await reload();
      onChanged?.();
    }
  };

  const runSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("members")
      .select("*")
      .ilike("name", `%${q.trim()}%`)
      .is("family_id", null)
      .limit(8);
    setSearchResults((data as Member[]) || []);
  };

  const addDependent = async (m: Member) => {
    if (!member?.family_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ family_id: member.family_id, family_role: "family_member" })
      .eq("id", m.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Dependent added");
      setShowAdd(false);
      setSearchQ("");
      setSearchResults([]);
      await reload();
      onChanged?.();
    }
  };

  const renderNode = (n: Node, isOwner: boolean) => {
    const Icon = isOwner ? Crown : n.family_role === "sponsored" ? Heart : Users;
    const tone = isOwner
      ? "text-amber-600"
      : n.family_role === "sponsored"
      ? "text-pink-600"
      : "text-blue-600";
    return (
      <div key={n.id} className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{toTitleCase(n.name)}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  n.subscription_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {n.stripe_subscription_id ? (n.subscription_active ? "Stripe active" : "Stripe inactive") : "No Stripe"}
                </span>
                {n.status_payment && (
                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {n.status_payment}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t("financialDrawer.paid", { defaultValue: "Paid" })}: {formatUSD(n.monthly_paid)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isOwner && (
              <button
                onClick={() => setAsPayer(n.id)}
                disabled={saving}
                className="text-[11px] px-2 py-1 rounded-md border border-input hover:bg-muted disabled:opacity-50"
                title={t("financialDrawer.makePayer", { defaultValue: "Make payer" })}
              >
                <Crown className="h-3 w-3 inline" />
              </button>
            )}
            <select
              value={n.family_role ?? "individual"}
              onChange={(e) => setRole(n.id, e.target.value as FamilyRole)}
              disabled={saving}
              className="text-[11px] border border-input rounded-md bg-background px-1 py-1"
              title="Role in family"
            >
              <option value="family_owner">👑 Sponsor</option>
              <option value="family_member">👑 Individual Sponsor</option>
              <option value="sponsored">👤 Dependent</option>
              <option value="individual">Individual</option>
            </select>
            <button
              onClick={() => removeFromFamily(n.id)}
              disabled={saving}
              className="p-1 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
              title={t("financialDrawer.remove", { defaultValue: "Remove" })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("payerBeneficiary.financialRelationships")}
          </SheetTitle>
          <SheetDescription>
            {member ? toTitleCase(member.name) : ""}
            {familyName ? ` · ${familyName}` : ""}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !member ? (
          <p className="text-sm text-muted-foreground mt-6">—</p>
        ) : (
          <div className="mt-6 space-y-5">
            {/* External payer (payment_relationships) */}
            {payerNode && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> {t("portal.paidBy")}
                </p>
                <p className="text-sm font-medium text-foreground">{toTitleCase(payerNode.name)}</p>
                {relationshipLabel && (
                  <p className="text-xs text-muted-foreground">{relationshipLabel}</p>
                )}
              </div>
            )}

            {/* Family tree */}
            {member.family_id ? (
              <div>
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {familyName || t("payerBeneficiary.household")} · {siblings.length} {t("payerBeneficiary.members")}
                  </span>
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {!collapsed && (
                  <div className="space-y-2">
                    {owner && renderNode(owner, true)}
                    {dependents.length > 0 && (
                      <div className="ml-4 border-l-2 border-border pl-3 space-y-2">
                        {dependents.map((d) => renderNode(d, false))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Total paid (mo)</p>
                    <p className="text-sm font-semibold tabular-nums">{formatUSD(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Members</p>
                    <p className="text-sm font-semibold">{siblings.length}</p>
                  </div>
                </div>

                {!showAdd ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdd(true)}
                    className="mt-3 w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t("financialDrawer.addDependent", { defaultValue: "Add dependent" })}
                  </Button>
                ) : (
                  <div className="mt-3 rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t("financialDrawer.searchMember", { defaultValue: "Search member (no family)" })}</Label>
                      <button onClick={() => { setShowAdd(false); setSearchQ(""); setSearchResults([]); }} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input value={searchQ} onChange={(e) => runSearch(e.target.value)} placeholder="Type a name…" />
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {searchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => addDependent(r)}
                          disabled={saving}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm disabled:opacity-50"
                        >
                          {toTitleCase(r.name)} <span className="text-xs text-muted-foreground">{r.email ?? ""}</span>
                        </button>
                      ))}
                      {searchQ.length >= 2 && searchResults.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">No results</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("financialDrawer.noFamily", { defaultValue: "This member is not part of a family yet." })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("financialDrawer.useEditModal", { defaultValue: "Use Edit Member to assign or create a family." })}
                </p>
              </div>
            )}

            {saving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
