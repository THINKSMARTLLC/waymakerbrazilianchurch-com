import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchMembersTool from "./tools/search-members";
import getMemberTool from "./tools/get-member";
import listPaymentsTool from "./tools/list-payments";
import givingSummaryTool from "./tools/giving-summary";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "way-maker-church",
  title: "Way Maker Church",
  version: "0.1.0",
  instructions:
    "Tools for Way Maker Church. Use `search_members` and `get_member` to look up people, `list_payments` for contribution records, and `giving_summary` for totals over a date range. All data access respects the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchMembersTool, getMemberTool, listPaymentsTool, givingSummaryTool],
});
