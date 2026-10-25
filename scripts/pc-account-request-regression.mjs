// Actual transport + installed SDK, held headers/body and synthetic tokens only.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const module = { exports: {} },
  timers = new Map();
let timerId = 0;
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(new URL("../src/lib/account-request-fetch.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: 1, target: 9 } },
  ).outputText,
  {
    module,
    exports: module.exports,
    URL,
    Request,
    Response,
    Error,
    AbortController,
    setTimeout(fn) {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  },
);
const {
  createAccountRequestFetch,
  mountAccountRequestPage,
  ACCOUNT_REQUEST_TIMEOUT_MESSAGE,
  accountRequestErrorMessage,
} = module.exports;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function expire() {
  for (const fn of [...timers.values()]) fn();
}
const project = "https://synthetic-account.supabase.co";
const session = (owner) => ({
  access_token: "synthetic-" + owner,
  refresh_token: "synthetic-refresh-" + owner,
  token_type: "bearer",
  expires_in: 3600,
  user: {
    id: owner,
    email: "synthetic@example.invalid",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  },
});
const response = (owner) =>
  new Response(JSON.stringify(session(owner)), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
for (const kind of ["signin", "signup", "resend", "reset"]) {
  for (const phase of ["headers", "body", "unmount"]) {
    const closePage = mountAccountRequestPage();
    const held = gate(),
      storage = new Map([["unrelated-draft", "keep"]]),
      events = [];
    let attempt = 0,
      signal;
    const transport = createAccountRequestFetch(project, async (_url, init) => {
      signal = init.signal;
      if (++attempt > 1) return response("B");
      if (phase === "body")
        return {
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          arrayBuffer: () => held.promise,
        };
      return held.promise; // Deliberately ignores abort to test stale-response rejection.
    });
    const sdk = createClient(project, "synthetic-key", {
      global: { fetch: transport },
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
          removeItem: (key) => storage.delete(key),
        },
      },
    });
    const subscription = sdk.auth.onAuthStateChange((event, value) => {
      if (event === "SIGNED_IN") events.push(value.user.id);
    }).data.subscription;
    const call = () =>
      kind === "signin"
        ? sdk.auth.signInWithPassword({
            email: "synthetic@example.invalid",
            password: "Synthetic-only-726",
          })
        : kind === "signup"
          ? sdk.auth.signUp({ email: "synthetic@example.invalid", password: "Synthetic-only-726" })
          : kind === "resend"
            ? sdk.auth.resend({ type: "signup", email: "synthetic@example.invalid" })
            : sdk.auth.resetPasswordForEmail("synthetic@example.invalid");
    const first = call();
    await tick();
    assert.equal(attempt, 1);
    assert.equal(signal.aborted, false);
    if (phase === "unmount") closePage();
    else expire();
    const failure = await first;
    assert(failure.error);
    if (phase !== "unmount")
      assert(failure.error.message.includes(ACCOUNT_REQUEST_TIMEOUT_MESSAGE));
    assert.equal(signal.aborted, true);
    assert.equal((await sdk.auth.getSession()).data.session, null);
    assert.equal(timers.size, 0);
    const retry = await call();
    assert.equal(retry.error, null);
    assert.equal(attempt, 2, "retry starts only once and only on explicit call");
    if (["signin", "signup"].includes(kind)) {
      assert.equal((await sdk.auth.getSession()).data.session.user.id, "B");
      assert.deepEqual(events, ["B"]);
    }
    const beforeLate = [...storage.entries()];
    held.resolve(phase === "body" ? await response("A").arrayBuffer() : response("A"));
    await tick();
    await tick();
    assert.deepEqual([...storage.entries()], beforeLate);
    assert(!events.includes("A"), "late response must not save or emit a signed-in event");
    assert.equal(storage.get("unrelated-draft"), "keep");
    assert.equal(timers.size, 0);
    subscription.unsubscribe();
    await sdk.auth.stopAutoRefresh();
    closePage();
  }
  console.log(
    "PASS: installed_SDK_" +
      kind +
      "_headers_body_deadlines_and_unmount_abort_unlock_explicit_retry_reject_abort_ignoring_late_response_preserve_new_session_and_draft",
  );
}
{
  const closeOld = mountAccountRequestPage();
  const closeNew = mountAccountRequestPage();
  const held = gate();
  let signal;
  const wrapped = createAccountRequestFetch(project, async (_url, init) => {
    signal = init.signal;
    return held.promise;
  });
  const request = wrapped(project + "/auth/v1/signup", { method: "POST" });
  closeOld();
  assert.equal(signal.aborted, false, "old page cleanup cannot cancel new page transport");
  held.resolve(response("new-page"));
  assert.equal((await request).status, 200);
  closeNew();
  assert.equal(timers.size, 0);
}
// Unknown endpoints/hosts and refresh/logout/verification are delegated unchanged.
for (const path of [
  "/rest/v1/dives",
  "/auth/v1/user",
  "/auth/v1/logout",
  "/auth/v1/verify",
  "/auth/v1/token?grant_type=refresh_token",
]) {
  const init = { method: "POST" },
    value = response("untouched");
  const wrapped = createAccountRequestFetch(project, async (_input, actual) => {
    assert.equal(actual, init);
    return value;
  });
  assert.equal(await wrapped(project + path, init), value);
  assert.equal(timers.size, 0);
}
{
  const value = response("foreign-pass-through");
  const wrapped = createAccountRequestFetch(project, async () => value);
  assert.equal(
    await wrapped("https://different.invalid/auth/v1/signup", { method: "POST" }),
    value,
  );
  assert.equal(timers.size, 0);
}
{
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const wrapped = createAccountRequestFetch(project, async () => {
    calls++;
    return response("A");
  });
  await assert.rejects(
    wrapped(project + "/auth/v1/signup", { method: "POST", signal: controller.signal }),
  );
  assert.equal(calls, 0);
  assert.equal(timers.size, 0);
}
for (const language of ["zh-CN", "en"]) {
  const message = accountRequestErrorMessage(
    new Error(ACCOUNT_REQUEST_TIMEOUT_MESSAGE),
    language,
    "fallback",
  );
  assert(message.includes(language === "en" ? "Request timed out" : "请求等待超时"));
  assert(!message.includes(" / "));
  assert.equal(
    accountRequestErrorMessage(new Error("synthetic detail"), language, "fallback", false),
    "fallback",
  );
}
{
  const clientModule = { exports: {} },
    options = [];
  let wrapped = 0,
    network = 0;
  const dependencies = {
    "@supabase/supabase-js": {
      createClient(_url, _key, value) {
        options.push(value);
        return { auth: {} };
      },
    },
    "@/lib/tab-auth-storage": { getTabAuthStorage: () => ({}) },
    "@/lib/google-oauth-keys": { googleOAuthKeys: () => ({ session: "synthetic-google" }) },
    "@/lib/account-request-fetch": {
      createAccountRequestFetch(...args) {
        wrapped++;
        return createAccountRequestFetch(...args);
      },
    },
  };
  const code = fs
    .readFileSync(new URL("../src/integrations/supabase/client.ts", import.meta.url), "utf8")
    .replaceAll(
      "import.meta.env",
      JSON.stringify({
        VITE_SUPABASE_URL: project,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
      }),
    );
  vm.runInNewContext(
    ts.transpileModule(code, { compilerOptions: { module: 1, target: 9 } }).outputText,
    {
      module: clientModule,
      exports: clientModule.exports,
      URL,
      Headers,
      Request,
      window: { location: { pathname: "/auth" }, localStorage: { removeItem() {} } },
      require: (name) => dependencies[name] ?? {},
      fetch: async (_url, init) => {
        network++;
        assert.equal(new Headers(init.headers).get("apikey"), "sb_publishable_synthetic");
        assert.equal(new Headers(init.headers).get("authorization"), null);
        return response("wired");
      },
    },
  );
  void clientModule.exports.supabase.auth;
  void clientModule.exports.googleOAuth.auth;
  for (const opts of options)
    await opts.global.fetch(project + "/auth/v1/signup", {
      method: "POST",
      headers: { authorization: "Bearer sb_publishable_synthetic" },
    });
  assert.equal(wrapped, 1, "only main client receives account request deadline wrapper");
  assert.equal(network, 2);
  assert.equal(timers.size, 0);
}
console.log(
  "PASS: scoped_endpoint_passthrough_abort_before_fetch_bilingual_timeout_and_generic_reset_error_preserved",
);
console.log(
  "AUDIT: local_only; all_fetches_mocked; no_browser_network_real_accounts_mail_password_changes_or_deployment",
);
