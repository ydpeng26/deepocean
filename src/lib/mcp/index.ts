import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDivesTool from "./tools/list-dives";
import getDiveTool from "./tools/get-dive";
import createDiveTool from "./tools/create-dive";
import diveStatsTool from "./tools/dive-stats";
import getProfileTool from "./tools/get-profile";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "speak-chinese-now",
  title: "Speak Chinese Now",
  version: "0.1.0",
  instructions:
    "Tools for the 深蓝 dive log app. Read and create dive log entries for the signed-in diver, and read their profile and diving statistics.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDivesTool, getDiveTool, createDiveTool, diveStatsTool, getProfileTool],
});
