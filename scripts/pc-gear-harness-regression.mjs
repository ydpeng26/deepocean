// Cloud acceptance guard/source contracts; no external network or credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { gearRecoveryPreflight } from "./lib/gear-recovery-preflight.mjs";
import { gearBrowserDiagnostic } from "./lib/gear-browser-diagnostic.mjs";
import { gearFixtureToken } from "./lib/gear-fixture-session.mjs";
import vm from "node:vm";
import { gearNotesMatch } from "./lib/gear-notes-control.mjs";
import { gearTrafficDiagnostic } from "./lib/gear-traffic-diagnostic.mjs";
import { nativeErrorDiagnostic } from "./lib/native-error-diagnostic.mjs";
import { initializeGearLanguage, isGearFontStylesheet } from "./lib/gear-browser-setup.mjs";
const runner = new URL("./recovery-gear-concurrency.mjs", import.meta.url);
const source = fs.readFileSync(runner, "utf8");
const sensitiveUrl =
  "https://foreign.example.invalid/private/SECRET_SENTINEL?email=synthetic@example.invalid&access_token=SECRET_SENTINEL";
const boundary = gearTrafficDiagnostic(
  sensitiveUrl,
  "SECRET_SENTINEL",
  "SECRET_SENTINEL",
  "SECRET_SENTINEL",
);
assert.deepEqual(boundary, {
  origin: "foreign",
  family: "other",
  method: "OTHER",
  resource: "other",
  reason: "route_handler_error",
});
assert(!JSON.stringify(boundary).includes("SECRET_SENTINEL"));
assert(!JSON.stringify(boundary).includes("@"));
assert.equal(
  gearTrafficDiagnostic(
    "https://zmhtlhpeulhhcvlnjdrb.supabase.co/rest/v1/profiles?select=SECRET_SENTINEL",
    "GET",
    "fetch",
    "foreign_origin",
  ).origin,
  "production",
);
assert.equal(
  gearTrafficDiagnostic(
    "https://esovqvampbrhuhamkfcs.supabase.co/rest/v1/rpc/private_function?token=SECRET_SENTINEL",
    "POST",
    "xhr",
    "fixture_mutations_only",
  ).family,
  "other_rpc",
);
assert.equal(
  nativeErrorDiagnostic(Error("Minified React error #418; SECRET_SENTINEL")).category,
  "react",
);
assert(
  !JSON.stringify(nativeErrorDiagnostic(Error("SECRET_SENTINEL"))).includes("SECRET_SENTINEL"),
);
assert(source.includes('check(!unsafe, "blocked_request_boundary_violation")'));
assert(source.includes('"unexpected_browser_script_error"'));
assert(!source.includes('"browser_errors_or_unsafe_traffic"'));
console.log(
  "PASS: separate blocked-request and page-error checks preserved; request diagnostics omit raw URLs/queries/headers/bodies/identities; script errors report fixed categories only",
);
// Exercise the actual cloud context's routing and page-error callbacks locally.
const contextSource = source.slice(
  source.indexOf("async function context("),
  source.indexOf("function reportContext("),
);
const callbacks = {};
const fakeContext = {
  async addInitScript(fn, arg) {
    callbacks.init = { fn, arg };
  },
  on(name, callback) {
    callbacks[name] = callback;
  },
  async route(_pattern, callback) {
    callbacks.route = callback;
  },
};
const sandbox = vm.createContext({
  browser: {
    async newContext() {
      return fakeContext;
    },
  },
  site: "https://supdiver-recovery-test.vercel.app",
  api: "https://esovqvampbrhuhamkfcs.supabase.co",
  fixtureId: "fixture-owner",
  email: "synthetic@example.invalid",
  stage: "synthetic-phase",
  unsafe: false,
  URL,
  gearTrafficDiagnostic,
  nativeErrorDiagnostic,
  initializeGearLanguage,
  isGearFontStylesheet,
  check(ok, code) {
    if (!ok) {
      const e = Error(code);
      e.auditCode = code;
      throw e;
    }
  },
});
const fixtureContext = await vm.runInContext(
  contextSource + ';context("zh-CN","fixture-row")',
  sandbox,
);
function routeFixture(url, method = "GET", resourceType = "fetch") {
  const state = { continued: 0, aborted: 0, fulfilled: 0 };
  return {
    state,
    request: () => ({
      url: () => url,
      method: () => method,
      resourceType: () => resourceType,
      postDataJSON: () => ({ email: "synthetic@example.invalid" }),
    }),
    async continue() {
      state.continued++;
    },
    async abort() {
      state.aborted++;
    },
    async fulfill(response) {
      assert.equal(response.status, 200);
      assert.equal(response.contentType, "text/css");
      assert(!response.body.includes("url("));
      state.fulfilled++;
    },
  };
}
for (const [url, method, expected] of [
  ["https://supdiver-recovery-test.vercel.app/assets/synthetic.js", "GET", "continued"],
  ["https://esovqvampbrhuhamkfcs.supabase.co/rest/v1/gear_items?select=*", "GET", "continued"],
  [
    "https://esovqvampbrhuhamkfcs.supabase.co/rest/v1/gear_items?id=eq.fixture-row&user_id=eq.fixture-owner&updated_at=eq.v0",
    "PATCH",
    "continued",
  ],
  [
    "https://esovqvampbrhuhamkfcs.supabase.co/rest/v1/gear_items?id=eq.fixture-row&user_id=eq.fixture-owner",
    "PATCH",
    "aborted",
  ],
  [
    "https://esovqvampbrhuhamkfcs.supabase.co/rest/v1/other?token=SECRET_SENTINEL",
    "GET",
    "aborted",
  ],
  [sensitiveUrl, "GET", "aborted"],
]) {
  const route = routeFixture(url, method);
  await callbacks.route(route);
  assert.equal(route.state[expected], 1);
}
assert.equal(fixtureContext.stats.blocked, 3);
assert(sandbox.unsafe);
const fontUrl =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap";
assert(isGearFontStylesheet(fontUrl, "GET", "stylesheet"));
for (const [url, method, type] of [
  [fontUrl + "&token=SECRET_SENTINEL", "GET", "stylesheet"],
  [fontUrl, "POST", "stylesheet"],
  [fontUrl, "GET", "script"],
  [fontUrl.replace("fonts.googleapis.com", "foreign.invalid"), "GET", "stylesheet"],
  [fontUrl.replace("Noto+Sans+SC", "Other+Font"), "GET", "stylesheet"],
])
  assert(!isGearFontStylesheet(url, method, type));
const fontRoute = routeFixture(fontUrl, "GET", "stylesheet");
await callbacks.route(fontRoute);
assert.equal(fontRoute.state.fulfilled, 1);
assert.equal(fontRoute.state.continued, 0);
assert.equal(fontRoute.state.aborted, 0);
assert.equal(fixtureContext.stats.fontStubs, 1);
assert.equal(fixtureContext.stats.blocked, 3);
const unknownCss = routeFixture(fontUrl + "&token=SECRET_SENTINEL", "GET", "stylesheet");
await callbacks.route(unknownCss);
assert.equal(unknownCss.state.aborted, 1);
assert.equal(fixtureContext.stats.blocked, 4);
let writes = 0;
for (const origin of ["null", "https://foreign.invalid", "https://www.supdiver.com"]) {
  vm.runInNewContext("(" + callbacks.init.fn.toString() + ")(language)", {
    language: callbacks.init.arg,
    location: { origin },
    localStorage: {
      setItem() {
        writes++;
        throw Error("Opaque-origin storage accessed");
      },
    },
  });
}
assert.equal(writes, 0);
vm.runInNewContext("(" + callbacks.init.fn.toString() + ")(language)", {
  language: "en",
  location: { origin: "https://supdiver-recovery-test.vercel.app" },
  localStorage: {
    setItem(key, value) {
      assert.equal(key, "deepocean-language");
      assert.equal(value, "en");
      writes++;
    },
  },
});
assert.equal(writes, 1);
assert.throws(() =>
  vm.runInNewContext("(" + callbacks.init.fn.toString() + ")(language)", {
    language: "en",
    location: { origin: "https://supdiver-recovery-test.vercel.app" },
    localStorage: {
      setItem() {
        throw Error("Synthetic actual-site storage denial");
      },
    },
  }),
);
let pageError;
callbacks.page({
  on(name, callback) {
    assert.equal(name, "pageerror");
    pageError = callback;
  },
});
pageError(Error("Minified React error #418; SECRET_SENTINEL"));
assert.equal(fixtureContext.stats.errors, 1);
assert.equal(fixtureContext.stats.errorKinds[0].category, "react");
assert.equal(fixtureContext.stats.errorKinds[0].reactCode, 418);
const contextReport = source.slice(
  source.indexOf("function reportContext("),
  source.indexOf("// Gear has exactly one textarea."),
);
const lines = [];
sandbox.console = {
  log(line) {
    lines.push(line);
  },
};
sandbox.fixtureStats = fixtureContext.stats;
vm.runInContext(contextReport + ';reportContext("fixture-context",fixtureStats)', sandbox);
const output = lines.join("");
assert(!output.includes("SECRET_SENTINEL"));
assert(!output.includes("synthetic@example.invalid"));
assert(!output.includes("fixture-owner"));
assert(!output.includes("https://"));
assert(output.includes('"pageErrors":1'));
assert(output.includes('"blockedRequests":4'));
assert(output.includes('"fontStylesheetsStubbed":1'));
console.log(
  "PASS: actual context init skips opaque/foreign/production origins but preserves real-site storage failures; only exact known font CSS is fulfilled locally without forwarding; unknown CSS remains blocked",
);
console.log(
  "PASS: actual route callbacks still block foreign/read-boundary/missing-revision writes, permit scoped operations, capture page errors independently, and emit sanitized context reports",
);
function notesMatch(controls, expected) {
  return vm.runInNewContext("(" + gearNotesMatch.toString() + ")(expected)", {
    expected,
    document: {
      querySelectorAll(selector) {
        assert.equal(selector, "fieldset textarea");
        return controls;
      },
    },
  });
}
assert(
  notesMatch(
    [{ value: "newer A notes", parentElement: { textContent: "备注newer A notes" } }],
    "newer A notes",
  ),
);
assert(!notesMatch([{ value: "old notes" }], "newer A notes"));
assert(!notesMatch([], "newer A notes"));
assert(!notesMatch([{ value: "newer A notes" }, { value: "newer A notes" }], "newer A notes"));
assert(source.includes('await b.waitForFunction(gearNotesMatch, "newer A notes")'));
console.log(
  "PASS: serialized notes reload check reads the unique real textarea value, tolerates parent label text containing note content, rejects wrong/missing/duplicate controls",
);
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
