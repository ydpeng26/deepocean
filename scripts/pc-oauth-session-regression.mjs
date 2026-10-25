import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";

function load(file, require, globals = {}) {
  const module = { exports: {} };
  const source = fs
    .readFileSync(new URL("../" + file, import.meta.url), "utf8")
    .replaceAll("import.meta.env", "({PROD:false})");
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    { module, exports: module.exports, require, URL, console: { error() {} }, ...globals },
  );
  return module.exports;
}
const policy = load("src/lib/oauth-session.ts", () => ({}));
const returnPolicy = load("src/lib/auth-return.ts", () => ({}));
const tokens = { access_token: "synthetic-access", refresh_token: "synthetic-refresh" };
const success = { tokens, error: null };
const saved = { data: { session: { user: { id: "synthetic-user" } } }, error: null };
const marker = "SYNTHETIC-NOT-A-SECRET";
for (const mode of [
  "returned-error",
  "thrown-error",
  "empty-session",
  "empty-user",
  "blank-user",
  "missing-data",
  "undefined-result",
  "normal",
]) {
  let calls = 0;
  const result = await policy.completeOAuthSession(success, async (input) => {
    calls++;
    assert.equal(input, tokens);
    if (mode === "thrown-error") throw Error(marker);
    return mode === "returned-error"
      ? { data: { session: null }, error: Error(marker) }
      : mode === "empty-session"
        ? { data: { session: null }, error: null }
        : mode === "empty-user"
          ? { data: { session: {} }, error: null }
          : mode === "blank-user"
            ? { data: { session: { user: { id: " " } } }, error: null }
            : mode === "missing-data"
              ? { error: null }
              : mode === "undefined-result"
                ? undefined
                : saved;
  });
  assert.equal(calls, 1);
  if (mode === "normal") assert.equal(result, success);
  else {
    assert(result.error);
    assert(!result.error.message.includes(marker));
    assert.equal(result.tokens, undefined);
  }
}
for (const value of [
  null,
  undefined,
  {},
  { tokens: {} },
  { tokens: { access_token: "", refresh_token: "x" } },
  { tokens: { access_token: "x", refresh_token: " " } },
]) {
  const result = await policy.completeOAuthSession(value, async () => {
    throw Error("must not save invalid tokens");
  });
  assert(result.error);
}
for (const result of [
  { redirected: true, error: null },
  { error: Error("synthetic provider cancellation") },
]) {
  let calls = 0;
  assert.equal(
    await policy.completeOAuthSession(result, async () => {
      calls++;
    }),
    result,
  );
  assert.equal(calls, 0);
}
console.log(
  "PASS: actual_completion_checks_returned_and_thrown_session_failures_missing_tokens_session_user_and_preserves_provider_redirect_without_exposing_credentials",
);

const jsx = (type, props) => ({ type, props });
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function harness({ language = "en", mode = "returned-error", blocked = false, next } = {}) {
  let cursor = 0,
    providerCalls = 0,
    saveCalls = 0,
    navigations = [];
  const cells = [],
    toasts = [];
  let pending;
  const adapter = load("src/integrations/lovable/index.ts", (name) =>
    name === "@lovable.dev/cloud-auth-js"
      ? {
          createLovableAuth: () => ({
            signInWithOAuth: async () => {
              providerCalls++;
              if (pending) await pending.promise;
              if (mode === "provider-throw") throw Error(marker);
              return mode === "redirected"
                ? { redirected: true, error: null }
                : mode === "provider-error"
                  ? { error: Error(marker) }
                  : mode === "missing-tokens"
                    ? { error: null }
                    : success;
            },
          }),
        }
      : name === "@/lib/oauth-session"
        ? policy
        : {
            supabase: {
              auth: {
                setSession: async () => {
                  saveCalls++;
                  if (mode === "thrown-error") throw Error(marker);
                  return mode === "returned-error"
                    ? { data: { session: null }, error: Error(marker) }
                    : mode === "empty-session"
                      ? { data: { session: null }, error: null }
                      : saved;
                },
              },
            },
          },
  ).lovable;
  const react = {
    useEffect() {},
    useRef(value) {
      const i = cursor++;
      return (cells[i] ??= { current: value });
    },
    useState(value) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = value;
      return [
        cells[i],
        (value) => {
          cells[i] = typeof value === "function" ? value(cells[i]) : value;
        },
      ];
    },
  };
  const location = {
    origin: "https://example.invalid",
    set href(value) {
      navigations.push(value);
    },
  };
  const route = load(
    "src/routes/auth.tsx",
    (name) =>
      name === "react"
        ? react
        : name === "react/jsx-runtime"
          ? { jsx, jsxs: jsx }
          : name === "@tanstack/react-router"
            ? {
                createFileRoute: () => (options) => ({ ...options, useSearch: () => ({ next }) }),
                useNavigate: () => (options) => navigations.push(options.to),
              }
            : name === "@/i18n/LanguageProvider"
              ? { useLanguage: () => ({ language }) }
              : name === "@/i18n/liveCopy"
                ? { useLiveCopy() {} }
                : name === "@/hooks/useAuthStorageStatus"
                  ? { useAuthStorageStatus: () => (blocked ? "blocked" : "available") }
                  : name === "@/lib/tab-auth-storage"
                    ? { authStorageAvailable: () => !blocked }
                    : name === "@/integrations/lovable"
                      ? { lovable: adapter }
                      : name === "@/integrations/supabase/client"
                        ? { supabase: { auth: {} } }
                        : name === "sonner"
                          ? {
                              toast: {
                                dismiss() {},
                                error(message) {
                                  toasts.push(message);
                                },
                                success() {},
                              },
                            }
                          : name === "@/lib/password-recovery"
                            ? { passwordRecoveryEnabled: true }
                            : name === "@/lib/auth-return"
                              ? returnPolicy
                              : {},
    { window: { location } },
  ).Route;
  const render = () => {
    cursor = 0;
    return nodes(route.component());
  };
  const button = () => render().find((n) => n.props?.className === "do-auth-google");
  return {
    button,
    toasts,
    navigations,
    setMode(value) {
      mode = value;
    },
    setBlocked(value) {
      blocked = value;
    },
    defer() {
      pending = deferred();
      return pending;
    },
    get providerCalls() {
      return providerCalls;
    },
    get saveCalls() {
      return saveCalls;
    },
  };
}
for (const language of ["en", "zh-CN"])
  for (const mode of [
    "returned-error",
    "thrown-error",
    "empty-session",
    "missing-tokens",
    "provider-error",
    "provider-throw",
  ]) {
    const h = harness({ language, mode });
    await h.button().props.onClick();
    assert.equal(h.navigations.length, 0);
    assert.equal(h.toasts.length, 1);
    assert.equal(
      h.toasts[0],
      language === "en" ? "Google sign-in failed. Please try again" : "Google 登录失败，请重试",
    );
    assert.equal(h.button().props.disabled, false);
    h.setMode("normal");
    await h.button().props.onClick();
    assert.equal(h.navigations.length, 1);
    assert.equal(h.navigations[0], "/dives");
    assert.equal(h.button().props.disabled, false);
  }
console.log(
  "PASS: actual_adapter_and_auth_UI_failures_do_not_navigate_bilingual_safe_message_unlock_and_successful_retry",
);
const h = harness({ mode: "normal", next: "/offline-sync" }),
  gate = h.defer();
const click = h.button().props.onClick;
const first = click(),
  second = click();
assert.equal(h.providerCalls, 1);
assert.equal(h.saveCalls, 0);
assert.equal(h.button().props.disabled, true);
gate.resolve();
await first;
await second;
assert.equal(h.saveCalls, 1);
assert.deepEqual(h.navigations, ["/offline-sync"]);
const redirected = harness({ mode: "redirected" });
await redirected.button().props.onClick();
assert.equal(redirected.saveCalls, 0);
assert.equal(redirected.navigations.length, 0);
assert.equal(redirected.button().props.disabled, true);
await redirected.button().props.onClick();
assert.equal(redirected.providerCalls, 1);
const blocked = harness({ blocked: true });
await blocked.button().props.onClick();
assert.equal(blocked.providerCalls, 0);
assert.equal(blocked.saveCalls, 0);
const external = harness({ mode: "normal", next: "/\\example.invalid" });
await external.button().props.onClick();
assert.deepEqual(external.navigations, ["/dives"]);
console.log(
  "PASS: synchronous_double_activation_one_provider_and_session_call_redirect_preserved_storage_denial_guard_and_same_origin_return_policy",
);
console.log(
  "AUDIT: local_actual_source_models_only; no_network_real_OAuth_accounts_credentials_mail_storage_clear_or_deployment; recovery_browser_acceptance_pending",
);
