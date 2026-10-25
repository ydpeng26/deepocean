// Actual route, browser wiring, storage policy and installed SDK. All fetches
// are synthetic; no browser, network, mail, real identities or password writes.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const flush = async () => {
  for (let i = 0; i < 30; i++) await tick();
};
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
function load(file, modules = {}, globals = {}) {
  const source = fs
    .readFileSync(new URL("../" + file, import.meta.url), "utf8")
    .replaceAll(
      "import.meta.env",
      '({VITE_SUPABASE_URL:"https://synthetic.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"synthetic-public-key"})',
    );
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => {
        assert(name in modules, name);
        return modules[name];
      },
      URL,
      URLSearchParams,
      queueMicrotask,
      ...globals,
    },
  );
  return module.exports;
}
const policy = load("src/lib/password-recovery-flow.ts"),
  keysModule = load("src/lib/password-recovery-keys.ts");
const keys = keysModule.recoveryKeys("https://synthetic.supabase.co");
for (const [search, hash] of [
  ["", ""],
  ["?token_hash=x&code=y", ""],
  ["?token_hash=x&code=", ""],
  ["?code=x&code=y", ""],
  ["?code=x&error=denied", ""],
  ["?token_hash=x&type=signup", ""],
  ["", "#access_token=x&refresh_token=y"],
  ["?access_token=x&refresh_token=y", ""],
  ["?token_hash=%20", ""],
  ["?code=x", "#refresh_token=y"],
]) {
  assert.equal(policy.recoveryInput(search, hash).kind, "invalid");
}
const makeSession = (suffix) => {
  const user = {
    id: "00000000-0000-4000-8000-000000000" + suffix,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
  const access_token =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".c3ludGhldGlj";
  return {
    user,
    access_token,
    refresh_token: "synthetic-refresh-" + suffix,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
  };
};
const A = makeSession("726"),
  B = makeSession("727"),
  C = makeSession("728");
async function harness(options = {}) {
  const held = gate(),
    values = new Map([
      [keys.mainSession, JSON.stringify(C)],
      ["unrelated-draft", "keep"],
    ]);
  if (options.kind === "code") values.set(keys.mainVerifier, JSON.stringify("synthetic-verifier"));
  let verifyCalls = 0,
    userA = 0,
    cursor = 0,
    unmounted = false,
    lateUI = 0,
    cleanup,
    stopped = false;
  const cells = [],
    effects = [],
    effectFns = [],
    timers = new Map();
  let timerId = 0;
  const raw = {
    getItem: (k) => values.get(k) ?? null,
    setItem(k, v) {
      if (options.denySave && k === keys.mainSession && JSON.parse(v)?.user?.id === A.user.id)
        throw Error("Synthetic quota");
      values.set(k, v);
    },
    removeItem: (k) => values.delete(k),
  };
  const window = {
    sessionStorage: raw,
    location: {
      pathname: "/reset-password",
      search:
        options.search ??
        (options.kind === "code"
          ? "?code=synthetic-code"
          : options.kind === "tokens"
            ? ""
            : "?token_hash=synthetic-reset"),
      hash:
        options.kind === "tokens"
          ? "#type=recovery&access_token=" + A.access_token + "&refresh_token=" + A.refresh_token
          : "",
    },
    history: {
      replaceState() {
        if (options.scrubError) throw Error("Synthetic history error");
        window.location.search = "";
        window.location.hash = "";
      },
    },
    setTimeout(fn) {
      const id = ++timerId;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const tab = load("src/lib/tab-auth-storage.ts", {}, { window });
  const storage = tab.getTabAuthStorage();
  const fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://synthetic.supabase.co");
    let body;
    if (url.pathname === "/auth/v1/verify" || url.pathname === "/auth/v1/token") {
      assert.equal(init.method, "POST");
      const data = JSON.parse(init.body);
      if (url.pathname.endsWith("verify")) {
        assert.equal(data.token_hash, "synthetic-reset");
        assert.equal(data.type, "recovery");
      } else {
        assert.equal(url.searchParams.get("grant_type"), "pkce");
        assert.equal(data.auth_code, "synthetic-code");
        assert.equal(data.code_verifier, "synthetic-verifier");
      }
      verifyCalls++;
      if (options.hold === "verify") await held.promise;
      if (options.networkError) throw new TypeError("Synthetic transport failure");
      if (options.verifyError)
        return new Response(JSON.stringify({ msg: "Synthetic expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      body = A;
    } else {
      assert.equal(url.pathname, "/auth/v1/user");
      assert.equal(init.method, "GET");
      const bearer = new Headers(init.headers).get("authorization");
      const session = [A, B, C].find((s) => bearer === "Bearer " + s.access_token);
      assert(session);
      if (session === A) {
        userA++;
        if (options.hold === "save" && userA === 2) await held.promise;
      }
      body = options.mismatch && session === A ? B.user : session.user;
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const make = (key) =>
    createClient("https://synthetic.supabase.co", "synthetic-public-key", {
      auth: {
        storage,
        storageKey: key,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      global: { fetch },
    });
  const main = make(keys.mainSession),
    recovery = make(keys.session);
  await main.auth.initialize();
  await recovery.auth.initialize();
  const wiring = load(
    "src/lib/password-recovery-session.ts",
    {
      "@/integrations/supabase/client": {
        supabase: main,
        passwordRecovery: recovery,
        getSupabaseProjectUrl: () => "https://synthetic.supabase.co",
      },
      "@/lib/tab-auth-storage": tab,
      "@/lib/password-recovery-flow": policy,
      "@/lib/password-recovery-keys": keysModule,
    },
    { window },
  );
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = value;
      return [
        cells[i],
        (v) => {
          if (unmounted) lateUI++;
          cells[i] = typeof v === "function" ? v(cells[i]) : v;
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
        effectFns.push(fn);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const { Route } = load(
    "src/routes/reset-password.tsx",
    {
      react: react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@tanstack/react-router": { createFileRoute: () => (opts) => opts, Link: "Link" },
      "@/integrations/supabase/client": { supabase: main },
      "@/lib/password-recovery": { passwordRecoveryEnabled: true, isRecoveryTestProject: true },
      "@/i18n/LanguageProvider": { useLanguage: () => ({ language: options.language ?? "zh-CN" }) },
      "@/lib/bound-password-reset": {
        updateBoundRecoveryPassword() {
          throw Error("Password writes forbidden");
        },
      },
      "@/lib/password-recovery-flow": policy,
      "@/lib/password-recovery-session": wiring,
    },
    { window },
  );
  const h = {
    values,
    keys,
    main,
    recovery,
    window,
    held,
    tab,
    wiring,
    render() {
      cursor = 0;
      const tree = nodes(Route.component());
      effects.splice(0).forEach((fn) => {
        cleanup = fn();
      });
      return tree;
    },
    ready() {
      return h.render().some((n) => n.type === "form");
    },
    owner() {
      return JSON.parse(values.get(keys.mainSession) ?? "null")?.user.id ?? null;
    },
    count() {
      return verifyCalls;
    },
    userCount() {
      return userA;
    },
    timeout() {
      [...timers.values()].forEach((fn) => fn());
    },
    replay() {
      cleanup?.();
      effectFns.forEach((fn) => {
        cleanup = fn();
      });
    },
    unmount() {
      cleanup?.();
      unmounted = true;
    },
    lateUI: () => lateUI,
    async close() {
      if (stopped) return;
      stopped = true;
      held.resolve();
      await flush();
      cleanup?.();
      await flush();
      main.auth.stopAutoRefresh();
      recovery.auth.stopAutoRefresh();
    },
  };
  h.render();
  return h;
}
for (const language of ["zh-CN", "en"]) {
  for (const kind of ["hash", "code", "tokens"]) {
    const h = await harness({ kind, language });
    try {
      await flush();
      assert(h.ready(), kind);
      assert.equal(h.owner(), A.user.id);
      assert.equal(h.count(), kind === "tokens" ? 0 : 1);
      assert.equal(h.window.location.search, "");
      assert.equal(h.window.location.hash, "");
      for (const k of [keys.session, keys.user, keys.verifier, keys.mainVerifier])
        assert(!h.values.has(k), k);
      assert.equal(h.values.get("unrelated-draft"), "keep");
      await h.main.auth.setSession(B);
      await flush();
      assert(!h.ready());
      assert.equal(h.owner(), B.user.id);
    } finally {
      await h.close();
    }
  }
  for (const mode of ["switch", "silent-switch", "bounce", "unmount", "timeout", "replay"]) {
    const h = await harness({ hold: "verify", language });
    try {
      await flush();
      assert.equal(h.count(), 1);
      assert(!h.ready());
      if (mode === "switch" || mode === "bounce") await h.main.auth.setSession(B);
      if (mode === "silent-switch") h.values.set(keys.mainSession, JSON.stringify(B));
      if (mode === "bounce") await h.main.auth.setSession(C);
      if (mode === "unmount") {
        h.unmount();
        await flush();
      }
      if (mode === "timeout") h.timeout();
      if (mode === "replay") h.replay();
      h.held.resolve();
      await flush();
      assert.equal(h.ready(), mode === "replay", mode);
      assert.equal(
        h.owner(),
        mode === "replay"
          ? A.user.id
          : ["switch", "silent-switch"].includes(mode)
            ? B.user.id
            : C.user.id,
        mode,
      );
      assert.equal(h.lateUI(), 0);
      assert(!h.values.has(keys.session));
      assert.equal(h.values.get("unrelated-draft"), "keep");
    } finally {
      await h.close();
    }
  }
  for (const mode of ["switch", "timeout", "unmount"]) {
    const h = await harness({ hold: "save", language });
    try {
      await flush();
      assert.equal(h.userCount(), 2);
      if (mode === "switch") h.values.set(keys.mainSession, JSON.stringify(B));
      if (mode === "timeout") h.timeout();
      if (mode === "unmount") {
        h.unmount();
        await flush();
      }
      h.held.resolve();
      await flush();
      assert(!h.ready());
      assert.equal(h.owner(), mode === "switch" ? B.user.id : C.user.id);
      assert.equal(h.tab.authStorageState.getSnapshot(), "available");
      assert(!h.values.has(keys.session));
      assert.equal(h.lateUI(), 0);
    } finally {
      await h.close();
    }
  }
  for (const options of [
    { verifyError: true },
    { networkError: true },
    { mismatch: true },
    { denySave: true },
    { scrubError: true },
    { search: "" },
    { search: "?code=x&code=y" },
  ]) {
    const h = await harness({ ...options, language });
    try {
      await flush();
      assert(!h.ready());
      assert.equal(h.owner(), C.user.id);
      assert(!h.values.has(keys.session));
      assert.equal(h.values.get("unrelated-draft"), "keep");
    } finally {
      await h.close();
    }
  }
  const h = await harness({ kind: "code", hold: "verify", language });
  try {
    await flush();
    h.values.set(keys.mainVerifier, "newer-verifier");
    const other = h.wiring.createBrowserRecovery(
      () => true,
      () => {},
      () => false,
    );
    await assert.rejects(other.run({ kind: "hash", value: "synthetic-reset" }));
    assert.equal(h.count(), 1);
    h.timeout();
    h.held.resolve();
    await flush();
    assert.equal(h.values.get(keys.mainVerifier), "newer-verifier");
    assert(!h.ready());
  } finally {
    await h.close();
  }
  console.log(
    "PASS: " +
      language +
      "_actual_route_installed_sdk_and_storage_preserve_new_owner_block_late_writes_handle_all_formats_errors_timeout_unmount_replay_and_exact_cleanup",
  );
}
// Actual lazy-client construction: neither main initialization nor isolated
// recovery initialization may auto-consume a reset URL (including trailing slash).
for (const path of [
  "/reset-password",
  "/reset-password/",
  "/auth-confirmed",
  "/auth",
  "/oauth-callback",
]) {
  const options = [];
  const client = load(
    "src/integrations/supabase/client.ts",
    {
      "@supabase/supabase-js": {
        createClient(_url, _key, opts) {
          options.push(opts.auth);
          return { auth: {} };
        },
      },
      "@/lib/tab-auth-storage": { getTabAuthStorage: () => ({}) },
      "@/lib/google-oauth-keys": load("src/lib/google-oauth-keys.ts"),
      "@/lib/email-confirmation-keys": load("src/lib/email-confirmation-keys.ts"),
      "@/lib/password-recovery-keys": keysModule,
    },
    { window: { location: { pathname: path }, localStorage: { removeItem() {} } } },
  );
  void client.supabase.auth;
  void client.passwordRecovery.auth;
  assert.equal(
    options[0].detectSessionInUrl,
    path.startsWith("/reset-password") || path === "/auth-confirmed" ? false : undefined,
  );
  assert.equal(options[1].storageKey, keys.session);
  assert.equal(options[1].detectSessionInUrl, false);
  assert.equal(options[1].autoRefreshToken, false);
  assert.equal(options[1].flowType, "pkce");
}
console.log("PASS: strict_recovery_input_and_actual_client_explicit_URL_consumption_configuration");
console.log(
  "AUDIT: local_repair_complete; all_fetches_mocked; no_real_password_email_accounts_backend_changes_or_browser_deployment",
);
