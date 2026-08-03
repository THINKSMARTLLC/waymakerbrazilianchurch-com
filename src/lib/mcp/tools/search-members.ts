import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_members",
  title: "Search members",
  description:
    "Search church members by name, email or phone. Returns basic contact and status info the signed-in user is allowed to see.",
  inputSchema: {
    query: z.string().trim().describe("Partial name, email or phone to search for."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
    include_archived: z.boolean().optional().describe("Include archived members (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, include_archived }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const term = `%${query}%`;
    let q = supabase
      .from("members")
      .select(
        "id, name, email, phone, status, discipleship_stage, weekly_contribution_usd, last_payment_date, archived",
      )
      .or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
      .order("name")
      .limit(limit ?? 20);
    if (!include_archived) q = q.eq("archived", false);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { members: data ?? [] },
    };
  },
});
