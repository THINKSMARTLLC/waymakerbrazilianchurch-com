import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_payments",
  title: "List contributions",
  description:
    "List recorded contributions/payments, optionally filtered by member and date range. Returns amount, date, method and status.",
  inputSchema: {
    member_id: z.string().uuid().optional().describe("Only payments for this member."),
    from_date: z.string().optional().describe("Start date, ISO YYYY-MM-DD (inclusive)."),
    to_date: z.string().optional().describe("End date, ISO YYYY-MM-DD (inclusive)."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ member_id, from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("payments")
      .select("id, member_id, amount, payment_date, payment_method, contribution_type, status, reference_month, notes")
      .order("payment_date", { ascending: false })
      .limit(limit ?? 25);

    if (member_id) q = q.eq("member_id", member_id);
    if (from_date) q = q.gte("payment_date", from_date);
    if (to_date) q = q.lte("payment_date", to_date);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const total = (data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ total, count: data?.length ?? 0, payments: data ?? [] }, null, 2) }],
      structuredContent: { total, payments: data ?? [] },
    };
  },
});
