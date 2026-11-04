import type { Dive } from "@/lib/dives";

export function diveStats(dives: readonly Dive[], currentYear = new Date().getFullYear()) {
  const sites = new Set<string>();
  const years = new Map<string, number>();
  let maxDepth: number | null = null;
  let longestMinutes: number | null = null;
  const normalize = (text: string | null) => (text ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  for (const dive of dives) {
    if (dive.max_depth != null && Number.isFinite(Number(dive.max_depth)) && Number(dive.max_depth) >= 0)
      maxDepth = Math.max(maxDepth ?? 0, Number(dive.max_depth));
    if (dive.duration_min != null && Number.isFinite(Number(dive.duration_min)) && Number(dive.duration_min) >= 0)
      longestMinutes = Math.max(longestMinutes ?? 0, Number(dive.duration_min));
    if (normalize(dive.site_name)) sites.add(JSON.stringify([normalize(dive.country), normalize(dive.region), normalize(dive.site_name)]));
    const year = /^\d{4}-\d{2}-\d{2}$/.test(dive.dive_date) ? dive.dive_date.slice(0, 4) : null;
    if (year) years.set(year, (years.get(year) ?? 0) + 1);
  }
  return { maxDepth, longestMinutes, siteCount: sites.size, currentYear,
    annualCount: years.get(String(currentYear)) ?? 0,
    years: [...years.entries()].sort(([a], [b]) => b.localeCompare(a)),
    total: dives.length, hundredUnlocked: dives.length >= 100, progress: Math.min(dives.length, 100) };
}
