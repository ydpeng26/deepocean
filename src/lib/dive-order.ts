type DatedDive = { id: string; dive_date: string; entry_time?: string | null; created_at: string };

// Supabase returns dates and creation timestamps in a consistent ISO/UTC format.
// Match listDives' database tie-breakers without mutating React Query's cache.
function chronological(a: DatedDive, b: DatedDive) {
  return a.dive_date.localeCompare(b.dive_date)
    || (a.entry_time?.slice(0, 5) || "24:00").localeCompare(b.entry_time?.slice(0, 5) || "24:00")
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id);
}

export function newestDivesFirst<T extends DatedDive>(dives: readonly T[]): T[] {
  return [...dives].sort((a, b) => chronological(b, a));
}

/** Compute numbers over the entire owner's history, before any UI filtering. */
export function diveNumbers(dives: readonly DatedDive[]): Map<string, number> {
  return new Map([...dives].sort(chronological).map((dive, index) => [dive.id, index + 1]));
}

// Local wall-clock time at the dive site; never apply a timezone conversion.
export function parseDiveEntryTime(value?: string | null): string | null {
  if (!value?.trim()) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value)) {
    throw new Error("入水时间请填写 00:00–23:59 / Enter a time between 00:00 and 23:59");
  }
  return `${value.slice(0, 5)}:00`;
}
