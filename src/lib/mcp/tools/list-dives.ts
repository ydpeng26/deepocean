import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_dives",
  title: "List dives",
  description: "List the signed-in diver's dive log entries, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of dives to return."),
    country: z.string().trim().min(1).optional().describe("Filter by country name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, country }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("dives")
      .select("*")
      .order("dive_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (country) query = query.eq("country", country);
    const { data, error } = await query;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: JSON.stringify(data ?? []) }],
          structuredContent: { dives: data ?? [] },
        };
  },
});
