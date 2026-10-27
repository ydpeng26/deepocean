import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CAPACITY_API,
  CAPACITY_STAGES,
  scopedCapacityUrl,
  percentile,
  capacityGrade,
} from "./lib/backend-capacity-guards.mjs";
const owners = ["owner-a", "owner-b"],
  dives = ["dive-a"];
assert.deepEqual(CAPACITY_STAGES, [5, 10, 20, 30]);
for (const raw of [
  "https://www.supdiver.com/",
  "https://supdiver-recovery-test.vercel.app/",
  "https://zmhtlhpeulhhcvlnjdrb.supabase.co/rest/v1/dives",
  CAPACITY_API + "/auth/v1/token",
])
  assert.throws(() => scopedCapacityUrl(raw, owners[0], owners, dives));
for (const tail of [
  "/rest/v1/dives?select=*",
  "/rest/v1/profiles?id=eq.owner-b",
  "/rest/v1/dives?user_id=eq.owner-a&id=eq.foreign",
  "/rest/v1/secret?user_id=eq.owner-a",
])
  assert.throws(() => scopedCapacityUrl(CAPACITY_API + tail, owners[0], owners, dives));
assert.equal(
  new URL(
    scopedCapacityUrl(CAPACITY_API + "/rest/v1/forum_posts?select=id", owners[0], owners, dives),
  ).searchParams.get("user_id"),
  "in.(owner-a,owner-b)",
);
assert.equal(percentile([20, 1, 5], 0.95), 20);
assert.equal(percentile([], 0.95), null);
const operations = ["forum", "dives", "profile", "stats", "save", "image"].flatMap((kind) =>
  Array.from({ length: 10 }, () => ({ kind, ok: true, ms: 100 })),
);
assert.equal(capacityGrade(operations, [2, 2, 2, 2, 2], 5).pass, true);
assert.equal(capacityGrade(operations, [2, 2, 2, 2, 0], 5).pass, false);
assert.equal(
  capacityGrade([...operations, { kind: "forum", ok: false, ms: 9000 }], [2, 2, 2, 2, 2], 5).pass,
  false,
);
const runner = fs.readFileSync(new URL("./recovery-backend-capacity.mjs", import.meta.url), "utf8");
assert.ok(runner.includes('redirect: "error"'));
assert.ok(
  runner.includes('process.env.GITHUB_REF !== "refs/heads/codex/pc-layout-keyboard-audit"'),
);
assert.ok(runner.includes("finally") && runner.includes("cleanup_verified"));
assert.ok(!runner.includes("vercel.app") && !runner.includes("www.supdiver.com"));
console.log(
  "PASS: backend capacity source/owner/endpoint isolation, fixed stages, percentile, sample/latency/error gates and no Vercel load target",
);
