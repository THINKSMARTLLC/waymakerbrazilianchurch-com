import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const searchInput = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional(),
});

export const searchMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchInput)
  .handler(async ({ data }) => {
    const q = data.query.trim();
    const limit = data.limit ?? 10;
    if (!q) return { results: [] as Array<{ id: string; name: string; email: string | null; phone: string | null }> };

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
