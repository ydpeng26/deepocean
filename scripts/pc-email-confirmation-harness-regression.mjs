// Actual recovery interceptor/init callbacks, without browser or network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { emailConfirmationMock } from "./lib/email-confirmation-mocks.mjs";
const source = fs.readFileSync(
  new URL("./recovery-email-confirmation.mjs", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "runner.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
let routeFn, initFn;
function visit(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    if (node.expression.name.text === "route") routeFn = node.arguments[1].getText(ast);
    if (node.expression.name.text === "addInitScript") initFn = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert(routeFn);
assert(initFn);
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const oldSession = { user: { id: "synthetic-old" }, access_token: "synthetic-old-jwt" };
const newSession = {
  user: { id: "synthetic-new", email_confirmed_at: "2026-10-25" },
  access_token: "synthetic-new-jwt",
};
const otherSession = { user: { id: "synthetic-other" }, access_token: "synthetic-other-jwt" };
const fixture = {
  api,
  hash: "synthetic-hash",
  code: "synthetic-code",
  verifier: "synthetic-verifier",
  newSession,
  otherSession,
  sessions: [oldSession, newSession, otherSession],
};
const counts = {
  verifies: 0,
  exchanges: 0,
  userReads: 0,
  newUserReads: 0,
  completions: 0,
  forbidden: 0,
};
const globals = {
  URL,
  JSON,
  site,
  api,
  fixture,
  counts,
  mode: "normal",
  emailConfirmationMock,
  unsafe: false,
  routeFailure: null,
  reached: { resolve() {} },
  gate: { promise: Promise.resolve() },
};
const context = vm.createContext(globals),
  handler = vm.runInContext("(" + routeFn + ")", context);
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
let r = await request(api + "/auth/v1/verify", "POST", {
  token_hash: fixture.hash,
  type: "signup",
});
assert.equal(r.action, "fulfill");
assert.equal(JSON.parse(r.response.body).user.id, newSession.user.id);
globals.mode = "invalid-old";
r = await request(api + "/auth/v1/verify", "POST", { token_hash: fixture.hash, type: "signup" });
assert.equal(r.response.status, 400);
globals.mode = "network-error";
r = await request(api + "/auth/v1/verify", "POST", { token_hash: fixture.hash, type: "signup" });
assert.equal(r.action, "abort");
assert.equal(globals.unsafe, false);
globals.mode = "normal";
r = await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
  auth_code: fixture.code,
  code_verifier: fixture.verifier,
});
assert.equal(r.response.status, 200);
for (const mode of ["normal", "user-mismatch", "unconfirmed"]) {
  globals.mode = mode;
  r = await request(api + "/auth/v1/user", "GET", undefined, "Bearer " + newSession.access_token);
  const user = JSON.parse(r.response.body);
  assert.equal(user.id, mode === "user-mismatch" ? otherSession.user.id : newSession.user.id);
  if (mode === "unconfirmed") assert.equal(user.email_confirmed_at, null);
}
for (const [url, method, body, bearer] of [
  [api + "/auth/v1/verify", "POST", { token_hash: "not-synthetic", type: "signup" }],
  [api + "/auth/v1/token?grant_type=password", "POST", {}],
  [
    api + "/auth/v1/token?grant_type=pkce",
    "POST",
    { auth_code: fixture.code, code_verifier: "not-synthetic" },
  ],
  [api + "/auth/v1/user", "GET", undefined, "Bearer not-synthetic"],
  [api + "/rest/v1/profiles", "POST", {}],
  ["https://accounts.google.com/o/oauth2/v2/auth", "GET"],
  ["https://www.supdiver.com/auth", "GET"],
  [site + "/api/write", "POST", {}],
]) {
  r = await request(url, method, body, bearer);
  assert.equal(r.action, "abort");
  assert.equal(globals.unsafe, true);
}
r = await request(site + "/assets/synthetic.js");
assert.equal(r.action, "continue");
r = await request(site + "/__email-complete");
assert.equal(r.action, "fulfill");
assert.equal(counts.completions, 1);
for (const origin of ["null", api, "https://accounts.google.com"]) {
  let touches = 0;
  const scope = { window: { location: { origin } } };
  for (const key of ["localStorage", "sessionStorage"])
    Object.defineProperty(scope, key, {
      get() {
        touches++;
        throw Error("Storage unavailable in opaque origin");
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
    removeItem(key) {
      this.values.delete(key);
    }
  }
  const localStorage = new Storage(),
    sessionStorage = new Storage(),
    window = { location: { origin: site } };
  const init = vm.runInNewContext("(" + initFn + ")", {
    localStorage,
    sessionStorage,
    window,
    Storage,
    DOMException,
  });
  init({
    site,
    language: "en",
    mainKey: "synthetic-main",
    ownKey: "synthetic-own",
    newId: newSession.user.id,
    oldSession,
    seedOld: true,
    kind: "code",
    verifier: fixture.verifier,
    initialMode: "save-denied",
  });
  assert.equal(JSON.parse(sessionStorage.getItem("synthetic-main")).user.id, oldSession.user.id);
  assert.throws(
    () => sessionStorage.setItem("synthetic-main", JSON.stringify(newSession)),
    (error) => error.name === "QuotaExceededError",
  );
  sessionStorage.setItem("synthetic-own", "synthetic");
  sessionStorage.removeItem("synthetic-own");
  assert.equal(window.__emailProbe.ownWrites, 1);
  assert.equal(window.__emailProbe.cleanupAfterWrite, 1);
  assert.equal(sessionStorage.getItem("email-fixture-text"), "synthetic session text");
  assert.equal(localStorage.getItem("email-fixture-text"), "synthetic local text");
}
console.log(
  "PASS: actual_email_cloud_interceptor_fulfills_only_synthetic_confirmation_PKCE_and_user_reads_blocks_formal_real_providers_and_backend_writes_and_init_skips_opaque_origins",
);
