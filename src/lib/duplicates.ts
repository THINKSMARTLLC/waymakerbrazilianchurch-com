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
  // Phone is stored as "+CCNNNNNNNNNN" — match by suffix on raw digits client-side.
  if (email || phoneD) {
    const { data: emailMembers } = email
      ? await supabase.from("members").select("*").ilike("email", email)
      : { data: [] as Member[] };
    const { data: allMembersForPhone } = phoneD
      ? await supabase.from("members").select("*").not("phone", "is", null)
      : { data: [] as Member[] };

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

// ---------------------------------------------------------------------------
// In-list duplicate scanner
// ---------------------------------------------------------------------------

const normName = (v: string | null | undefined) =>
  (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");

/** Levenshtein distance — small strings only, O(n*m). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Names are "very similar" if normalized equal, or Levenshtein ratio >= 0.85. */
export function namesAreSimilar(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Token-set: same set of words in any order
  const sa = new Set(na.split(" "));
  const sb = new Set(nb.split(" "));
  if (sa.size === sb.size && [...sa].every((t) => sb.has(t))) return true;
  const max = Math.max(na.length, nb.length);
  if (max < 4) return false;
  const dist = levenshtein(na, nb);
  return 1 - dist / max >= 0.85;
}

export interface DuplicateGroup {
  key: string;
  reason: ("email" | "phone" | "name")[];
  memberIds: string[];
}

/**
 * Scan a list of members and group rows that look like duplicates of each
 * other (matching email, phone, or very similar name). Pure client-side,
 * does not query the database.
 */
export function findDuplicateGroups(members: Member[]): DuplicateGroup[] {
  // Union-find for grouping.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const m of members) parent.set(m.id, m.id);

  const reasonByPair = new Map<string, Set<"email" | "phone" | "name">>();
  const addReason = (a: string, b: string, r: "email" | "phone" | "name") => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!reasonByPair.has(k)) reasonByPair.set(k, new Set());
    reasonByPair.get(k)!.add(r);
  };

  // Index by email and phone digits for O(n) pairing.
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  for (const m of members) {
    const e = norm(m.email);
    if (e) {
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e)!.push(m.id);
    }
    const p = phoneDigits(m.phone);
    // Use last 10 digits as bucket key (handles +1 / no country code).
    const key = p.slice(-10);
    if (key.length >= 7) {
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key)!.push(m.id);
    }
  }
  for (const ids of byEmail.values()) {
    for (let i = 1; i < ids.length; i++) {
      union(ids[0], ids[i]);
      addReason(ids[0], ids[i], "email");
    }
  }
  for (const ids of byPhone.values()) {
    for (let i = 1; i < ids.length; i++) {
      union(ids[0], ids[i]);
      addReason(ids[0], ids[i], "phone");
    }
  }

  // Name similarity — O(n^2) but n is bounded by member count.
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (namesAreSimilar(members[i].name, members[j].name)) {
        union(members[i].id, members[j].id);
        addReason(members[i].id, members[j].id, "name");
      }
    }
  }

  // Collect groups of size >= 2.
  const groups = new Map<string, { ids: string[]; reasons: Set<"email" | "phone" | "name"> }>();
  for (const m of members) {
    const root = find(m.id);
    if (!groups.has(root)) groups.set(root, { ids: [], reasons: new Set() });
    groups.get(root)!.ids.push(m.id);
  }
  for (const [pairKey, reasons] of reasonByPair.entries()) {
    const [a] = pairKey.split("|");
    const root = find(a);
    const g = groups.get(root);
    if (g) reasons.forEach((r) => g.reasons.add(r));
  }
  const result: DuplicateGroup[] = [];
  for (const [key, g] of groups.entries()) {
    if (g.ids.length >= 2) {
      result.push({ key, reason: Array.from(g.reasons), memberIds: g.ids });
    }
  }
  return result;
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
