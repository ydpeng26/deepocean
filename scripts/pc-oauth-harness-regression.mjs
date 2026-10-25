// Execute the actual cloud-runner callbacks as local no-network models.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const source = fs.readFileSync(new URL("./recovery-oauth-session.mjs", import.meta.url), "utf8");
const ast = ts.createSourceFile(
  "runner.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
function callback(name) {
  let found;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === name
    )
      found = node.arguments[name === "route" ? 1 : 0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert(found);
  return found;
}
const site = "https://supdiver-recovery-test.vercel.app",
  broker = "https://oauth.lovable.app/__supdiver_synthetic_oauth",
  api = "https://esovqvampbrhuhamkfcs.supabase.co";
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
  opened = [],
  listeners = {};
const window = {
  sessionStorage,
  open: (...args) => {
    opened.push(args);
    return "synthetic-popup";
  },
  addEventListener: (name, fn) => {
    listeners[name] = fn;
  },
};
const init = vm.runInNewContext("(" + callback("addInitScript") + ")", {
  window,
  Storage,
  localStorage,
  sessionStorage,
  URL,
  DOMException,
});
init({ language: "en", tokenKey: "synthetic-token-key", site, broker });
assert.equal(
  window.open(
    "/~oauth/initiate?provider=google&state=synthetic-state&redirect_uri=" +
      encodeURIComponent(site + "/__oauth-complete"),
    "oauth",
  ),
  "synthetic-popup",
);
const mapped = new URL(opened[0][0]);
assert.equal(mapped.origin + mapped.pathname, broker);
assert.equal(mapped.searchParams.get("state"), "synthetic-state");
assert.equal(mapped.searchParams.get("redirect_uri"), site + "/__oauth-complete");
assert.throws(() => window.open("https://example.invalid"));
window.__oauthBlockPopup = true;
assert.equal(window.open("/~oauth/initiate"), null);
assert.equal(opened.length, 1);
listeners.message({ origin: "https://example.invalid", data: { type: "authorization_response" } });
assert.equal(window.__oauthProbe.validMessages, 0);
listeners.message({ origin: new URL(broker).origin, data: { type: "authorization_response" } });
assert.equal(window.__oauthProbe.validMessages, 1);
window.__oauthDenySave = true;
assert.throws(
  () => sessionStorage.setItem("synthetic-token-key", "synthetic"),
  (e) => e.name === "QuotaExceededError",
);
sessionStorage.setItem("unrelated", "retained");
assert.equal(sessionStorage.getItem("unrelated"), "retained");
console.log(
  "PASS: actual_runner_popup_mapping_preserves_state_return_origin_and_blocked_popup_model_no_real_broker_or_unrelated_storage_clear",
);
const globals = {
  URL,
  site,
  broker,
  api,
  fixtureId: "synthetic-id",
  tokenKey: "synthetic-token-key",
  jwt: "synthetic-jwt",
  mode: "normal",
  topLevel: false,
  attempts: 0,
  mockedUserReads: 0,
  unsafe: false,
  stats: { brokerReplies: 0, userReads: 0, preflights: 0, pageErrors: 0 },
  check(ok, code) {
    assert(ok, code);
  },
};
const route = vm.runInNewContext("(" + callback("route") + ")", globals);
async function request(url, method = "GET", headers = {}) {
  const result = {};
  await route({
    request: () => ({ url: () => url, method: () => method, headers: () => headers }),
    fulfill: async (options) => {
      result.fulfilled = options;
    },
    abort: async () => {
      result.aborted = true;
    },
    continue: async () => {
      result.continued = true;
    },
  });
  return result;
}
const mocked = await request(api + "/auth/v1/user", "GET", {
  authorization: "Bearer synthetic-jwt",
});
assert.equal(mocked.fulfilled.status, 200);
assert.equal(mocked.continued, undefined);
const preflight = await request(api + "/auth/v1/user", "OPTIONS", {
  "access-control-request-headers": "authorization,x-client-info",
});
assert.equal(
  preflight.fulfilled.headers["access-control-allow-headers"],
  "authorization,x-client-info",
);
const reply = await request(
  broker +
    "?provider=google&state=synthetic-state&redirect_uri=" +
    encodeURIComponent(site + "/__oauth-complete"),
);
assert(reply.fulfilled.body.includes("authorization_response"));
assert.equal(reply.continued, undefined);
for (const url of [
  api + "/auth/v1/token",
  "https://other.supabase.co/rest/v1/profiles",
  "https://accounts.google.com/",
  "https://www.supdiver.com/auth",
]) {
  assert((await request(url)).aborted);
}
assert((await request(site + "/anything", "POST")).aborted);
console.log(
  "PASS: actual_runner_mocks_only_expected_auth_read_and_CORS_broker_reply_blocks_other_backend_production_Google_and_writes_without_network",
);
