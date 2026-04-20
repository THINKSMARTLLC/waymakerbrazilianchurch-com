// Duplicate detection across members + user_profiles by email and phone.
// Used by member creation/edit and signup flows.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Member = Database["public"]["Tables"]["members"]["Row"];

export interface DuplicateMatch {
  source: "member" | "user_profile";
  matched_by: ("email" | "phone")[];
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  // Only present for member matches — used for the merge UI.
  member?: Member;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const phoneDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * Find potential duplicates in members + user_profiles by email or phone.
 * Pass excludeMemberId to skip the current record while editing.
 */
export async function findDuplicates(opts: {
  email?: string | null;
  phone?: string | null;
  excludeMemberId?: string;
}): Promise<DuplicateMatch[]> {
  const email = norm(opts.email);
  const phoneD = phoneDigits(opts.phone);
  if (!email && !phoneD) return [];

  const matches: DuplicateMatch[] = [];

  // ---- members table ----
  const memberFilters: string[] = [];
  if (email) memberFilters.push(`email.ilike.${email}`);
  // Phone: stored as "+CCNNNNNNNNNN" — match by suffix on raw digits.
  // We fetch a slightly wider pool then filter by digits client-side.
  if (memberFilters.length > 0 || phoneD) {
    const orExpr = email ? `email.ilike.${email}` : `id.eq.${opts.excludeMemberId ?? "00000000-0000-0000-0000-000000000000"}`;
    const { data: emailMembers } = email
      ? await supabase.from("members").select("*").ilike("email", email)
      : { data: [] as Member[] };
    const { data: allMembersForPhone } = phoneD
      ? await supabase.from("members").select("*").not("phone", "is", null)
      : { data: [] as Member[] };
    void orExpr;

    const map = new Map<string, { row: Member; matched: Set<"email" | "phone"> }>();
    for (const m of emailMembers ?? []) {
      if (opts.excludeMemberId && m.id === opts.excludeMemberId) continue;
      const entry = map.get(m.id) ?? { row: m, matched: new Set() };
      entry.matched.add("email");
      map.set(m.id, entry);
    }
    if (phoneD) {
      for (const m of allMembersForPhone ?? []) {
        if (opts.excludeMemberId && m.id === opts.excludeMemberId) continue;
        const md = phoneDigits(m.phone);
        if (md && (md === phoneD || md.endsWith(phoneD) || phoneD.endsWith(md))) {
          const entry = map.get(m.id) ?? { row: m, matched: new Set() };
          entry.matched.add("phone");
          map.set(m.id, entry);
        }
      }
    }
    for (const { row, matched } of map.values()) {
      matches.push({
        source: "member",
        matched_by: Array.from(matched),
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        member: row,
      });
    }
  }

  // ---- user_profiles table ----
  if (email || phoneD) {
    const matchedProfiles = new Map<string, { row: { id: string; full_name: string; email: string; phone: string | null }; matched: Set<"email" | "phone"> }>();
    if (email) {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, phone")
        .ilike("email", email);
      for (const p of data ?? []) {
        const entry = matchedProfiles.get(p.id) ?? { row: p, matched: new Set() };
        entry.matched.add("email");
        matchedProfiles.set(p.id, entry);
      }
    }
    if (phoneD) {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, phone")
        .not("phone", "is", null);
      for (const p of data ?? []) {
        const md = phoneDigits(p.phone);
        if (md && (md === phoneD || md.endsWith(phoneD) || phoneD.endsWith(md))) {
          const entry = matchedProfiles.get(p.id) ?? { row: p, matched: new Set() };
          entry.matched.add("phone");
          matchedProfiles.set(p.id, entry);
        }
      }
    }
    for (const { row, matched } of matchedProfiles.values()) {
      // Skip user_profile matches that already correspond to a matched member
      // (avoid double-listing the same person).
      if (matches.some((m) => m.email && row.email && norm(m.email) === norm(row.email))) continue;
      matches.push({
        source: "user_profile",
        matched_by: Array.from(matched),
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
      });
    }
  }

  return matches;
}

export function isIncompleteMember(m: Member): boolean {
  return !m.email || !m.phone || !m.address;
}

/**
 * Merge two member records: reassign all payments from `loserId` to `winnerId`,
 * apply the chosen field values to the winner, and delete the loser.
 * RLS allows active staff to update/delete members and update payments.
 */
export async function mergeMembers(opts: {
  winnerId: string;
  loserId: string;
  winnerUpdates: Partial<Member>;
}): Promise<{ error: string | null }> {
  // 1. Reassign payments from loser → winner.
  const { error: payErr } = await supabase
    .from("payments")
    .update({ member_id: opts.winnerId })
    .eq("member_id", opts.loserId);
  if (payErr) return { error: `Failed to move payments: ${payErr.message}` };

  // 2. Reassign subscriptions from loser → winner (if any).
  await supabase
    .from("subscriptions")
    .update({ member_id: opts.winnerId })
    .eq("member_id", opts.loserId);

  // 3. Apply chosen field values to the winner.
  if (Object.keys(opts.winnerUpdates).length > 0) {
    const { error: updErr } = await supabase
      .from("members")
      .update(opts.winnerUpdates as never)
      .eq("id", opts.winnerId);
    if (updErr) return { error: `Failed to update kept record: ${updErr.message}` };
  }

  // 4. Delete the loser.
  const { error: delErr } = await supabase
    .from("members")
    .delete()
    .eq("id", opts.loserId);
  if (delErr) return { error: `Failed to delete duplicate: ${delErr.message}` };

  return { error: null };
}

/**
 * Generates a human-friendly temporary access code for admin-created members.
 * Format: 3 letters + 4 digits, e.g. "ABC1234".
 */
export function generateTempAccessCode(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // omit I, L, O for clarity
  const digits = "23456789"; // omit 0, 1
  let code = "";
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}
