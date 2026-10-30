type DatedDive = { id: string; dive_date: string; created_at: string };

// Supabase returns dates and creation timestamps in a consistent ISO/UTC format.
// Match listDives' database tie-breakers without mutating React Query's cache.
function chronological(a: DatedDive, b: DatedDive) {
  return a.dive_date.localeCompare(b.dive_date)
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
