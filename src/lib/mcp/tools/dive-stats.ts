import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

type DiveRow = {
  max_depth: number | null;
  duration_min: number | null;
  country: string | null;
  dive_date: string | null;
};

export default defineTool({
  name: "get_dive_stats",
  title: "Get dive stats",
  description: "Summarize the signed-in diver's log: total dives, max depth, total minutes, countries.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("dives")
      .select("max_depth, duration_min, country, dive_date");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as DiveRow[];
    const stats = {
      total_dives: rows.length,
      max_depth_m: rows.reduce((m, r) => Math.max(m, r.max_depth ?? 0), 0),
      total_minutes: rows.reduce((s, r) => s + (r.duration_min ?? 0), 0),
      countries: [...new Set(rows.map((r) => r.country).filter(Boolean))],
      last_dive_date: rows.map((r) => r.dive_date).filter(Boolean).sort().pop() ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(stats) }],
      structuredContent: stats,
    };
  },
});
