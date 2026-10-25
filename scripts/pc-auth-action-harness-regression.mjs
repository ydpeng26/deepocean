// Actual cloud route/init callbacks in a local VM. No browser or network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { authActionMock } from "./lib/auth-action-mocks.mjs";
const source = fs.readFileSync(new URL("./recovery-auth-actions.mjs", import.meta.url), "utf8");
const ast = ts.createSourceFile(
  "runner.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
let routeFn, initFn, literalFn, boundedFn, evaluateFn;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "bounded")
    boundedFn = node.getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "evaluate")
    evaluateFn = node.initializer.getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "literal")
    literalFn = node.initializer.getText(ast);
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    if (node.expression.name.text === "route") routeFn = node.arguments[1].getText(ast);
    if (node.expression.name.text === "addInitScript") initFn = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert(routeFn);
assert(initFn);
assert(literalFn);
assert(boundedFn);
assert(evaluateFn);
const bounded = vm.runInNewContext("(" + boundedFn + ")", { setTimeout, clearTimeout });
assert.equal(await bounded(Promise.resolve("ok"), "unused_deadline", 5), "ok");
await assert.rejects(
  bounded(new Promise(() => {}), "modeled_browser_stall", 5),
  (error) => error.auditCode === "modeled_browser_stall",
);
const evaluate = vm.runInNewContext("(" + evaluateFn + ")", {
  bounded: (promise, label) => bounded(promise, label, 5),
});
await assert.rejects(
  evaluate({ evaluate: () => new Promise(() => {}) }, () => {}),
  (error) => error.auditCode === "browser_evaluation_timeout",
);
for (const text of ['x("reset");y("resend")', "x('reset');y('resend')", "x(`reset`);y(`resend`)"]) {
  const literal = vm.runInNewContext("(" + literalFn + ")", { text });
  assert(literal("reset"));
  assert(literal("resend"));
  assert(!literal("missing"));
}
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const fixture = {
  site,
  api,
  email: "synthetic@example.invalid",
  password: "synthetic-password",
  session: { access_token: "synthetic-token", user: { id: "synthetic-user" } },
};
const counts = {
  signin: 0,
  signup: 0,
  reset: 0,
  resend: 0,
  google: 0,
  user: 0,
  logout: 0,
  completion: 0,
  forbidden: 0,
};
const globals = {
  URL,
  JSON,
  site,
  api,
  fixture,
  counts,
  authActionMock,
  mode: "normal",
  selected: undefined,
  unsafe: false,
  routeFailure: null,
  reached: { resolve() {} },
  gate: { promise: Promise.resolve() },
};
const handler = vm.runInContext("(" + routeFn + ")", vm.createContext(globals));
async function request(url, method = "GET", body, bearer) {
  let action, response;
  await handler({
    request: () => ({
      url: () => url,
      method: () => method,
      postDataJSON: () => body,
      headers: () => ({ authorization: bearer }),
    }),
    fulfill: async (value) => {
      action = "fulfill";
      response = value;
    },
    abort: async () => {
      action = "abort";
    },
    continue: async () => {
      action = "continue";
    },
  });
  return { action, response };
}
const signup = { email: fixture.email, password: fixture.password },
  reset = api + "/auth/v1/recover?redirect_to=" + encodeURIComponent(site + "/reset-password");
for (const [url, body, kind] of [
  [api + "/auth/v1/token?grant_type=password", signup, "signin"],
  [api + "/auth/v1/signup", signup, "signup"],
  [reset, { email: fixture.email }, "reset"],
  [api + "/auth/v1/resend", { email: fixture.email, type: "signup" }, "resend"],
]) {
  for (const mode of ["normal", "error", "network"]) {
    globals.mode = mode;
    const r = await request(url, "POST", body);
    assert.equal(r.action, mode === "network" ? "abort" : "fulfill");
    if (mode !== "network") assert.equal(r.response.status, mode === "error" ? 400 : 200);
    assert.equal(globals.unsafe, false);
  }
  assert.equal(counts[kind], 3);
}
globals.mode = "normal";
const authorize =
  api +
  "/auth/v1/authorize?" +
  new URLSearchParams({
    provider: "google",
    redirect_to: site + "/oauth-callback",
    code_challenge_method: "s256",
    code_challenge: "s".repeat(43),
  });
const google = await request(authorize);
assert.equal(google.response.status, 302);
assert.equal(google.response.headers.location, site + "/oauth-callback?error=access_denied");
assert.equal(
  (await request(api + "/auth/v1/user", "GET", undefined, "Bearer synthetic-token")).response
    .status,
  200,
);
assert.equal(
  (await request(api + "/auth/v1/logout?scope=local", "POST", null, "Bearer synthetic-token"))
    .response.status,
  204,
);
for (const [url, method, body, bearer] of [
  [api + "/auth/v1/signup", "POST", { ...signup, email: "not-synthetic@example.invalid" }],
  [api + "/auth/v1/token?grant_type=password", "POST", { ...signup, password: "not-synthetic" }],
  [api + "/auth/v1/token?grant_type=pkce", "POST", {}],
  [api + "/auth/v1/resend", "POST", { email: fixture.email, type: "recovery" }],
  [
    api +
      "/auth/v1/recover?redirect_to=" +
      encodeURIComponent("https://www.supdiver.com/reset-password"),
    "POST",
    { email: fixture.email },
  ],
  [authorize.replace("provider=google", "provider=apple"), "GET"],
  [authorize.replace("code_challenge_method=s256", "code_challenge_method=plain"), "GET"],
  [api + "/auth/v1/user", "GET", undefined, "Bearer not-synthetic"],
  [api + "/auth/v1/user", "PUT", { password: fixture.password }, "Bearer synthetic-token"],
  [api + "/auth/v1/logout?scope=global", "POST", null, "Bearer synthetic-token"],
  [api + "/rest/v1/profiles", "POST", {}],
  ["https://www.supdiver.com/auth", "GET"],
  ["https://accounts.google.com/o/oauth2/v2/auth", "GET"],
  [site + "/api/write", "POST", {}],
]) {
  assert.equal((await request(url, method, body, bearer)).action, "abort");
  assert.equal(globals.unsafe, true);
}
assert.equal((await request(site + "/assets/synthetic.js")).action, "continue");
assert.equal((await request(site + "/__auth-action-complete")).action, "fulfill");
assert.equal(counts.completion, 1);
for (const origin of ["null", api, "https://accounts.google.com"]) {
  let touches = 0;
  const scope = { window: { location: { origin } } };
  for (const key of ["localStorage", "sessionStorage"])
    Object.defineProperty(scope, key, {
      get() {
        touches++;
        throw Error("Opaque storage access forbidden");
      },
    });
  vm.runInNewContext("(" + initFn + ")", scope)({ site });
  assert.equal(touches, 0);
}
{
  class Storage {
    values = new Map();
    getItem(key) {
      return this.values.get(key) ?? null;
    }
    setItem(key, value) {
      this.values.set(key, value);
    }
  }
  const localStorage = new Storage(),
    sessionStorage = new Storage(),
    digestCalls = [],
    crypto = {
      subtle: {
        async digest(...args) {
          digestCalls.push(args);
          return "synthetic-original-digest";
        },
      },
    },
    scope = { window: { location: { origin: site } }, localStorage, sessionStorage, crypto };
  const init = vm.runInNewContext("(" + initFn + ")", scope);
  init({ site, language: "en" });
  assert.equal(localStorage.getItem("deepocean-language"), "en");
  assert.equal(sessionStorage.getItem("auth-action-fixture-text"), "synthetic session text");
  assert.equal(localStorage.getItem("auth-action-fixture-text"), "synthetic local text");
  sessionStorage.setItem("unrelated", "keep");
  init({ site, language: "zh-CN" });
  assert.equal(sessionStorage.getItem("unrelated"), "keep");
  const before = digestCalls.length;
  scope.window.__authActionGoogleHold = true;
  const held = crypto.subtle.digest("SHA-256", "synthetic-verifier-bytes");
  assert.equal(scope.window.__authActionGoogleReached, true);
  assert.equal(digestCalls.length, before);
  scope.window.__authActionGoogleRelease();
  assert.equal(await held, "synthetic-original-digest");
  assert.equal(digestCalls.length, before + 1);
  assert.deepEqual(digestCalls.at(-1), ["SHA-256", "synthetic-verifier-bytes"]);
}
console.log(
  "PASS: actual_auth_action_cloud_interceptor_only_fulfills_synthetic_credentials_mail_and_Google_cancel_blocks_real_provider_formal_password_and_database_writes_and_skips_opaque_storage",
);
console.log(
  "PASS: actual_google_pre_navigation_digest_checkpoint_preserves_original_result_and_browser_evaluation_watchdog_rejects_stalls_without_browser_or_network",
);
