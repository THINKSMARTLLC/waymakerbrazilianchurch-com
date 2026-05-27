// Admin-wide global search across members + user_profiles.
// Used by the search bar in /admin to find people by name, email,
// phone (partial), or exact id.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Input = z.object({
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(50).optional(),
});

export type AdminSearchResult = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  source: "member" | "user_profile";
  created_at: string;
};

export const adminGlobalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    // Authorization: any active staff.
    const { userId, supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) =>
      ["super_admin", "admin", "church_admin", "finance_manager"].includes(
        r.role as string,
      ),
    );
    if (!isStaff) throw new Error("Sem permissão");

    const q = data.query;
    const limit = data.limit ?? 20;
    const isUuid = UUID_RE.test(q);
    const like = `%${q}%`;
    const digits = q.replace(/\D/g, "");

    const results: AdminSearchResult[] = [];

    // members
    const memberOr = [`name.ilike.${like}`, `email.ilike.${like}`];
    if (digits.length >= 3) memberOr.push(`phone.ilike.%${digits}%`);
    if (isUuid) memberOr.push(`id.eq.${q}`);

    const { data: members, error: mErr } = await supabaseAdmin
      .from("members")
      .select("id, name, email, phone, status, created_at, archived")
      .eq("archived", false)
      .or(memberOr.join(","))
      .order("created_at", { ascending: false })
      .limit(limit);
    if (mErr) throw new Error(mErr.message);
    for (const m of members ?? []) {
      results.push({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        status: m.status,
        source: "member",
        created_at: m.created_at,
      });
    }

    // user_profiles
    const upOr = [`full_name.ilike.${like}`, `email.ilike.${like}`];
    if (digits.length >= 3) upOr.push(`phone.ilike.%${digits}%`);
    if (isUuid) upOr.push(`user_id.eq.${q}`);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, full_name, email, phone, status, created_at")
      .or(upOr.join(","))
      .order("created_at", { ascending: false })
      .limit(limit);
    if (pErr) throw new Error(pErr.message);
    for (const p of profiles ?? []) {
      // Skip if a member with the same email is already in the results.
      if (
        p.email &&
        results.some(
          (r) => r.email && r.email.toLowerCase() === p.email.toLowerCase(),
        )
      ) {
        continue;
      }
      results.push({
        id: p.user_id,
        name: p.full_name,
        email: p.email,
        phone: p.phone,
        status: p.status,
        source: "user_profile",
        created_at: p.created_at,
      });
    }

    return { results: results.slice(0, limit) };
  });
