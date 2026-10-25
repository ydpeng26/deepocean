// Cloud acceptance guard/source contracts; no external network or credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gearRecoveryPreflight } from "./lib/gear-recovery-preflight.mjs";
const runner = new URL("./recovery-gear-concurrency.mjs", import.meta.url);
const source = fs.readFileSync(runner, "utf8");
const result = spawnSync(process.execPath, [runner.pathname], {
  encoding: "utf8",
  env: { PATH: process.env.PATH },
});
assert.equal(result.status, 1);
assert.match(result.stdout, /check=github_cloud_recovery_only/);
assert.match(result.stdout, /no_temporary_account_created/);
assert.match(result.stdout, /AUDIT: complete=false/);
assert(
  source.indexOf("await gearRecoveryPreflight(fetch, mainAbort.signal)") <
    source.indexOf("const created = await req"),
);
for (const contract of [
  "conditional_fixture_mutation_only",
  "updated_at",
  "fixture_login_only",
  "exact_temporary_owner_cleanup_guard",
  "temporary_session_revocation",
  "temporary_account_profile_gear_absence",
  "lost_reply_committed",
  "one_explicit_retry",
  "stale_delete_denied",
  "atomic_race_preserves_newer",
  "deleted_row_not_recreated",
  "cancel_reload_retains_draft",
])
  assert(source.includes(contract), contract);
assert(!/\.screenshot\(|\.tracing\.|storageState\(|writeFile\(|appendFile\(/.test(source));
const workflow = fs.readFileSync(
  new URL("../.github/workflows/recovery-gear-concurrency.yml", import.meta.url),
  "utf8",
);
assert(workflow.includes("if: github.ref == 'refs/heads/codex/pc-layout-keyboard-audit'"));
assert(workflow.includes("workflow_dispatch:"));
assert(!/push:|pull_request:/.test(workflow));
console.log(
  "PASS: cloud-only guard blocks local execution before key read/network; fixed-site preflight precedes fixtures; exact-owner/revision/cleanup and manual-only branch contracts present; no media/log artifacts",
);
// Actual native Response objects exercise the preflight body, not just its guard.
const origin = "https://supdiver-recovery-test.vercel.app";
const marker = "GearConflictError Load latest gear record esovqvampbrhuhamkfcs.supabase.co";
function transport({
  status = 200,
  manifest = ["/assets/synthetic.js"],
  script = marker,
  scriptStatus = 200,
} = {}) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      calls.push(url);
      assert.equal(options.redirect, "error");
      assert.equal(new URL(url).origin, origin);
      if (url === origin + "/offline-assets.json")
        return new Response(JSON.stringify(manifest), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      assert.equal(url, origin + "/assets/synthetic.js");
      return new Response(script, { status: scriptStatus });
    },
  };
}
const valid = transport();
assert.deepEqual(await gearRecoveryPreflight(valid.fetch), { scriptCount: 1 });
assert.equal(valid.calls.length, 2);
for (const [options, code] of [
  [{ status: 503 }, "public_manifest"],
  [{ manifest: {} }, "public_asset_array"],
  [
    { manifest: ["https://foreign.invalid/test.js", "//foreign.invalid/test.js"] },
    "public_scripts_missing",
  ],
  [{ scriptStatus: 404 }, "public_script"],
  [{ script: "old build" }, "fixed_site_missing_gear_concurrency_repair"],
  [{ script: "GearConflictError Load latest gear record" }, "fixed_site_recovery_backend"],
]) {
  const fixture = transport(options);
  await assert.rejects(gearRecoveryPreflight(fixture.fetch), { auditCode: code });
}
await assert.rejects(
  gearRecoveryPreflight(async () => {
    throw new TypeError("synthetic transport failure");
  }),
  TypeError,
);
assert(
  !fs
    .readFileSync(new URL("./lib/gear-recovery-preflight.mjs", import.meta.url), "utf8")
    .includes(".ok()"),
);
console.log(
  "PASS: actual native Response preflight accepts repaired recovery assets, rejects HTTP/manifest/foreign-path/old-build/wrong-backend failures; no network",
);
