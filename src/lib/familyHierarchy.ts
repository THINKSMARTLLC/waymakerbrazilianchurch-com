import { supabase } from "@/integrations/supabase/client";

export type ComputedFamilyRole =
  | "sponsor"            // Active subscription + pays for at least one other member
  | "individual_sponsor" // Active subscription, pays only for self (still in a family)
  | "dependent"          // No own subscription; paid by another member
  | "individual";        // Not part of a family at all

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
  /** Members this sponsor pays for (excluding self). */
  pays_for: string[];
  /** Sponsor that pays for this member (if dependent). */
  sponsored_by: string | null;
  /** Sum of weekly_due across self + everyone this sponsor pays for. */
  weekly_responsibility: number;
  /** Money this member contributed from their own pocket (payer = self or payer null). */
  personal_paid: number;
  /** Money paid BY others for this member (beneficiary = this, payer = someone else). */
  paid_by_others: number;
  /** Money paid for OTHERS by this member (payer = this, beneficiary = someone else in family). */
  paid_for_others: number;
  /** Personal + Paid for Family (only meaningful for sponsors). */
  sponsor_total: number;
  /** Ledger balance — negative = owes. */
  balance: number;
  weeks_overdue: number;
}

export interface FamilyHierarchy {
  familyId: string | null;
  familyName: string | null;
  /** Backwards-compat: the first/primary sponsor of the family. */
  sponsorId: string | null;
  /** All members of the family (sponsors first, then dependents). */
  members: FamilyMemberSummary[];
  sponsors: FamilyMemberSummary[];
  individualSponsors: FamilyMemberSummary[];
  dependents: FamilyMemberSummary[];
  /** Sum of personal_paid + paid_by_others across the entire family. */
  totalFamilyPaid: number;
  /** Sum of weekly_due across every member of the family. */
  familyWeeklyDue: number;
}

interface RawMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  family_id: string | null;
  family_role: string | null;
  subscription_active: boolean | null;
  stripe_subscription_id: string | null;
  weekly_contribution_usd: number | null;
  created_at?: string;
}

/**
 * Resolve the full family hierarchy. Supports multiple sponsors per family.
 *
 * Computed role rules:
 *  - `subscription_active` OR `stripe_subscription_id` → sponsor / individual_sponsor
 *      (Stripe-active members are NEVER classified as dependent.)
 *  - A member is a `sponsor` if they pay for at least one OTHER member of the family
 *    (detected via `payment_relationships` where they are payer, or `family_role = 'family_owner'`).
 *  - Otherwise active-subscription members are `individual_sponsor`.
 *  - Members with no own subscription are `dependent`, attributed to a sponsor via
 *    `payment_relationships` or fallback to the family's primary sponsor.
 *  - Members with no family at all are `individual`.
 */
export async function getFamilyHierarchy(memberId: string): Promise<FamilyHierarchy> {
  const { data: me } = await supabase
    .from("members")
    .select("id, name, email, phone, profile_photo_url, family_id, family_role, subscription_active, stripe_subscription_id, weekly_contribution_usd")
    .eq("id", memberId)
    .maybeSingle();

  if (!me) {
    return emptyHierarchy();
  }

  let familyName: string | null = null;
  let familyMembers: RawMember[] = [me as RawMember];

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
    familyMembers = (rows ?? [me]) as RawMember[];
  }

  const ids = familyMembers.map((m) => m.id);

  // Fetch payments, ledger, and explicit payer relationships in parallel.
  const [paymentsRes, ledgerRes, relRes] = await Promise.all([
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
    supabase
      .from("payment_relationships")
      .select("payer_member_id, beneficiary_member_id")
      .in("beneficiary_member_id", ids),
  ]);

  const personalPaid = new Map<string, number>();
  const paidByOthers = new Map<string, number>();
  const paidForOthers = new Map<string, number>();
  // sponsor_id -> [dependent ids paid for]
  const paysFor = new Map<string, Set<string>>();
  // dependent_id -> sponsor_id
  const sponsoredBy = new Map<string, string>();

  // Seed sponsoredBy from explicit payment_relationships.
  for (const r of relRes.data ?? []) {
    const payer = r.payer_member_id as string;
    const benef = r.beneficiary_member_id as string;
    if (!payer || !benef || payer === benef) continue;
    if (ids.includes(payer)) {
      sponsoredBy.set(benef, payer);
      const set = paysFor.get(payer) ?? new Set();
      set.add(benef);
      paysFor.set(payer, set);
    }
  }

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
        // Infer sponsorship from observed payments if not already mapped.
        if (ids.includes(payer) && !sponsoredBy.has(target)) {
          sponsoredBy.set(target, payer);
          const set = paysFor.get(payer) ?? new Set();
          set.add(target);
          paysFor.set(payer, set);
        }
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

  const hasOwnSubscription = (m: RawMember) =>
    !!m.subscription_active || !!m.stripe_subscription_id;

  // First pass: classify each member.
  const partial: Array<FamilyMemberSummary & { _raw: RawMember }> = familyMembers.map((m) => {
    let role: ComputedFamilyRole;
    if (!me.family_id || familyMembers.length === 1) {
      role = "individual";
    } else if (hasOwnSubscription(m) || m.family_role === "family_owner") {
      // Sponsor candidate. Decide sponsor vs individual_sponsor in second pass
      // once we know who pays for whom.
      role = "individual_sponsor";
    } else {
      role = "dependent";
    }
    const weekly = Number(m.weekly_contribution_usd ?? 0) || 20;
    return {
      _raw: m,
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      profile_photo_url: m.profile_photo_url,
      family_role: m.family_role,
      computed_role: role,
      subscription_active: !!m.subscription_active,
      stripe_subscription_id: m.stripe_subscription_id,
      weekly_due: weekly,
      pays_for: [],
      sponsored_by: null,
      weekly_responsibility: weekly,
      personal_paid: personalPaid.get(m.id) ?? 0,
      paid_by_others: paidByOthers.get(m.id) ?? 0,
      paid_for_others: paidForOthers.get(m.id) ?? 0,
      sponsor_total: 0,
      balance: ledgerBalance.get(m.id) ?? 0,
      weeks_overdue: ledgerOverdue.get(m.id) ?? 0,
    };
  });

  // Determine the family's primary sponsor (used as fallback for dependents
  // with no explicit payer link).
  const sponsorCandidates = partial.filter(
    (m) => m.computed_role === "individual_sponsor" || m.computed_role === "sponsor",
  );
  let primarySponsorId: string | null = null;
  const explicitOwner = sponsorCandidates.find((m) => m.family_role === "family_owner");
  if (explicitOwner) {
    primarySponsorId = explicitOwner.id;
  } else if (sponsorCandidates.length > 0) {
    // Highest paid_for_others, else first by creation.
    const sorted = [...sponsorCandidates].sort(
      (a, b) => (b.paid_for_others ?? 0) - (a.paid_for_others ?? 0),
    );
    primarySponsorId = sorted[0]?.id ?? null;
  }

  // Assign dependents without an explicit sponsor to the primary sponsor.
  for (const m of partial) {
    if (m.computed_role !== "dependent") continue;
    let sid = sponsoredBy.get(m.id) ?? null;
    if (!sid && primarySponsorId && primarySponsorId !== m.id) {
      sid = primarySponsorId;
    }
    if (sid) {
      m.sponsored_by = sid;
      const set = paysFor.get(sid) ?? new Set();
      set.add(m.id);
      paysFor.set(sid, set);
    }
  }

  // Second pass: upgrade individual_sponsor → sponsor if they pay for anyone.
  for (const m of partial) {
    if (m.computed_role === "individual_sponsor") {
      const set = paysFor.get(m.id);
      if (set && set.size > 0) {
        m.computed_role = "sponsor";
      }
    }
  }

  // Compute pays_for, weekly_responsibility, sponsor_total.
  const memberById = new Map(partial.map((m) => [m.id, m]));
  for (const m of partial) {
    const set = paysFor.get(m.id);
    if (set && set.size > 0) {
      m.pays_for = Array.from(set);
      const depWeekly = m.pays_for.reduce(
        (s, did) => s + (memberById.get(did)?.weekly_due ?? 0),
        0,
      );
      m.weekly_responsibility = m.weekly_due + depWeekly;
    }
    if (m.computed_role === "sponsor" || m.computed_role === "individual_sponsor") {
      m.sponsor_total = m.personal_paid + m.paid_for_others;
    }
  }

  // Strip internal _raw + sort sponsors first.
  const members: FamilyMemberSummary[] = partial
    .map(({ _raw, ...rest }) => rest)
    .sort((a, b) => {
      const order = { sponsor: 0, individual_sponsor: 1, dependent: 2, individual: 3 };
      const oa = order[a.computed_role];
      const ob = order[b.computed_role];
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

  const sponsors = members.filter((m) => m.computed_role === "sponsor");
  const individualSponsors = members.filter((m) => m.computed_role === "individual_sponsor");
  const dependents = members.filter((m) => m.computed_role === "dependent");

  const totalFamilyPaid = members.reduce(
    (s, m) => s + m.personal_paid + m.paid_by_others,
    0,
  );
  const familyWeeklyDue = members.reduce((s, m) => s + m.weekly_due, 0);

  return {
    familyId: me.family_id ?? null,
    familyName,
    sponsorId: primarySponsorId,
    members,
    sponsors,
    individualSponsors,
    dependents,
    totalFamilyPaid,
    familyWeeklyDue,
  };
}

function emptyHierarchy(): FamilyHierarchy {
  return {
    familyId: null,
    familyName: null,
    sponsorId: null,
    members: [],
    sponsors: [],
    individualSponsors: [],
    dependents: [],
    totalFamilyPaid: 0,
    familyWeeklyDue: 0,
  };
}

export function roleBadgeClasses(role: ComputedFamilyRole): string {
  switch (role) {
    case "sponsor":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200";
    case "individual_sponsor":
      return "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200";
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
    case "individual_sponsor":
      return "Individual Sponsor";
    case "dependent":
      return "Dependent";
    case "individual":
    default:
      return "Individual";
  }
}
