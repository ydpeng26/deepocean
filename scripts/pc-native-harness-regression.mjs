// Execute the native cloud harness's real interception callback, not a browser.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const source = fs.readFileSync(new URL("./recovery-google-native.mjs", import.meta.url), "utf8");
const ast = ts.createSourceFile(
  "runner.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
let callback;
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "route"
  )
    callback = node.arguments[1].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert(callback);
const site = "https://supdiver-recovery-test.vercel.app",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
const globals = {
  URL,
  JSON,
  createHash,
  site,
  api,
  mode: "normal",
  unsafe: false,
  routeFailure: null,
  stats: { authorize: 0, exchanges: 0, userReads: 0, forbidden: 0 },
  syntheticCode: "synthetic-native-code",
  jwt: "synthetic-only",
  user: { id: "synthetic-user" },
  cors: () => ({}),
  check(ok, code) {
    if (!ok) {
      const error = Error(code);
      error.auditCode = code;
      throw error;
    }
  },
};
const context = vm.createContext(globals);
const handler = vm.runInContext("(" + callback + ")", context);
async function request(url, method = "GET", body, auth) {
  let action, response;
  await handler({
    request: () => ({
      url: () => url,
      method: () => method,
      postDataJSON: () => body,
      headers: () => ({ authorization: auth }),
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
const verifier = "synthetic-verifier",
  challenge = createHash("sha256").update(verifier).digest("base64url");
const authorize = new URL("/auth/v1/authorize", api);
authorize.search = new URLSearchParams({
  provider: "google",
  redirect_to: site + "/oauth-callback",
  code_challenge_method: "s256",
  code_challenge: challenge,
}).toString();
let r = await request(authorize.href);
assert.equal(r.action, "fulfill");
assert.equal(r.response.status, 302);
assert.equal(r.response.headers.location, site + "/oauth-callback?code=" + globals.syntheticCode);
globals.mode = "cancel";
r = await request(authorize.href);
assert.equal(r.response.headers.location, site + "/oauth-callback?error=access_denied");
globals.mode = "normal";
r = await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
  auth_code: globals.syntheticCode,
  code_verifier: verifier,
});
assert.equal(r.action, "fulfill");
assert.equal(JSON.parse(r.response.body).access_token, globals.jwt);
r = await request(api + "/auth/v1/user", "GET", null, "Bearer " + globals.jwt);
assert.equal(r.action, "fulfill");
assert.equal(r.response.status, 200);
globals.mode = "rejected-user";
r = await request(api + "/auth/v1/user", "GET", null, "Bearer " + globals.jwt);
assert.equal(r.response.status, 401);
globals.mode = "exchange-error";
r = await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
  auth_code: globals.syntheticCode,
  code_verifier: verifier,
});
assert.equal(r.response.status, 400);
assert.equal(globals.unsafe, false);
for (const [url, method] of [
  [api + "/auth/v1/token?grant_type=password", "POST"],
  [api + "/rest/v1/profiles", "POST"],
  ["https://accounts.google.com/o/oauth2/v2/auth", "GET"],
  ["https://www.supdiver.com/auth", "GET"],
  [site + "/~oauth/initiate", "GET"],
  [site + "/api/anything", "POST"],
]) {
  r = await request(url, method);
  assert.equal(r.action, "abort");
  assert.equal(globals.unsafe, true);
}
r = await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
  auth_code: "not-synthetic",
  code_verifier: verifier,
});
assert.equal(r.action, "abort");
assert.equal(globals.routeFailure, "synthetic_code_only");
r = await request(api + "/auth/v1/token?grant_type=pkce", "POST", {
  auth_code: globals.syntheticCode,
  code_verifier: "wrong",
});
assert.equal(r.action, "abort");
assert.equal(globals.routeFailure, "actual_verifier_matches_native_challenge");
r = await request(site + "/assets/example.js");
assert.equal(r.action, "continue");
r = await request(site + "/__native-complete");
assert.equal(r.action, "fulfill");
console.log(
  "PASS: actual_native_cloud_interceptor_checks_PKCE_binding_fulfills_only_synthetic_authorize_exchange_user_and_blocks_real_provider_formal_site_password_grant_and_backend_writes",
);
