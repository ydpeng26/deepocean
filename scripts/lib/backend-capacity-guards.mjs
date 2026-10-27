export const CAPACITY_API = "https://esovqvampbrhuhamkfcs.supabase.co";
export const CAPACITY_STAGES = [5, 10, 20, 30];
export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]);
}
export function scopedCapacityUrl(raw, owner, owners, dives) {
  const u = new URL(raw);
  if (u.origin !== CAPACITY_API || !owners.includes(owner)) throw Error("origin_or_owner");
  const table = u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  if (table === "forum_posts") {
    // Fixture-only restriction avoids exporting restored people's public content.
    if (u.searchParams.has("user_id")) throw Error("unexpected_forum_scope");
    u.searchParams.set("user_id", "in.(" + owners.join(",") + ")");
  } else if (
    [
      "profiles",
      "dives",
      "forum_bookmarks",
      "forum_likes",
      "forum_follows",
      "forum_blocks",
    ].includes(table)
  ) {
    const key =
      table === "profiles"
        ? "id"
        : table === "forum_follows"
          ? "follower_id"
          : table === "forum_blocks"
            ? "blocker_id"
            : "user_id";
    if (u.searchParams.get(key) !== "eq." + owner) throw Error("unscoped_read");
    const id = u.searchParams.get("id");
    if (table === "dives" && id && (!id.startsWith("eq.") || !dives.includes(id.slice(3))))
      throw Error("foreign_dive");
  } else if (
    u.pathname !== "/rest/v1/rpc/get_my_community_stats" &&
    !u.pathname.startsWith("/storage/v1/")
  ) {
    throw Error("unapproved_endpoint");
  }
  return u.href;
}
export function capacityGrade(operations, cycles, users) {
  const summary = {};
  for (const kind of ["forum", "dives", "profile", "stats", "save", "image"]) {
    const rows = operations.filter((r) => r.kind === kind);
    summary[kind] = {
      samples: rows.length,
      errors: rows.filter((r) => !r.ok).length,
      p50_ms: percentile(
        rows.map((r) => r.ms),
        0.5,
      ),
      p95_ms: percentile(
        rows.map((r) => r.ms),
        0.95,
      ),
      p99_ms: percentile(
        rows.map((r) => r.ms),
        0.99,
      ),
    };
  }
  const errors = operations.filter((r) => !r.ok).length;
  const sufficient =
    cycles.length === users &&
    cycles.every((n) => n >= 2) &&
    summary.save.samples >= users &&
    summary.forum.samples >= users * 2;
  const responsive = Object.entries(summary).every(
    ([kind, row]) => row.samples > 0 && row.p95_ms <= (kind === "forum" ? 2500 : 1500),
  );
  return {
    summary,
    error_rate: operations.length ? errors / operations.length : 1,
    sufficient,
    pass: sufficient && responsive && errors / Math.max(1, operations.length) < 0.01,
  };
}
