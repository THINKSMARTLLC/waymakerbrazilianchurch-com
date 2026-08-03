import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "giving_summary",
  title: "Giving summary",
  description:
    "Summarize total contributions for a date range, broken down by payment method and contribution type.",
  inputSchema: {
    from_date: z.string().describe("Start date, ISO YYYY-MM-DD (inclusive)."),
    to_date: z.string().describe("End date, ISO YYYY-MM-DD (inclusive)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("payments")
      .select("amount, payment_method, contribution_type, status")
      .gte("payment_date", from_date)
      .lte("payment_date", to_date);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).filter((p) => p.status !== "failed");
    const byMethod: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const amount = Number(row.amount ?? 0);
      total += amount;
      byMethod[row.payment_method] = (byMethod[row.payment_method] ?? 0) + amount;
      byType[row.contribution_type] = (byType[row.contribution_type] ?? 0) + amount;
    }
    const summary = { from_date, to_date, total, count: rows.length, byMethod, byType };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
