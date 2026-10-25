// Cloud acceptance guard/source contracts; no external network or credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  source.indexOf("fixed_site_missing_gear_concurrency_repair") <
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
