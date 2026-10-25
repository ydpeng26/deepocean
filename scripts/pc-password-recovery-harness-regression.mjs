// Execute actual cloud interception/init callbacks in a local VM. No browser/network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { passwordRecoveryMock } from "./lib/password-recovery-mocks.mjs";
const source = fs.readFileSync(
  new URL("./recovery-password-verification.mjs", import.meta.url),
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
const newSession = { user: { id: "synthetic-new" }, access_token: "synthetic-new-token" },
  oldSession = { user: { id: "synthetic-old" }, access_token: "synthetic-old-token" },
  otherSession = { user: { id: "synthetic-other" }, access_token: "synthetic-other-token" };
const fixture = {
  api,
  hash: "synthetic-hash",
  code: "synthetic-code",
  verifier: "synthetic-verifier",
  password: "synthetic-password",
  newSession,
  otherSession,
  sessions: [newSession, oldSession, otherSession],
};
const counts = {
  verifies: 0,
  exchanges: 0,
  userReads: 0,
  newUserReads: 0,
  passwords: 0,
  logouts: 0,
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
  passwordRecoveryMock,
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
for (const mode of ["normal", "invalid-old", "network-error"]) {
  globals.mode = mode;
  const r = await request(api + "/auth/v1/verify", "POST", {
    token_hash: fixture.hash,
    type: "recovery",
  });
  assert.equal(r.action, mode === "network-error" ? "abort" : "fulfill");
  if (mode !== "network-error") assert.equal(r.response.status, mode === "invalid-old" ? 400 : 200);
  assert.equal(globals.unsafe, false);
}
globals.mode = "normal";
assert.equal(
  (
    await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
      auth_code: fixture.code,
      code_verifier: fixture.verifier,
    })
  ).response.status,
  200,
);
assert.equal(
  (await request(api + "/auth/v1/user", "GET", undefined, "Bearer " + newSession.access_token))
    .response.status,
  200,
);
for (const mode of ["normal", "update-error"]) {
  globals.mode = mode;
  const r = await request(
    api + "/auth/v1/user",
    "PUT",
    { password: fixture.password },
    "Bearer " + newSession.access_token,
  );
  assert.equal(r.action, "fulfill");
  assert.equal(r.response.status, mode === "normal" ? 200 : 422);
}
assert.equal(
  (
    await request(
      api + "/auth/v1/logout?scope=local",
      "POST",
      null,
      "Bearer " + newSession.access_token,
    )
  ).response.status,
  204,
);
for (const [url, method, body, bearer] of [
  [api + "/auth/v1/verify", "POST", { token_hash: "not-synthetic", type: "recovery" }],
  [api + "/auth/v1/verify", "POST", { token_hash: fixture.hash, type: "signup" }],
  [api + "/auth/v1/token?grant_type=password", "POST", {}],
  [
    api + "/auth/v1/token?grant_type=pkce",
    "POST",
    { auth_code: fixture.code, code_verifier: "wrong" },
  ],
  [
    api + "/auth/v1/user",
    "PUT",
    { password: "not-synthetic" },
    "Bearer " + newSession.access_token,
  ],
  [
    api + "/auth/v1/user",
    "PUT",
    { password: fixture.password },
    "Bearer " + otherSession.access_token,
  ],
  [
    api + "/auth/v1/user",
    "PUT",
    { password: fixture.password, user_metadata: {} },
    "Bearer " + newSession.access_token,
  ],
  [api + "/auth/v1/user", "GET", undefined, "Bearer not-synthetic"],
  [api + "/auth/v1/logout?scope=global", "POST", null, "Bearer " + newSession.access_token],
  [api + "/auth/v1/logout?scope=local", "POST", null, "Bearer " + otherSession.access_token],
  [api + "/auth/v1/recover", "POST", {}],
  [api + "/auth/v1/signup", "POST", {}],
  [api + "/rest/v1/profiles", "POST", {}],
  ["https://www.supdiver.com/auth", "GET"],
  ["https://accounts.google.com/o/oauth2/v2/auth", "GET"],
  [site + "/api/write", "POST", {}],
]) {
  assert.equal((await request(url, method, body, bearer)).action, "abort");
  assert.equal(globals.unsafe, true);
}
assert.equal((await request(site + "/assets/synthetic.js")).action, "continue");
for (const origin of ["null", api, "https://accounts.google.com"]) {
  let touches = 0;
  const scope = { window: { location: { origin } } };
  for (const key of ["sessionStorage", "localStorage"])
    Object.defineProperty(scope, key, {
      get() {
        touches++;
        throw Error("Opaque origin storage forbidden");
      },
    });
  vm.runInNewContext("(" + initFn + ")", scope)({ site });
  assert.equal(touches, 0);
}
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
assert.equal(window.__recoveryProbe.ownWrites, 1);
assert.equal(window.__recoveryProbe.cleanupAfterWrite, 1);
assert.equal(sessionStorage.getItem("recovery-fixture-text"), "synthetic session text");
assert.equal(localStorage.getItem("recovery-fixture-text"), "synthetic local text");
console.log(
  "PASS: actual_password_cloud_interceptor_allows_only_fixed_synthetic_auth_password_and_local_logout_responses_blocks_real_mail_accounts_formal_and_database_writes_and_skips_opaque_origin_storage",
);
