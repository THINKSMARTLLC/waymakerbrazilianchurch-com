import { supabase } from "@/integrations/supabase/client";

export type ComputedFamilyRole = "sponsor" | "dependent" | "individual";

export interface FamilyMemberSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  family_role: string | null;
  computed_role: ComputedFamilyRole;
  subscription_active: boolean;
  stripe_subscription_id: string | null;
  weekly_due: number;
  /** Money this member contributed from their own pocket (payer = self or unknown). */
  personal_paid: number;
  /** Money paid BY others for this member (this member is beneficiary, payer is someone else). */
  paid_by_others: number;
  /** Money paid for OTHERS by this member (this member is payer for someone else). */
  paid_for_others: number;
  /** Ledger balance — negative = owes. */
  balance: number;
  weeks_overdue: number;
}

export interface FamilyHierarchy {
  familyId: string | null;
  familyName: string | null;
  sponsorId: string | null;
  members: FamilyMemberSummary[];
  /** Total paid by the entire family (sum of payments for all family members). */
  totalFamilyPaid: number;
}

/**
 * Resolve the family hierarchy for a member. Returns the full family
 * (sponsor + dependents) if the member belongs to one, otherwise a single-
 * member "individual" hierarchy.
 *
 * Sponsor inference precedence:
 *  1. `family_role = 'family_owner'`
 *  2. Member of the family with the highest `paid_for_others` amount
 *  3. If still tied/zero — first member by created_at
 */
export async function getFamilyHierarchy(memberId: string): Promise<FamilyHierarchy> {
  const { data: me } = await supabase
    .from("members")
    .select("id, name, email, phone, profile_photo_url, family_id, family_role, subscription_active, stripe_subscription_id, weekly_contribution_usd")
    .eq("id", memberId)
    .maybeSingle();

  if (!me) {
    return { familyId: null, familyName: null, sponsorId: null, members: [], totalFamilyPaid: 0 };
  }

  let familyName: string | null = null;
  let familyMembers: typeof me[] = [me as never];

  if (me.family_id) {
    const [{ data: fam }, { data: rows }] = await Promise.all([
      supabase.from("families").select("name").eq("id", me.family_id).maybeSingle(),
      supabase
        .from("members")
        .select("id, name, email, phone, profile_photo_url, family_id, family_role, subscription_active, stripe_subscription_id, weekly_contribution_usd, created_at")
        .eq("family_id", me.family_id)
        .order("created_at", { ascending: true }),
    ]);
    familyName = (fam?.name as string) ?? null;
    familyMembers = (rows ?? [me]) as never;
  }

  const ids = familyMembers.map((m) => m.id);

  // Aggregate payments
  const [paymentsRes, ledgerRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, member_id, payer_member_id, beneficiary_member_id, status")
      .or(
        ids
          .map((id) => `member_id.eq.${id},payer_member_id.eq.${id},beneficiary_member_id.eq.${id}`)
          .join(","),
      ),
    supabase
      .from("member_financial_ledger")
      .select("member_id, amount_due, amount_paid, payment_status, week_reference")
      .in("member_id", ids),
  ]);

  const personalPaid = new Map<string, number>();
  const paidByOthers = new Map<string, number>();
  const paidForOthers = new Map<string, number>();

  for (const p of paymentsRes.data ?? []) {
    if ((p.status ?? "paid") !== "paid") continue;
    const amount = Number(p.amount ?? 0);
    const target = (p.beneficiary_member_id ?? p.member_id) as string | null;
    const payer = (p.payer_member_id ?? p.member_id) as string | null;
    if (!target || !payer) continue;

    if (payer === target) {
      personalPaid.set(target, (personalPaid.get(target) ?? 0) + amount);
    } else {
      if (ids.includes(target)) {
        paidByOthers.set(target, (paidByOthers.get(target) ?? 0) + amount);
      }
      if (ids.includes(payer)) {
        paidForOthers.set(payer, (paidForOthers.get(payer) ?? 0) + amount);
      }
    }
  }

  const ledgerBalance = new Map<string, number>();
  const ledgerOverdue = new Map<string, number>();
  for (const l of ledgerRes.data ?? []) {
    const id = l.member_id as string;
    const bal = Number(l.amount_paid ?? 0) - Number(l.amount_due ?? 0);
    ledgerBalance.set(id, (ledgerBalance.get(id) ?? 0) + bal);
    if (bal < 0) {
      ledgerOverdue.set(id, (ledgerOverdue.get(id) ?? 0) + 1);
    }
  }

  // Sponsor detection
  let sponsorId: string | null = null;
  const explicitOwner = familyMembers.find((m) => m.family_role === "family_owner");
  if (explicitOwner) {
    sponsorId = explicitOwner.id;
  } else if (familyMembers.length > 1) {
    let best: { id: string; amt: number } | null = null;
    for (const m of familyMembers) {
      const amt = paidForOthers.get(m.id) ?? 0;
      if (amt > 0 && (!best || amt > best.amt)) best = { id: m.id, amt };
    }
    sponsorId = best?.id ?? familyMembers[0]?.id ?? null;
  }

  const members: FamilyMemberSummary[] = familyMembers.map((m) => {
    let role: ComputedFamilyRole;
    if (!me.family_id || familyMembers.length === 1) {
      role = "individual";
    } else if (m.id === sponsorId) {
      role = "sponsor";
    } else {
      role = "dependent";
    }
    return {
      id: m.id,
      name: m.name as string,
      email: (m.email as string) ?? null,
      phone: (m.phone as string) ?? null,
      profile_photo_url: (m.profile_photo_url as string) ?? null,
      family_role: (m.family_role as string) ?? null,
      computed_role: role,
      subscription_active: !!m.subscription_active,
      stripe_subscription_id: (m.stripe_subscription_id as string) ?? null,
      weekly_due: Number(m.weekly_contribution_usd ?? 0),
      personal_paid: personalPaid.get(m.id) ?? 0,
      paid_by_others: paidByOthers.get(m.id) ?? 0,
      paid_for_others: paidForOthers.get(m.id) ?? 0,
      balance: ledgerBalance.get(m.id) ?? 0,
      weeks_overdue: ledgerOverdue.get(m.id) ?? 0,
    };
  });

  // Reorder so sponsor is first
  members.sort((a, b) => {
    if (a.computed_role === "sponsor" && b.computed_role !== "sponsor") return -1;
    if (b.computed_role === "sponsor" && a.computed_role !== "sponsor") return 1;
    return a.name.localeCompare(b.name);
  });

  const totalFamilyPaid = members.reduce(
    (s, m) => s + m.personal_paid + m.paid_by_others,
    0,
  );

  return {
    familyId: me.family_id ?? null,
    familyName,
    sponsorId,
    members,
    totalFamilyPaid,
  };
}

export function roleBadgeClasses(role: ComputedFamilyRole): string {
  switch (role) {
    case "sponsor":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200";
    case "dependent":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200";
    case "individual":
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function roleLabel(role: ComputedFamilyRole): string {
  switch (role) {
    case "sponsor":
      return "Sponsor";
    case "dependent":
      return "Dependent";
    case "individual":
    default:
      return "Individual";
  }
}
