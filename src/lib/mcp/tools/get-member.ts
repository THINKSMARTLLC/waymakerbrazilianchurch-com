import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_member",
  title: "Get member details",
  description: "Fetch a single church member by id, including status, discipleship stage and giving info.",
  inputSchema: {
    member_id: z.string().uuid().describe("The member's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ member_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, name, email, phone, status, member_role, department, discipleship_stage, baptized, accepted_jesus, in_small_group, serving_ministry, weekly_contribution_usd, contribution_frequency, last_payment_date, subscription_active, archived, created_at",
      )
      .eq("id", member_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Member not found or not accessible." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { member: data },
    };
  },
});
