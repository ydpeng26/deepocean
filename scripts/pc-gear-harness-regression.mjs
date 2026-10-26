// Cloud acceptance guard/source contracts; no external network or credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gearRecoveryPreflight } from "./lib/gear-recovery-preflight.mjs";
import { gearBrowserDiagnostic } from "./lib/gear-browser-diagnostic.mjs";
import { gearFixtureToken } from "./lib/gear-fixture-session.mjs";
import vm from "node:vm";
const runner = new URL("./recovery-gear-concurrency.mjs", import.meta.url);
const source = fs.readFileSync(runner, "utf8");
const owner = "synthetic-owner",
  token = "synthetic-access-token";
const fixtureStorage = (value) => ({
  getItem(key) {
    assert.equal(key, "sb-esovqvampbrhuhamkfcs-auth-token");
    return value;
  },
});
const value = JSON.stringify({ user: { id: owner }, access_token: token });
assert.equal(gearFixtureToken(owner, fixtureStorage(value)), token);
assert.equal(gearFixtureToken("other-owner", fixtureStorage(value)), null);
for (const value of [
  "invalid",
  "null",
  "{}",
  JSON.stringify({ user: { id: owner }, access_token: "" }),
])
  assert.equal(gearFixtureToken(owner, fixtureStorage(value)), null);
assert.equal(
  gearFixtureToken(owner, {
    getItem() {
      throw Error("synthetic denied storage");
    },
  }),
  null,
);
assert.equal(
  vm.runInNewContext("(" + gearFixtureToken.toString() + ")(owner)", {
    owner,
    sessionStorage: fixtureStorage(value),
  }),
  token,
);
const loginSource = source.slice(
  source.indexOf("async function login("),
  source.indexOf("const conflict ="),
);
let submitted = false,
  tokenReads = 0;
const loginSessions = new Set();
const fakePage = {
  goto: async () => {},
  waitForResponse: () =>
    Promise.resolve({
      ok: () => true,
      json() {
        throw Error("Response body deliberately unavailable");
      },
    }),
  async waitForURL() {
    assert(submitted);
  },
  async waitForFunction() {},
  async evaluate(fn, id) {
    tokenReads++;
    return fn(id, fixtureStorage(value));
  },
};
const fakeField = () => ({
  fill: async () => {},
  waitFor: async () => {},
  inputValue: async () => "synthetic-marker",
});
await vm.runInNewContext(loginSource + ';login(page,"zh-CN","A")', {
  copies: { "zh-CN": { email: "Email", password: "Password", brand: "Brand", login: "Sign in" } },
  page: fakePage,
  advance() {},
  site: "https://supdiver-recovery-test.vercel.app",
  api: "https://esovqvampbrhuhamkfcs.supabase.co",
  email: "synthetic@example.invalid",
  password: "synthetic-only",
  fixtureId: owner,
  marker: "synthetic-marker",
  field: fakeField,
  button: () => ({
    async click() {
      submitted = true;
    },
  }),
  gearFixtureToken,
  sessions: loginSessions,
  check(ok, code) {
    assert(ok, code);
  },
});
assert.equal(tokenReads, 1);
assert(loginSessions.has(token));
console.log(
  "PASS: actual login flow succeeds with an unreadable transport response body, verifies fixture-owned session after navigation; wrong owner/malformed/denied storage fails closed",
);
const saveSource = source.slice(
  source.indexOf("async function save("),
  source.indexOf("async function reopen("),
);
async function saveModel(ok, conflicts) {
  return vm.runInNewContext(saveSource + ";save(page,copy)", {
    page: {
      waitForResponse: () => Promise.resolve({ ok: () => ok }),
      async waitForFunction() {},
      getByText() {
        throw Error("Duplicate success toasts must not be selected");
      },
    },
    copy: { save: "Save gear" },
    api: "https://esovqvampbrhuhamkfcs.supabase.co",
    button: () => ({ async click() {} }),
    conflict: () => ({
      async count() {
        return conflicts;
      },
    }),
    check(ok, code) {
      assert(ok, code);
    },
  });
}
await saveModel(true, 0);
await assert.rejects(saveModel(false, 0));
await assert.rejects(saveModel(true, 1));
console.log(
  "PASS: actual save helper waits for PATCH completion and unlocked fields, rejects HTTP/conflict errors, and does not select duplicate old success toasts",
);
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
const diagnostic = gearBrowserDiagnostic({
  message: "strict mode violation: resolved to 2 elements SECRET_SENTINEL user@example.invalid",
  stack: "at login (/cloud/recovery-gear-concurrency.mjs:212:17) SECRET_SENTINEL",
});
assert.deepEqual(diagnostic, {
  category: "ambiguous_locator",
  positions: [{ line: 212, column: 17 }],
  locatorMatches: 2,
  actionability: {
    resolvedControl: false,
    disabled: false,
    hidden: false,
    notEditable: false,
    detached: false,
  },
});
assert(!JSON.stringify(diagnostic).includes("SECRET_SENTINEL"));
assert(!JSON.stringify(diagnostic).includes("@"));
const fieldDeclaration = source.slice(
  source.indexOf("const field ="),
  source.indexOf("const button ="),
);
for (const label of ["备注", "Notes"]) {
  const selected = vm.runInNewContext(fieldDeclaration + ";field(page,label)", {
    label,
    page: {
      locator(selector) {
        return selector;
      },
      getByLabel() {
        throw Error("Notes must use unique real textarea");
      },
    },
  });
  assert.equal(selected, "fieldset textarea");
}
assert.equal(
  vm.runInNewContext(fieldDeclaration + ';field(page,"Brand")', {
    page: {
      getByLabel(name) {
        return name;
      },
    },
  }),
  "Brand",
);
const disabledDiagnostic = gearBrowserDiagnostic({
  message: "locator resolved to <textarea> element is not enabled SECRET_SENTINEL",
});
assert(disabledDiagnostic.actionability.resolvedControl);
assert(disabledDiagnostic.actionability.disabled);
assert(!JSON.stringify(disabledDiagnostic).includes("SECRET_SENTINEL"));
for (const [message, category] of [
  ["Timeout exceeded", "timeout"],
  ["Target page closed", "closed_target"],
  ["Response body unavailable", "response_body"],
  ["net::ERR_FAILED", "network"],
  ["foo is not a function", "javascript_type_or_reference"],
  ["arbitrary secret", "unclassified"],
])
  assert.equal(gearBrowserDiagnostic({ message }).category, category);
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
