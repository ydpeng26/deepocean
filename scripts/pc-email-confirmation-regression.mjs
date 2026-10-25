// Actual source in deterministic no-network models. No real links/users/mail.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
function load(file, deps = {}, globals = {}) {
  const module = { exports: {} };
  const source = fs
    .readFileSync(new URL("../" + file, import.meta.url), "utf8")
    .replaceAll(
      "import.meta.env",
      "({VITE_SUPABASE_URL:'https://synthetic.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-public'})",
    );
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => deps[name] ?? {},
      URL,
      URLSearchParams,
      queueMicrotask,
      ...globals,
    },
  );
  return module.exports;
}
const flowModule = load("src/lib/email-confirmation-flow.ts");
const keyModule = load("src/lib/email-confirmation-keys.ts");
const googleKeys = load("src/lib/google-oauth-keys.ts");
const returns = load("src/lib/auth-return.ts");
const marker = "SYNTHETIC_PRIVATE_ERROR";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
for (const [search, hash] of [
  ["", ""],
  ["?error=", "#access_token=a&refresh_token=b"],
  ["?token_hash=a&token_hash=b", ""],
  ["?code=a&token_hash=b", ""],
  ["?code=", ""],
  ["?token_hash=a", "#access_token=b&refresh_token=c"],
  ["?access_token=a&refresh_token=b", ""],
  ["", "#access_token=a"],
  ["", "#access_token=a&refresh_token=b&type=recovery"],
  ["?type=invite&token_hash=a", ""],
  ["?error_description=synthetic", ""],
  ["", "#token_hash=a"],
  ["?code=a&code=b", ""],
])
  assert.equal(flowModule.emailConfirmationInput(search, hash).kind, "invalid");
assert.equal(
  flowModule.emailConfirmationInput("?token_hash=synthetic&type=signup", "").kind,
  "hash",
);
assert.equal(flowModule.emailConfirmationInput("?code=synthetic", "").kind, "code");
assert.equal(
  flowModule.emailConfirmationInput(
    "",
    "#access_token=synthetic-a&refresh_token=synthetic-b&type=signup",
  ).kind,
  "tokens",
);

function harness(mode = "normal") {
  let owner = "old-owner",
    callback,
    live = true,
    available = true,
    invalidations = 0,
    saves = 0,
    verifies = 0,
    exchanges = 0,
    tokenSaves = 0,
    userReads = 0,
    cleaned = 0,
    clears = 0,
    pause;
  const user = { id: "verified-owner", email_confirmed_at: "2026-10-25T00:00:00Z" };
  const session = { user, access_token: "synthetic-access", refresh_token: "synthetic-refresh" };
  const result = () => ({ data: { session }, error: null });
  async function verify() {
    if (pause) await pause.promise;
    if (mode === "verify-throws") throw Error(marker);
    if (mode === "verify-error") return { data: { session: null }, error: Error(marker) };
    if (mode === "verify-null") return { data: { session: null }, error: null };
    if (mode === "session-and-error") return { data: { session }, error: Error(marker) };
    if (mode === "owner-change-no-event") owner = "other-owner";
    return result();
  }
  const deps = {
    main: {
      getSession: async () => {
        if (mode === "session-throws") throw Error(marker);
        return {
          data: { session: owner ? { user: { id: owner } } : null },
          error: mode === "session-error" ? Error(marker) : null,
        };
      },
      onAuthStateChange: (fn) => {
        callback = fn;
        return {
          data: {
            subscription: {
              unsubscribe() {
                callback = undefined;
              },
            },
          },
        };
      },
      setSession: async () => {
        saves++;
        if (mode === "save-throws") throw Error(marker);
        if (mode === "save-error") return { data: { session: null }, error: Error(marker) };
        owner = mode === "save-mismatch" ? "other-owner" : user.id;
        callback?.("SIGNED_IN", { user: { id: owner } });
        return { data: { session: { user: { id: owner } } }, error: null };
      },
    },
    confirmation: {
      verifyOtp: async (input) => {
        verifies++;
        assert.equal(input.type, "signup");
        return verify();
      },
      exchangeCodeForSession: async () => {
        exchanges++;
        return verify();
      },
      setSession: async () => {
        tokenSaves++;
        return verify();
      },
      getUser: async (token) => {
        userReads++;
        assert.equal(token, session.access_token);
        if (mode === "user-throws") throw Error(marker);
        return {
          data: {
            user:
              mode === "user-mismatch"
                ? { ...user, id: "other-owner" }
                : mode === "unconfirmed"
                  ? { ...user, email_confirmed_at: null }
                  : user,
          },
          error: mode === "user-error" ? Error(marker) : null,
        };
      },
      stopAutoRefresh: async () => {},
    },
    active: () => live,
    available: () => available,
    invalidate: () => {
      invalidations++;
    },
    cleanup: () => {
      cleaned++;
      if (mode === "cleanup-throws") throw Error(marker);
    },
    prepareCode: () => {
      if (mode === "missing-verifier") throw Error(marker);
      return () => {
        clears++;
      };
    },
  };
  const flow = flowModule.createEmailConfirmationFlow(deps);
  return {
    flow,
    deps,
    emit: (event, id) => {
      owner = id;
      callback?.(event, id ? { user: { id } } : null);
    },
    hold: () => {
      pause = defer();
      return pause;
    },
    leave: () => {
      live = false;
    },
    block: () => {
      available = false;
    },
    stats: () => ({
      owner,
      saves,
      verifies,
      exchanges,
      tokenSaves,
      userReads,
      cleaned,
      clears,
      invalidations,
    }),
  };
}
const hashInput = { kind: "hash", value: "synthetic-token-hash" };
async function rejects(promise) {
  await assert.rejects(
    promise,
    (error) => !error.message.includes(marker) && error.message.includes("Email confirmation"),
  );
}
for (const input of [
  hashInput,
  { kind: "code", value: "synthetic-code" },
  { kind: "tokens", access_token: "synthetic-access", refresh_token: "synthetic-refresh" },
]) {
  const h = harness();
  assert.equal(await h.flow.run(input), "verified-owner");
  assert.equal(h.stats().saves, 1);
  assert.equal(h.stats().userReads, 1);
  assert.equal(await h.flow.matches(), true);
  assert.equal(h.stats().clears, input.kind === "code" ? 1 : 0);
  h.emit("SIGNED_IN", "other-owner");
  h.emit("SIGNED_IN", "verified-owner");
  assert.equal(await h.flow.matches(), false);
  assert.equal(h.stats().invalidations, 1);
}
for (const mode of [
  "verify-throws",
  "verify-error",
  "verify-null",
  "session-and-error",
  "session-throws",
  "session-error",
  "user-throws",
  "user-error",
  "user-mismatch",
  "unconfirmed",
  "owner-change-no-event",
  "cleanup-throws",
]) {
  const h = harness(mode);
  await rejects(h.flow.run(hashInput));
  assert.equal(h.stats().saves, 0);
  assert.equal(await h.flow.matches(), false);
}
for (const mode of ["save-throws", "save-error", "save-mismatch"]) {
  const h = harness(mode);
  await rejects(h.flow.run(hashInput));
  assert.equal(h.stats().saves, 1);
  assert.equal(await h.flow.matches(), false);
}
{
  const h = harness("missing-verifier");
  await rejects(h.flow.run({ kind: "code", value: "synthetic" }));
  assert.equal(h.stats().exchanges, 0);
}
{
  const h = harness();
  await rejects(h.flow.run({ kind: "invalid" }));
  assert.equal(h.stats().verifies, 0);
  assert.equal(h.stats().saves, 0);
}
for (const mode of ["old-session", "ABA", "logout", "unmount", "blocked", "cancel"]) {
  const h = harness("verify-error"),
    pause = h.hold();
  const pending = h.flow.run(hashInput);
  await tick();
  if (mode === "old-session") h.emit("INITIAL_SESSION", "old-owner");
  if (mode === "ABA") {
    h.emit("SIGNED_IN", "other-owner");
    h.emit("SIGNED_IN", "old-owner");
  }
  if (mode === "logout") h.emit("SIGNED_OUT", null);
  if (mode === "unmount") h.leave();
  if (mode === "blocked") h.block();
  if (mode === "cancel") h.flow.cancel();
  assert.equal(await h.flow.matches(), false);
  pause.resolve();
  await rejects(pending);
  assert.equal(h.stats().saves, 0);
}
for (const mode of ["unmount", "cancel", "ABA", "blocked"]) {
  const h = harness(),
    pause = h.hold();
  const pending = h.flow.run(hashInput);
  await tick();
  if (mode === "unmount") h.leave();
  if (mode === "cancel") h.flow.cancel();
  if (mode === "blocked") h.block();
  if (mode === "ABA") {
    h.emit("SIGNED_IN", "other-owner");
    h.emit("SIGNED_IN", "old-owner");
  }
  pause.resolve();
  await rejects(pending);
  assert.equal(h.stats().saves, 0);
}
console.log(
  "PASS: actual_confirmation_policy_all_three_modes_invalid_input_errors_unconfirmed_or_wrong_user_old_session_owner_changes_cancellation_and_late_results_never_report_or_commit_success",
);

// Browser wiring copies/consumes only this code's exact main verifier and only
// cleans its own three temporary keys, retaining newer verifiers and drafts.
{
  const keys = keyModule.emailConfirmationKeys("https://synthetic.supabase.co"),
    values = new Map([
      [keys.mainVerifier, "synthetic-original"],
      ["draft", "keep"],
      ["main-auth", "keep"],
    ]);
  let captured;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const wiring = load(
    "src/lib/email-confirmation.ts",
    {
      "@/integrations/supabase/client": {
        supabase: { auth: {} },
        emailConfirmation: { auth: {} },
        getSupabaseProjectUrl: () => "https://synthetic.supabase.co",
      },
      "@/lib/tab-auth-storage": {
        getTabAuthStorage: () => storage,
        authStorageAvailable: () => true,
      },
      "@/lib/email-confirmation-keys": keyModule,
      "@/lib/email-confirmation-flow": {
        createEmailConfirmationFlow: (deps) => {
          captured = deps;
          return {};
        },
      },
    },
    { window: { sessionStorage: storage } },
  );
  wiring.createBrowserEmailConfirmation(
    () => true,
    () => {},
  );
  const clear = captured.prepareCode();
  assert.equal(values.get(keys.verifier), "synthetic-original");
  values.set(keys.mainVerifier, "synthetic-newer");
  clear();
  assert.equal(values.get(keys.mainVerifier), "synthetic-newer");
  captured.prepareCode()();
  assert(!values.has(keys.mainVerifier));
  captured.cleanup();
  assert(!values.has(keys.verifier));
  assert.equal(values.get("draft"), "keep");
  assert.equal(values.get("main-auth"), "keep");
}
for (const path of [
  "/auth",
  "/reset-password",
  "/oauth-callback",
  "/auth-confirmed",
  "/auth-confirmed/",
]) {
  const options = [];
  const clients = load(
    "src/integrations/supabase/client.ts",
    {
      "@supabase/supabase-js": {
        createClient: (_url, _key, opts) => {
          options.push(opts.auth);
          return { auth: {} };
        },
      },
      "@/lib/tab-auth-storage": { getTabAuthStorage: () => ({}) },
      "@/lib/email-confirmation-keys": keyModule,
      "@/lib/google-oauth-keys": googleKeys,
    },
    { window: { location: { pathname: path }, localStorage: { removeItem() {} } } },
  );
  void clients.supabase.auth;
  void clients.emailConfirmation.auth;
  void clients.googleOAuth.auth;
  assert.equal(
    options[0].detectSessionInUrl,
    path.startsWith("/auth-confirmed") || path === "/reset-password" ? false : undefined,
  );
  assert.equal(options[0].autoRefreshToken, true);
  assert.equal(options[1].storageKey, "supdiver-email-confirmation-synthetic");
  assert.equal(options[1].detectSessionInUrl, false);
  assert.equal(options[1].persistSession, true);
  assert.equal(options[1].autoRefreshToken, false);
  assert.equal(options[2].storageKey, "supdiver-google-oauth-synthetic");
}
console.log(
  "PASS: actual_client_avoids_double_URL_exchange_on_explicit_confirmation_and_reset_routes_preserves_Google_behavior_and_exact_verifier_cleanup",
);

for (const mode of ["cancelled", "changed-owner", "newer-refreshed-token"]) {
  const { createTabAuthStorage } = load("src/lib/tab-auth-storage.ts");
  const keys = keyModule.emailConfirmationKeys("https://synthetic.supabase.co");
  const entries = new Map([
    [keys.mainSession, JSON.stringify({ user: { id: "old-owner" } })],
    ["draft", "keep"],
  ]);
  const raw = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const guarded = createTabAuthStorage(() => raw),
    gate = defer();
  let captured,
    current = true;
  const wiring = load(
    "src/lib/email-confirmation.ts",
    {
      "@/integrations/supabase/client": {
        supabase: {
          auth: {
            setSession: async () => {
              await gate.promise;
              guarded.storage.setItem(
                keys.mainSession,
                JSON.stringify({
                  access_token:
                    mode === "newer-refreshed-token"
                      ? "synthetic-new-refreshed-token"
                      : "synthetic-access",
                  user: { id: "verified-owner" },
                }),
              );
              return { data: { session: { user: { id: "verified-owner" } } }, error: null };
            },
          },
        },
        emailConfirmation: { auth: {} },
        getSupabaseProjectUrl: () => "https://synthetic.supabase.co",
      },
      "@/lib/tab-auth-storage": {
        getTabAuthStorage: () => guarded.storage,
        authStorageAvailable: () => guarded.getSnapshot() === "available",
        guardTabAuthWrite: (guard) => guarded.guardWrite(guard),
      },
      "@/lib/email-confirmation-keys": keyModule,
      "@/lib/email-confirmation-flow": {
        createEmailConfirmationFlow: (deps) => {
          captured = deps;
          return {};
        },
      },
    },
    { window: { sessionStorage: raw } },
  );
  wiring.createBrowserEmailConfirmation(
    () => current,
    () => {},
  );
  const pending = captured.saveBoundSession(
    { access_token: "synthetic-access", refresh_token: "synthetic-refresh" },
    () => current,
    "old-owner",
    "verified-owner",
  );
  if (mode === "changed-owner")
    raw.setItem(keys.mainSession, JSON.stringify({ user: { id: "other-owner" } }));
  else current = false;
  guarded.storage.setItem("draft", "keep");
  gate.resolve();
  await assert.rejects(pending);
  assert.equal(
    JSON.parse(raw.getItem(keys.mainSession)).user.id,
    mode === "changed-owner" ? "other-owner" : "old-owner",
  );
  assert.equal(guarded.getSnapshot(), "available");
  assert.equal(raw.getItem("draft"), "keep");
  // The guard is operation-scoped, and is always released after the SDK settles.
  guarded.storage.setItem(keys.mainSession, JSON.stringify({ user: { id: "verified-owner" } }));
}
console.log(
  "PASS: actual_storage_write_guard_blocks_late_confirmation_or_refreshed_result_after_cancel_or_owner_switch_without_blocking_browser_storage_or_unrelated_writes",
);
{
  const pending = defer();
  let starts = 0;
  const wiring = load("src/lib/email-confirmation.ts", {
    "@/integrations/supabase/client": {
      supabase: { auth: {} },
      emailConfirmation: { auth: {} },
      getSupabaseProjectUrl: () => "https://synthetic.supabase.co",
    },
    "@/lib/tab-auth-storage": { getTabAuthStorage: () => ({}), authStorageAvailable: () => true },
    "@/lib/email-confirmation-keys": keyModule,
    "@/lib/email-confirmation-flow": {
      createEmailConfirmationFlow: () => ({
        run: async () => {
          starts++;
          await pending.promise;
          return "verified-owner";
        },
        cancel() {},
        matches: async () => false,
      }),
    },
  });
  const first = wiring.createBrowserEmailConfirmation(
    () => true,
    () => {},
  );
  const second = wiring.createBrowserEmailConfirmation(
    () => true,
    () => {},
  );
  const running = first.run(hashInput);
  first.cancel();
  await assert.rejects(second.run(hashInput));
  assert.equal(starts, 1);
  pending.resolve();
  await running;
  await second.run(hashInput);
  assert.equal(starts, 2);
}

const jsx = (type, props) => ({ type, props });
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
function ui(language = "en", mode = "normal") {
  let cursor = 0,
    mounted = true,
    writesAfterUnmount = 0,
    starts = 0,
    creates = 0,
    matches = 0,
    cancels = 0,
    invalidator,
    stripped = false;
  const cells = [],
    effects = [],
    cleanups = [],
    timers = new Map(),
    navigation = [],
    pending = defer(),
    matchPause = defer();
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = value;
      return [
        cells[i],
        (value) => {
          if (!mounted) writesAfterUnmount++;
          cells[i] = value;
        },
      ];
    },
    useRef(value) {
      const i = cursor++;
      return (cells[i] ??= { current: value });
    },
    useEffect(fn) {
      const i = cursor++;
      if (!(i in cells)) {
        cells[i] = true;
        effects.push(fn);
      }
    },
  };
  const location = {
    search: "?token_hash=synthetic&next=/offline-sync",
    hash: "",
    set href(value) {
      navigation.push(value);
    },
  };
  const route = load(
    "src/routes/auth-confirmed.tsx",
    {
      react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@tanstack/react-router": {
        createFileRoute: () => (config) => ({
          ...config,
          useSearch: () => ({ next: "/offline-sync" }),
        }),
        Link: "link",
        useNavigate: () => (value) => {
          navigation.push(value.to);
        },
      },
      "@/i18n/LanguageProvider": { useLanguage: () => ({ language }) },
      "@/lib/auth-return": returns,
      "@/lib/email-confirmation-flow": flowModule,
      "@/lib/email-confirmation": {
        createBrowserEmailConfirmation: (_active, invalidate) => {
          creates++;
          assert(stripped);
          invalidator = invalidate;
          if (mode === "factory-throws") throw Error(marker);
          return {
            run: async (input) => {
              starts++;
              assert.equal(input.kind, "hash");
              if (mode === "throws") throw Error(marker);
              await pending.promise;
              return "verified-owner";
            },
            matches: async () => {
              matches++;
              if (mode === "match-pending") await matchPause.promise;
              return true;
            },
            cancel: () => {
              cancels++;
            },
          };
        },
      },
    },
    {
      document: { title: "" },
      window: {
        location,
        history: {
          state: null,
          replaceState: () => {
            if (mode === "scrub-throws") throw Error(marker);
            stripped = true;
            location.search = "";
          },
        },
        setTimeout: (fn) => {
          const id = timers.size + 1;
          timers.set(id, fn);
          return id;
        },
        clearTimeout: (id) => timers.delete(id),
      },
    },
  ).Route;
  const render = () => {
    cursor = 0;
    return route.component();
  };
  render();
  effects.forEach((fn) => cleanups.push(fn()));
  return {
    render,
    pending,
    matchPause,
    replay: () => {
      cleanups.forEach((fn) => fn?.());
      cleanups.length = 0;
      effects.forEach((fn) => cleanups.push(fn()));
    },
    invalidate: () => invalidator(),
    timeout: () => [...timers.values()].forEach((fn) => fn()),
    unmount: () => {
      cleanups.forEach((fn) => fn?.());
      mounted = false;
    },
    stats: () => ({ starts, creates, matches, cancels, writesAfterUnmount, navigation }),
  };
}
for (const language of ["en", "zh-CN"]) {
  for (const mode of [
    "normal",
    "throws",
    "factory-throws",
    "scrub-throws",
    "timeout",
    "unmount",
    "invalidated",
  ]) {
    const h = ui(language, mode);
    h.replay();
    await tick();
    if (mode === "timeout") h.timeout();
    if (mode === "unmount") h.unmount();
    if (mode === "invalidated") h.invalidate();
    h.pending.resolve();
    await tick();
    if (mode === "normal") {
      const button = nodes(h.render()).find((n) => n.type === "button");
      assert(button);
      await button.props.onClick();
      assert.deepEqual(h.stats().navigation, ["/offline-sync"]);
    } else if (mode !== "unmount") {
      const tree = nodes(h.render());
      assert(
        tree.some(
          (n) =>
            n.type === "h1" &&
            n.props.children ===
              (language === "en"
                ? "This confirmation link is invalid or expired"
                : "验证链接无效或已过期"),
        ),
      );
      assert(!tree.some((n) => n.type === "button"));
      assert(!JSON.stringify(tree).includes(marker));
    }
    assert.equal(h.stats().creates, mode === "scrub-throws" ? 0 : 1);
    assert.equal(h.stats().starts, ["factory-throws", "scrub-throws"].includes(mode) ? 0 : 1);
    assert.equal(h.stats().writesAfterUnmount, 0);
  }
}
{
  const h = ui("en", "match-pending");
  await tick();
  h.pending.resolve();
  await tick();
  const button = nodes(h.render()).find((n) => n.type === "button");
  const first = button.props.onClick();
  const second = button.props.onClick();
  h.invalidate();
  h.matchPause.resolve();
  await Promise.all([first, second]);
  assert.equal(h.stats().matches, 1);
  assert.equal(h.stats().navigation.length, 0);
}
console.log(
  "PASS: actual_bilingual_confirmation_UI_handles_sync_async_failure_timeout_unmount_effect_replay_and_stale_or_duplicate_enter_without_leaking_link_material",
);
console.log(
  "AUDIT: local_synthetic_only_no_browser_network_real_confirmation_link_account_mail_backend_or_deployment_changes",
);
