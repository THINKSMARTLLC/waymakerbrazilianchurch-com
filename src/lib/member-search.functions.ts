import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchInput = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional(),
});

const STAFF_ROLES = ["super_admin", "admin", "church_admin", "finance_manager"];

export const searchMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) => STAFF_ROLES.includes(r.role as string));
    if (!isStaff) {
      throw new Error("Sem permissão");
    }

    const q = data.query.trim();
    const limit = data.limit ?? 10;
    if (!q) return { results: [] as Array<{ id: string; name: string; email: string | null; phone: string | null }> };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const digits = q.replace(/\D/g, "");
    const like = `%${q}%`;

    let query = supabaseAdmin
      .from("members")
      .select("id, name, email, phone")
      .eq("archived", false)
      .order("name", { ascending: true })
      .limit(limit);

    const orFilters = [`name.ilike.${like}`, `email.ilike.${like}`];
    if (digits.length >= 3) orFilters.push(`phone.ilike.%${digits}%`);
    query = query.or(orFilters.join(","));

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { results: rows ?? [] };
  });
