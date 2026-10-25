// Actual route + installed SDK, synthetic in-memory storage and mocked fetch only.
// Never submit a password, send mail, use real identities, or make network calls.
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
const key = "synthetic-password-reset-pending";
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
for (const language of ["zh-CN", "en"]) {
  const recovery = makeSession("726"),
    newer = makeSession("727"),
    old = makeSession("728");
  const values = new Map([
    [key, JSON.stringify(old)],
    ["unrelated-draft", "keep"],
  ]);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  let release,
    requested = false,
    networkCalls = 0;
  const responseGate = new Promise((resolve) => {
    release = resolve;
  });
  const sdk = createClient("https://synthetic.supabase.co", "synthetic-public-key", {
    auth: {
      storage,
      storageKey: key,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        networkCalls++;
        const url = new URL(String(input));
        assert.equal(url.origin, "https://synthetic.supabase.co");
        let body;
        if (url.pathname === "/auth/v1/verify") {
          assert.equal(init.method, "POST");
          const data = JSON.parse(init.body);
          assert.equal(data.token_hash, "synthetic-reset");
          assert.equal(data.type, "recovery");
          requested = true;
          await responseGate;
          body = recovery;
        } else {
          assert.equal(url.pathname, "/auth/v1/user");
          assert.equal(init.method, "GET");
          const bearer = new Headers(init.headers).get("authorization");
          const session = [recovery, newer].find((s) => bearer === "Bearer " + s.access_token);
          assert(session);
          body = session.user;
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  await sdk.auth.initialize();
  let cursor = 0,
    cleanup;
  const cells = [],
    effects = [];
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = value;
      return [
        cells[i],
        (v) => {
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
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const require = (name) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@tanstack/react-router")
      return { createFileRoute: () => (options) => options, Link: "Link" };
    if (name === "@/integrations/supabase/client") return { supabase: sdk };
    if (name === "@/lib/password-recovery")
      return { passwordRecoveryEnabled: true, isRecoveryTestProject: true };
    if (name === "@/i18n/LanguageProvider") return { useLanguage: () => ({ language }) };
    if (name === "@/lib/bound-password-reset")
      return {
        updateBoundRecoveryPassword() {
          throw Error("Password mutation forbidden");
        },
      };
    throw Error("Unexpected module");
  };
  // Historical finding, pinned to the formal release before this repair.
  const source = execFileSync("git", ["show", "dbbc9ad:src/routes/reset-password.tsx"], {
    encoding: "utf8",
  });
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require,
      URLSearchParams,
      window: {
        location: { search: "?token_hash=synthetic-reset", hash: "", pathname: "/reset-password" },
        history: { replaceState() {} },
      },
    },
  );
  const render = () => {
    cursor = 0;
    const tree = nodes(module.exports.Route.component());
    effects.splice(0).forEach((fn) => {
      cleanup = fn();
    });
    return tree;
  };
  try {
    render();
    for (let i = 0; i < 30 && !requested; i++) await tick();
    assert(requested);
    // Model a legitimate account change while verifyOtp's network response is pending.
    const switched = await sdk.auth.setSession(newer);
    assert.equal(switched.error, null);
    assert.equal(JSON.parse(values.get(key)).user.id, newer.user.id);
    assert(!render().some((n) => n.type === "form"));
    release();
    for (let i = 0; i < 30; i++) await tick();
    assert.equal(JSON.parse(values.get(key)).user.id, recovery.user.id);
    assert(render().some((n) => n.type === "form"));
    assert.equal(values.get("unrelated-draft"), "keep");
    console.log(
      "FINDING: " +
        language +
        "_late_recovery_verification_overwrites_newer_session_and_unlocks_reset_form",
    );
    assert(networkCalls >= 3);
  } finally {
    release();
    cleanup?.();
    sdk.auth.stopAutoRefresh();
  }
}
console.log(
  "AUDIT: diagnosis_complete; actual_route_and_installed_sdk; all_fetches_mocked; no_real_accounts_mail_password_submission_or_backend_changes",
);
