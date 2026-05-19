import type { Database } from "@/integrations/supabase/types";

export type ComputedFamilyRole = "sponsor" | "individual_sponsor" | "dependent" | "individual";

type MemberRow = Pick<
  Database["public"]["Tables"]["members"]["Row"],
  | "id"
  | "name"
  | "family_id"
  | "family_role"
  | "subscription_active"
  | "stripe_subscription_id"
  | "created_at"
>;

type PaymentRelationshipRow = Pick<
  Database["public"]["Tables"]["payment_relationships"]["Row"],
  "payer_member_id" | "beneficiary_member_id"
>;

export interface ComputedFamilyRoleState {
  computedRole: ComputedFamilyRole;
  sponsoredBy: string | null;
  paysFor: string[];
}

const roleOrder: Record<ComputedFamilyRole, number> = {
  sponsor: 0,
  individual_sponsor: 1,
  dependent: 2,
  individual: 3,
};

function hasOwnSubscription(member: MemberRow) {
  return !!member.subscription_active || !!member.stripe_subscription_id;
}

export function computeFamilyRoleMap(
  members: MemberRow[],
  relationships: PaymentRelationshipRow[],
): Map<string, ComputedFamilyRoleState> {
  const result = new Map<string, ComputedFamilyRoleState>();
  const membersById = new Map(members.map((member) => [member.id, member]));
  const familyGroups = new Map<string, MemberRow[]>();

  for (const member of members) {
    if (!member.family_id) {
      result.set(member.id, {
        computedRole: "individual",
        sponsoredBy: null,
        paysFor: [],
      });
      continue;
    }

    const group = familyGroups.get(member.family_id) ?? [];
    group.push(member);
    familyGroups.set(member.family_id, group);
  }

  const validRelationships = relationships.filter(({ payer_member_id, beneficiary_member_id }) => {
    if (!payer_member_id || !beneficiary_member_id || payer_member_id === beneficiary_member_id) {
      return false;
    }

    const payer = membersById.get(payer_member_id);
    const beneficiary = membersById.get(beneficiary_member_id);
    return !!payer && !!beneficiary && payer.family_id && payer.family_id === beneficiary.family_id;
  });

  const paysFor = new Map<string, Set<string>>();
  const sponsoredBy = new Map<string, string>();

  for (const relationship of validRelationships) {
    const payerId = relationship.payer_member_id as string;
    const beneficiaryId = relationship.beneficiary_member_id as string;
    const paidMembers = paysFor.get(payerId) ?? new Set<string>();
    paidMembers.add(beneficiaryId);
    paysFor.set(payerId, paidMembers);
    sponsoredBy.set(beneficiaryId, payerId);
  }

  for (const membersInFamily of familyGroups.values()) {
    if (membersInFamily.length === 1) {
      const onlyMember = membersInFamily[0];
      result.set(onlyMember.id, {
        computedRole: "individual",
        sponsoredBy: null,
        paysFor: [],
      });
      continue;
    }

    const sponsorCandidates = membersInFamily.filter(
      (member) => hasOwnSubscription(member) || member.family_role === "family_owner",
    );

    let primarySponsorId: string | null = sponsorCandidates.find(
      (member) => member.family_role === "family_owner",
    )?.id ?? null;

    if (!primarySponsorId && sponsorCandidates.length > 0) {
      primarySponsorId = [...sponsorCandidates]
        .sort((a, b) => {
          const payCountDiff = (paysFor.get(b.id)?.size ?? 0) - (paysFor.get(a.id)?.size ?? 0);
          if (payCountDiff !== 0) return payCountDiff;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        })[0]?.id ?? null;
    }

    for (const member of membersInFamily) {
      const explicitSponsoredBy = sponsoredBy.get(member.id) ?? null;
      const payees = Array.from(paysFor.get(member.id) ?? []);

      if (hasOwnSubscription(member) || member.family_role === "family_owner") {
        result.set(member.id, {
          computedRole: member.family_role === "family_owner" || payees.length > 0 ? "sponsor" : "individual_sponsor",
          sponsoredBy: null,
          paysFor: payees,
        });
        continue;
      }

      if (!member.family_id) {
        result.set(member.id, {
          computedRole: "individual",
          sponsoredBy: null,
          paysFor: [],
        });
        continue;
      }

      result.set(member.id, {
        computedRole: "dependent",
        sponsoredBy: explicitSponsoredBy ?? (primarySponsorId !== member.id ? primarySponsorId : null),
        paysFor: [],
      });
    }
  }

  for (const member of members) {
    if (!result.has(member.id)) {
      result.set(member.id, {
        computedRole: "individual",
        sponsoredBy: null,
        paysFor: [],
      });
    }
  }

  return result;
}

export function getComputedFamilyRoleLabel(role: ComputedFamilyRole) {
  switch (role) {
    case "sponsor":
      return "Sponsor";
    case "individual_sponsor":
      return "Individual Sponsor";
    case "dependent":
      return "Dependent";
    default:
      return "Individual";
  }
}

export function sortMembersByComputedFamilyRole<T extends { name: string; computedFamilyRole: ComputedFamilyRole }>(
  members: T[],
) {
  return [...members].sort((a, b) => {
    const orderDiff = roleOrder[a.computedFamilyRole] - roleOrder[b.computedFamilyRole];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}