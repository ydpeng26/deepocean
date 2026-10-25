// Actual source + installed SDK, synthetic storage/session only. No browser/network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
function load(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const source = fs
    .readFileSync(new URL("../" + file, import.meta.url), "utf8")
    .replaceAll(
      "import.meta.env",
      "({VITE_SUPABASE_URL:'https://synthetic.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key'})",
    );
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => dependencies[name] ?? {},
      URL,
      URLSearchParams,
      Date,
      Promise,
      crypto: globalThis.crypto,
      ...globals,
    },
  );
  return module.exports;
}
const returns = load("src/lib/auth-return.ts");
const keysModule = load("src/lib/google-oauth-keys.ts");
const sessionModule = load("src/lib/oauth-session.ts");
const { createGoogleOAuthFlow } = load("src/lib/google-oauth-flow.ts", {
  "@/lib/auth-return": returns,
  "@/lib/google-oauth-keys": keysModule,
  "@/lib/oauth-session": sessionModule,
});
const projectUrl = "https://synthetic.supabase.co",
  origin = "https://app.invalid";
const keys = keysModule.googleOAuthKeys(projectUrl);
const marker = "SYNTHETIC_PRIVATE_ERROR";
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function harness(mode = "normal") {
  const entries = new Map([
    ["unrelated-draft", "keep"],
    ["main-auth", "keep"],
  ]);
  let current = null,
    available = true,
    callback = true,
    timestamp = 1000,
    starts = 0,
    exchanges = 0,
    saves = 0,
    pause;
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => {
      if (mode === "cleanup-denied" && key === keys.session) throw Error(marker);
      entries.delete(key);
    },
  };
  const user = {
    id: "synthetic-user",
    app_metadata: { provider: mode === "wrong-provider" ? "email" : "google" },
  };
  const deps = {
    storage,
    projectUrl,
    origin,
    available: () => available,
    onCallback: () => callback,
    now: () => timestamp,
    nonce: () => "synthetic-attempt",
    main: {
      getSession: async () => ({
        data: { session: current ? { user: { id: current } } : null },
        error: null,
      }),
      setSession: async () => {
        saves++;
        if (mode === "save-throw") throw Error(marker);
        if (mode === "save-error") return { data: { session: null }, error: Error(marker) };
        current = user.id;
        return { data: { session: { user } }, error: null };
      },
    },
    oauth: {
      stopAutoRefresh: async () => {},
      signInWithOAuth: async (input) => {
        starts++;
        assert.equal(input.provider, "google");
        assert.equal(input.options.skipBrowserRedirect, true);
        if (mode === "start-error") return { data: { url: null }, error: Error(marker) };
        storage.setItem(keys.verifier, "synthetic-verifier");
        const url = new URL("/auth/v1/authorize", projectUrl);
        url.search = new URLSearchParams({
          provider: "google",
          redirect_to: input.options.redirectTo,
          code_challenge_method: "s256",
          code_challenge: "synthetic-challenge",
        }).toString();
        if (mode === "foreign-authorize") url.host = "evil.invalid";
        return { data: { url: url.href }, error: null };
      },
      exchangeCodeForSession: async () => {
        exchanges++;
        if (pause) await pause.promise;
        if (mode === "exchange-throw") throw Error(marker);
        if (mode === "exchange-error") return { data: { session: null }, error: Error(marker) };
        if (mode === "owner-changed-during-exchange") current = "other-owner";
        entries.set(keys.session, "synthetic-temporary-session");
        return {
          data: {
            session: { user, access_token: "synthetic-access", refresh_token: "synthetic-refresh" },
          },
          error: null,
        };
      },
    },
  };
  return {
    flow: createGoogleOAuthFlow(deps),
    entries,
    storage,
    deps,
    setOwner: (v) => {
      current = v;
    },
    block: () => {
      available = false;
    },
    leave: () => {
      callback = false;
    },
    expire: () => {
      timestamp += 600001;
    },
    hold: () => {
      pause = defer();
      return pause;
    },
    stats: () => ({ starts, exchanges, saves }),
  };
}
function clean(h) {
  for (const key of Object.values(keys)) assert(!h.entries.has(key));
  assert.equal(h.entries.get("unrelated-draft"), "keep");
  assert.equal(h.entries.get("main-auth"), "keep");
}
async function rejects(promise) {
  await assert.rejects(
    promise,
    (e) => !e.message.includes(marker) && e.message.includes("Google OAuth"),
  );
}
for (const mode of [
  "normal",
  "exchange-error",
  "exchange-throw",
  "save-error",
  "save-throw",
  "wrong-provider",
  "owner-changed-during-exchange",
]) {
  const h = harness(mode);
  const url = await h.flow.start("/offline-sync?from=native");
  assert.equal(new URL(url).pathname, "/auth/v1/authorize");
  const pending = h.flow.finish("synthetic-code");
  if (mode === "normal") assert.equal(await pending, "/offline-sync?from=native");
  else await rejects(pending);
  assert.equal(h.stats().exchanges, 1);
  assert.equal(h.stats().saves, ["normal", "save-error", "save-throw"].includes(mode) ? 1 : 0);
  await rejects(h.flow.finish("synthetic-code"));
  assert.equal(h.stats().exchanges, 1);
  clean(h);
}
for (const mode of [
  "cancel",
  "expired",
  "blocked",
  "wrong-tab",
  "owner-changed",
  "missing-verifier",
  "missing-code",
]) {
  const h = harness();
  await h.flow.start();
  if (mode === "expired") h.expire();
  if (mode === "blocked") h.block();
  if (mode === "wrong-tab") h.leave();
  if (mode === "owner-changed") h.setOwner("other-owner");
  if (mode === "missing-verifier") h.entries.delete(keys.verifier);
  await rejects(h.flow.finish(mode === "missing-code" ? "" : "synthetic-code", mode === "cancel"));
  assert.deepEqual(h.stats(), { starts: 1, exchanges: 0, saves: 0 });
  clean(h);
}
for (const mode of ["start-error", "foreign-authorize", "cleanup-denied"]) {
  const h = harness(mode);
  await rejects(h.flow.start());
  assert.equal(h.stats().saves, 0);
  clean(h);
}
{
  const h = harness();
  const [a, b] = await Promise.all([h.flow.start("//evil.invalid"), h.flow.start("/different")]);
  assert.equal(a, b);
  assert.equal(h.stats().starts, 1);
  const pause = h.hold();
  const first = h.flow.finish("synthetic-code");
  const second = h.flow.finish("synthetic-code");
  assert.equal(first, second);
  await rejects(h.flow.finish("different-code"));
  await rejects(h.flow.start());
  pause.resolve();
  assert.equal(await first, "/dives");
  assert.equal(h.stats().saves, 1);
  clean(h);
}
{
  const h = harness();
  await h.flow.start();
  h.entries.set(keys.transaction, "malformed");
  await rejects(h.flow.finish("synthetic-code"));
  clean(h);
}
console.log(
  "PASS: native_flow_start_exchange_save_failures_cancellation_expiry_owner_change_storage_denial_single_flight_replay_safe_return_and_scoped_cleanup",
);

// Installed SDK must generate the precise PKCE verifier format/key used above.
{
  const h = harness();
  let requests = 0;
  const client = createClient(projectUrl, "synthetic-public-key", {
    global: {
      fetch: async () => {
        requests++;
        throw Error("network forbidden");
      },
    },
    auth: {
      storage: h.storage,
      storageKey: keys.session,
      flowType: "pkce",
      detectSessionInUrl: false,
      autoRefreshToken: false,
      persistSession: true,
    },
  });
  const result = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: origin + "/oauth-callback", skipBrowserRedirect: true },
  });
  assert.equal(result.error, null);
  const url = new URL(result.data.url);
  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert(h.entries.get(keys.verifier));
  assert.equal(requests, 0);
  await client.auth.stopAutoRefresh();
}
{
  const options = [];
  const storage = {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
  const clients = load(
    "src/integrations/supabase/client.ts",
    {
      "@supabase/supabase-js": {
        createClient: (_url, _key, opts) => {
          options.push(opts.auth);
          return { auth: {} };
        },
      },
      "@/lib/tab-auth-storage": { getTabAuthStorage: () => storage },
      "@/lib/google-oauth-keys": keysModule,
    },
    { window: { localStorage: { removeItem() {} } } },
  );
  void clients.supabase.auth;
  void clients.googleOAuth.auth;
  assert.equal(options[0].flowType, undefined);
  assert.equal(options[0].detectSessionInUrl, undefined);
  assert.equal(options[0].autoRefreshToken, true);
  assert.equal(options[1].flowType, "pkce");
  assert.equal(options[1].storageKey, keys.session);
  assert.equal(options[1].detectSessionInUrl, false);
  assert.equal(options[1].autoRefreshToken, false);
  assert.equal(options[1].storage, storage);
}
{
  let native = 0,
    broker = 0;
  const adapter = load("src/integrations/lovable/index.ts", {
    "@lovable.dev/cloud-auth-js": {
      createLovableAuth: () => ({
        signInWithOAuth: () => {
          broker++;
          return { redirected: true, error: null };
        },
      }),
    },
    "@/lib/google-oauth": {
      beginGoogleOAuth: async (value) => {
        assert.equal(value, origin + "/offline-sync");
        native++;
        return { redirected: true, error: null };
      },
    },
    "@/lib/oauth-session": sessionModule,
  });
  assert.equal(
    (
      await adapter.lovable.auth.signInWithOAuth("google", {
        redirect_uri: origin + "/offline-sync",
      })
    ).redirected,
    true,
  );
  assert.equal(native, 1);
  assert.equal(broker, 0);
}
console.log(
  "PASS: installed_SDK_PKCE_url_and_verifier_separate_tab_client_preserves_email_reset_and_google_bypasses_missing_broker",
);

// Mount the actual callback component with effect replay; no DOM/browser/network.
for (const language of ["en", "zh"])
  for (const kind of ["normal", "cancel", "duplicate", "fragment", "failure"]) {
    let effect,
      cursor = 0,
      finishCalls = 0,
      captured,
      replaced = [],
      stripped = false;
    const cells = [],
      elements = [];
    const jsx = (type, props) => {
      const node = { type, props };
      elements.push(node);
      return node;
    };
    const react = {
      useEffect: (fn) => {
        effect = fn;
      },
      useRef: (initial) => {
        const index = cursor++;
        return (cells[index] ??= { current: initial });
      },
      useState: (initial) => {
        const index = cursor++;
        if (!(index in cells)) cells[index] = initial;
        return [
          cells[index],
          (value) => {
            cells[index] = value;
          },
        ];
      },
    };
    const location = {
      search:
        kind === "cancel"
          ? "?error=access_denied"
          : kind === "duplicate"
            ? "?code=a&code=b"
            : "?code=synthetic-code",
      hash: kind === "fragment" ? "#access_token=synthetic-token" : "",
      replace: (value) => replaced.push(value),
    };
    const route = load(
      "src/routes/oauth-callback.tsx",
      {
        react,
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "@tanstack/react-router": { createFileRoute: () => (config) => config, Link: "link" },
        "@/i18n/LanguageProvider": { useLanguage: () => ({ language }) },
        "@/lib/google-oauth": {
          finishGoogleOAuth: async (code, error) => {
            finishCalls++;
            captured = { code, error };
            assert(stripped);
            if (kind !== "normal") throw Error(marker);
            return "/offline-sync";
          },
        },
      },
      {
        window: {
          location,
          history: {
            state: null,
            replaceState: (_state, _title, value) => {
              assert.equal(value, "/oauth-callback");
              stripped = true;
              location.search = "";
              location.hash = "";
            },
          },
        },
      },
    ).Route;
    route.component();
    const cleanup = effect();
    cleanup();
    effect();
    await new Promise((resolve) => setImmediate(resolve));
    cursor = 0;
    elements.length = 0;
    route.component();
    assert.equal(finishCalls, 1);
    assert.equal(captured.error, ["cancel", "duplicate", "fragment"].includes(kind));
    if (kind === "normal") assert.deepEqual(replaced, ["/offline-sync"]);
    else {
      assert.equal(replaced.length, 0);
      assert(elements.some((n) => n.props.role === "alert"));
      assert(elements.some((n) => n.type === "link" && n.props.to === "/auth"));
    }
    assert(!JSON.stringify(elements).includes(marker));
    assert(!JSON.stringify(elements).includes("synthetic-code"));
  }
console.log(
  "PASS: actual_callback_bilingual_error_back_link_strips_code_and_fragments_before_exchange_and_effect_replay_completes_once",
);
console.log(
  "AUDIT: local_synthetic_only_no_real_authorization_accounts_emails_storage_deletion_or_network_requests",
);
