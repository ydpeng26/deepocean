import type { Dive } from "@/lib/dives";
import { diveCount, diveSites, recordedMinutes } from "@/lib/dive-record";

export function diveStats(dives: readonly Dive[], currentYear = new Date().getFullYear()) {
  const sites = new Set<string>();
  const years = new Map<string, number>();
  let maxDepth: number | null = null;
  let longestMinutes: number | null = null;
  let total = 0, totalMinutes = 0, missingTotalCount = 0;
  const normalize = (text: string | null) => (text ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  for (const dive of dives) {
    total += diveCount(dive);
    totalMinutes += recordedMinutes(dive);
    if (dive.record_mode === "summary" && dive.total_duration_min == null) missingTotalCount += diveCount(dive);
    if (dive.max_depth != null && Number.isFinite(Number(dive.max_depth)) && Number(dive.max_depth) >= 0)
      maxDepth = Math.max(maxDepth ?? 0, Number(dive.max_depth));
    if (dive.duration_min != null && Number.isFinite(Number(dive.duration_min)) && Number(dive.duration_min) >= 0)
      longestMinutes = Math.max(longestMinutes ?? 0, Number(dive.duration_min));
    for (const site of diveSites(dive)) if (normalize(site)) sites.add(JSON.stringify([normalize(dive.country), normalize(dive.region), normalize(site)]));
    const year = /^\d{4}-\d{2}-\d{2}$/.test(dive.dive_date) ? dive.dive_date.slice(0, 4) : null;
    if (year) years.set(year, (years.get(year) ?? 0) + diveCount(dive));
  }
  return { maxDepth, longestMinutes, siteCount: sites.size, currentYear,
    annualCount: years.get(String(currentYear)) ?? 0,
    years: [...years.entries()].sort(([a], [b]) => b.localeCompare(a)),
    total, totalMinutes, missingTotalCount, hundredUnlocked: total >= 100, progress: Math.min(total, 100) };
}
