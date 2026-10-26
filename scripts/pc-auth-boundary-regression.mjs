// Actual modules/components in deterministic local models. No real auth/network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const read = (file) => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
function load(file, require, globals = {}) {
  const source = read(file).replaceAll(
    "import.meta.env",
    '({PROD:false,VITE_SUPABASE_URL:"https://esovqvampbrhuhamkfcs.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"synthetic-public-key"})',
  );
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require,
      URL,
      URLSearchParams,
      AbortSignal,
      fetch() {
        throw Error("Network forbidden");
      },
      ...globals,
    },
  );
  return module.exports;
}
const routeStub = { createFileRoute: () => (options) => options, Link: "Link" };
const returns = load("src/lib/auth-return.ts", () => ({}));
const recoveryFlow = load("src/lib/password-recovery-flow.ts", () => ({}));
const rejected = [
  "https://outside.example",
  "//outside.example",
  "/\\outside.example",
  "/\n/outside.example",
  "/\t/outside.example",
  "/a/..//outside.example",
  "javascript:alert(1)",
  "",
  null,
  123,
  " /dives",
];
for (const file of ["src/routes/auth.tsx", "src/routes/auth-confirmed.tsx"]) {
  const { Route } = load(file, (name) =>
    name === "@tanstack/react-router" ? routeStub : name === "@/lib/auth-return" ? returns : {},
  );
  for (const next of rejected) assert.equal(Route.validateSearch({ next }).next, undefined, file);
  for (const next of [
    "/offline-sync",
    "/dives?country=Indonesia#recent",
    "/forum?search=https%3A%2F%2Fexample.invalid",
    "/潜水",
  ]) {
    const accepted = Route.validateSearch({ next }).next;
    assert(accepted);
    assert.equal(new URL(accepted, "https://test.invalid").origin, "https://test.invalid");
  }
}
console.log(
  "PASS: actual_shared_return_policy_and_both_validators_reject_normalized_external_controls_backslashes_preserve_internal_query_hash_unicode",
);
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
const tick = () => new Promise((r) => setImmediate(r));
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function harness(options = {}) {
  let cursor = 0,
    owner = "A",
    callback,
    unmounted = false;
  const cells = [],
    effects = [],
    effectFns = [],
    cleanups = [],
    writes = [],
    updates = [],
    events = [],
    signouts = [];
  const react = {
    useState(v) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = typeof v === "function" ? v() : v;
      return [
        cells[i],
        (v) => {
          if (unmounted) writes.push(i);
          cells[i] = typeof v === "function" ? v(cells[i]) : v;
        },
      ];
    },
    useRef(v) {
      const i = cursor++;
      return (cells[i] ??= { current: v });
    },
    useEffect(fn) {
      const i = cursor++;
      if (!(i in cells)) {
        cells[i] = true;
        effects.push(fn);
        effectFns.push(fn);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const session = () => (owner ? { user: { id: owner }, access_token: "token-" + owner } : null);
  const auth = {
    onAuthStateChange(fn) {
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
    async verifyOtp() {
      events.push("verify");
      if (options.verifyGate) await options.verifyGate.promise;
      return {
        error: options.expired ? Error("Synthetic expired") : null,
        data: {
          session: options.expired
            ? null
            : { user: { id: "A" }, access_token: "token-A", refresh_token: "refresh-A" },
        },
      };
    },
    async exchangeCodeForSession() {
      return auth.verifyOtp();
    },
    async setSession() {
      owner = "A";
      callback?.("SIGNED_IN", session());
      return { error: null, data: { session: session() } };
    },
    stopAutoRefresh() {},
    async getSession() {
      return { error: null, data: { session: session() } };
    },
    async getUser(token) {
      assert.equal(token, "token-A");
      if (options.checkGate && events.includes("submit")) await options.checkGate.promise;
      return {
        error: options.serverError ? Error("Synthetic") : null,
        data: { user: { id: "A" } },
      };
    },
    async signOut() {
      signouts.push(owner);
      owner = null;
      callback?.("SIGNED_OUT", null);
      return { error: null };
    },
  };
  const bound = {
    async updateBoundRecoveryPassword(binding, _password, current) {
      assert(current());
      updates.push({ id: binding.userId, token: binding.accessToken });
      if (options.updateGate) await options.updateGate.promise;
      if (!current()) throw Error("Account changed");
    },
  };
  const { Route } = load(
    "src/routes/reset-password.tsx",
    (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@tanstack/react-router") return routeStub;
      if (name === "@/lib/bound-password-reset") return bound;
      if (name === "@/integrations/supabase/client") return { supabase: { auth } };
      if (name === "@/lib/password-recovery-flow") return recoveryFlow;
      if (name === "@/lib/password-recovery-session")
        return {
          createBrowserRecovery: (active, invalidate, expectedLogout) =>
            recoveryFlow.createRecoveryFlow({
              main: auth,
              recovery: { ...auth, setSession: () => auth.verifyOtp() },
              active,
              invalidate,
              expectedLogout,
              available: () => true,
              cleanup() {},
              prepareCode: () => () => {},
              save: (tokens) => auth.setSession(tokens),
            }),
        };
      if (name === "@/lib/password-recovery")
        return { passwordRecoveryEnabled: true, isRecoveryTestProject: true };
      if (name === "@/i18n/LanguageProvider")
        return { useLanguage: () => ({ language: options.english ? "en" : "zh-CN" }) };
      return {};
    },
    {
      queueMicrotask,
      window: {
        setTimeout() {
          return 1;
        },
        clearTimeout() {},
        location: {
          search: options.search ?? "?token_hash=synthetic",
          hash: options.hash ?? "",
          pathname: "/reset-password",
        },
        history: {
          replaceState() {
            events.push("scrub");
          },
        },
      },
    },
  );
  const h = {
    updates,
    signouts,
    writes,
    events,
    render() {
      cursor = 0;
      const tree = nodes(Route.component());
      effects.splice(0).forEach((fn) => cleanups.push(fn()));
      return tree;
    },
    owner(value, emit = true) {
      owner = value;
      if (emit) callback?.(value ? "SIGNED_IN" : "SIGNED_OUT", session());
    },
    fill(value = "LocalOnly123") {
      for (const id of ["new-password", "confirm-password"])
        h.render()
          .find((n) => n.props?.id === id)
          .props.onChange({ target: { value } });
    },
    submit() {
      events.push("submit");
      return h
        .render()
        .find((n) => n.type === "form")
        .props.onSubmit({ preventDefault() {} });
    },
    replayEffects() {
      cleanups.splice(0).forEach((fn) => fn?.());
      effectFns.forEach((fn) => cleanups.push(fn()));
    },
    unmount() {
      cleanups.splice(0).forEach((fn) => fn?.());
      unmounted = true;
    },
  };
  return h;
}
async function ready(options = {}) {
  const h = harness(options);
  h.render();
  await tick();
  assert(h.render().some((n) => n.type === "form"));
  return h;
}
for (const options of [{ search: "" }, { expired: true }, { serverError: true }]) {
  const h = harness(options);
  h.render();
  await tick();
  assert(!h.render().some((n) => n.type === "form"));
  assert.equal(h.updates.length, 0);
}
const normal = await ready();
for (const value of ["12345678", "abcdefghijkl"]) {
  const boundary = await ready();
  boundary.fill(value);
  await boundary.submit();
  assert.equal(boundary.updates.length, 1, "Reset accepts eight through twelve without forced character mix");
}
for (const value of ["1234567", "1234567890123"]) {
  normal.fill(value);
  await normal.submit();
  assert.equal(normal.updates.length, 0, "Reset length boundaries block auth mutation");
  assert(normal.render().some(n => n.props.role === "alert"));
}
for (const id of ["new-password", "confirm-password"]) {
  const field = normal.render().find(n => n.props.id === id);
  assert.equal(field.props.minLength, 8);
  assert.equal(field.props.maxLength, 12);
  assert.equal(field.props["aria-describedby"], "reset-password-requirements");
}
normal.fill();
await normal.submit();
assert.equal(normal.updates[0].id, "A");
assert.equal(normal.signouts.length, 1);
assert(!normal.render().some((n) => n.type === "form"));
const sameOwner = await ready();
sameOwner.owner("A");
sameOwner.fill();
await sameOwner.submit();
assert.equal(sameOwner.updates[0].id, "A");
const replayGate = gate(),
  replayed = harness({ verifyGate: replayGate });
replayed.render();
replayed.replayEffects();
replayGate.resolve();
await tick();
assert(replayed.render().some((n) => n.type === "form"));
assert.equal(replayed.events.filter((e) => e === "verify").length, 1);
console.log(
  "PASS: missing_expired_server_rejected_links_stay_locked_normal_verified_A_update_and_expected_logout_complete",
);
for (const emit of [true, false]) {
  const h = await ready();
  h.fill();
  const stale = h.render().find((n) => n.type === "form").props.onSubmit;
  h.owner("B", emit);
  await stale({ preventDefault() {} });
  assert.equal(h.updates.length, 0);
  assert.equal(h.signouts.length, 0);
  assert(!h.render().some((n) => n.type === "form"));
}
const bounced = await ready();
bounced.fill();
bounced.owner("B");
bounced.owner("A");
assert(!bounced.render().some((n) => n.type === "form"));
assert.equal(bounced.updates.length, 0);
const signedOut = await ready();
signedOut.fill();
signedOut.owner(null);
assert(!signedOut.render().some((n) => n.type === "form"));
console.log(
  "PASS: changed_owner_with_or_without_auth_event_A_B_A_and_signout_lock_form_clear_inputs_block_stale_submit_and_wrong_account_logout",
);
const checkGate = gate(),
  checking = await ready({ checkGate });
checking.fill();
const pendingCheck = checking.submit();
await tick();
checking.owner("B");
checkGate.resolve();
await pendingCheck;
assert.equal(checking.updates.length, 0);
const updateGate = gate(),
  updating = await ready({ updateGate });
updating.fill();
const pendingUpdate = updating.submit();
await tick();
await updating.submit();
assert.equal(updating.updates.length, 1);
assert(
  updating
    .render()
    .filter((n) => n.type === "input")
    .every((n) => n.props.disabled),
);
updating.owner("B");
updateGate.resolve();
await pendingUpdate;
assert.equal(updating.updates[0].id, "A");
assert.equal(updating.signouts.length, 0);
assert(!updating.render().some((n) => n.props?.role === "status"));
const silentGate = gate(),
  silent = await ready({ updateGate: silentGate });
silent.fill();
const silentSave = silent.submit();
await tick();
silent.owner("B", false);
silentGate.resolve();
await silentSave;
assert.equal(silent.signouts.length, 0);
assert(!silent.render().some((n) => n.type === "form"));
const verifyGate = gate(),
  verifying = harness({ verifyGate });
verifying.render();
verifying.owner("A");
verifying.owner("B");
verifying.owner("A");
verifyGate.resolve();
await tick();
assert(!verifying.render().some((n) => n.type === "form"));
const unmountGate = gate(),
  gone = harness({ verifyGate: unmountGate });
gone.render();
gone.unmount();
unmountGate.resolve();
await tick();
assert.equal(gone.writes.length, 0);
const lateGate = gate(),
  late = await ready({ updateGate: lateGate });
late.fill();
const lateSave = late.submit();
await tick();
late.unmount();
lateGate.resolve();
await lateSave;
assert.equal(late.writes.length, 0);
assert.equal(late.signouts.length, 0);
console.log(
  "PASS: owner_change_during_server_check_or_update_and_verification_A_B_A_cancel_late_UI_no_unmount_writes_or_new_owner_signout",
);
let current = true;
const requests = [];
const transport = load("src/lib/bound-password-reset.ts", () => ({}), {
  fetch: async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ id: "A" }) };
  },
});
await transport.updateBoundRecoveryPassword(
  { userId: "A", accessToken: "verified-token-A" },
  "synthetic",
  () => current,
);
assert.equal(requests[0].init.headers.Authorization, "Bearer verified-token-A");
assert.equal(requests[0].init.method, "PUT");
assert.equal(requests[0].url, "https://esovqvampbrhuhamkfcs.supabase.co/auth/v1/user");
current = false;
await assert.rejects(
  transport.updateBoundRecoveryPassword(
    { userId: "A", accessToken: "verified-token-A" },
    "synthetic",
    () => current,
  ),
);
assert.equal(requests.length, 1);
for (const response of [
  { ok: false, json: async () => ({}) },
  { ok: true, json: async () => ({ id: "B" }) },
]) {
  const rejected = load("src/lib/bound-password-reset.ts", () => ({}), {
    fetch: async () => response,
  });
  await assert.rejects(
    rejected.updateBoundRecoveryPassword(
      { userId: "A", accessToken: "verified-token-A" },
      "synthetic",
      () => true,
    ),
  );
}
console.log(
  "PASS: actual_password_transport_uses_verified_token_not_shared_session_and_rejects_cancelled_request",
);
console.log(
  "AUDIT: repaired_actual_source_models_passed; no_real_password_email_or_network; recovery_acceptance_pending",
);
