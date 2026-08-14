import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_dive",
  title: "Create dive",
  description: "Add a new dive log entry for the signed-in diver.",
  inputSchema: {
    country: z.string().trim().min(1).describe("Country of the dive."),
    site_name: z.string().trim().min(1).describe("Dive site name."),
    dive_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Dive date, YYYY-MM-DD."),
    dive_type: z
      .enum(["recreational", "freediving", "technical"])
      .default("recreational")
      .describe("Dive type."),
    weather: z.string().trim().optional().describe("Weather on the day."),
    surface_temp: z.number().optional().describe("Surface temperature in Celsius."),
    water_temp: z.number().optional().describe("Water temperature in Celsius."),
    max_depth: z.number().optional().describe("Maximum depth in meters."),
    duration_min: z.number().int().optional().describe("Dive duration in minutes."),
    buddy_role: z.enum(["instructor", "buddy"]).optional().describe("Role of the dive partner."),
    buddy_name: z.string().trim().optional().describe("Dive partner name."),
    notes: z.string().trim().optional().describe("Personal notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("dives")
      .insert({ ...input, user_id: ctx.getUserId() })
      .select()
      .single();
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { dive: data } };
  },
});
