// Actual auth component in a local hook model. No browser, real SDK, network or mail.
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function harness(language) {
  let cursor = 0;
  const cells = [],
    pending = gate(),
    calls = { signin: 0, reset: 0, google: 0 };
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
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@tanstack/react-router": {
      createFileRoute: () => (options) => ({ ...options, useSearch: () => ({}) }),
      useNavigate: () => () => {},
      Link: "Link",
    },
    "lucide-react": {},
    sonner: { toast: { dismiss() {}, error() {}, success() {}, info() {} } },
    "@/integrations/lovable": {
      lovable: {
        auth: {
          async signInWithOAuth() {
            calls.google++;
            await pending.promise;
            return { redirected: true };
          },
        },
      },
    },
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          async signInWithPassword() {
            calls.signin++;
            await pending.promise;
            return { error: null };
          },
          async resetPasswordForEmail() {
            calls.reset++;
            await pending.promise;
            return { error: null };
          },
          async getSession() {
            return { data: { session: null }, error: null };
          },
        },
      },
    },
    "@/i18n/LanguageProvider": { useLanguage: () => ({ language, toggleLanguage() {} }) },
    "@/i18n/liveCopy": { useLiveCopy() {} },
    "@/lib/password-recovery": { passwordRecoveryEnabled: true },
    "@/lib/auth-return": { safeAuthReturn: () => undefined },
    "@/lib/tab-auth-storage": { authStorageAvailable: () => true },
    "@/hooks/useAuthStorageStatus": { useAuthStorageStatus: () => "available" },
  };
  const module = { exports: {} };
  // Historical diagnostic, pinned before the action-lock repair.
  const source = execFileSync("git", ["show", "6d4a602:src/routes/auth.tsx"], {
    encoding: "utf8",
  }).replaceAll("import.meta.env", '({PROD:false,VITE_SITE_URL:"https://synthetic.invalid"})');
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => {
        assert(name in modules);
        return modules[name];
      },
      window: { location: { origin: "https://synthetic.invalid" } },
    },
  );
  const render = () => {
    cursor = 0;
    return nodes(module.exports.Route.component());
  };
  const field = (id) => render().find((n) => n.props?.id === id);
  field("email").props.onChange({ target: { value: "synthetic@example.invalid" } });
  field("password").props.onChange({ target: { value: "Synthetic-only-password" } });
  return {
    calls,
    pending,
    render,
    form: () => render().find((n) => n.type === "form"),
    reset: () => render().find((n) => n.props?.className === "do-auth-forgot"),
    google: () => render().find((n) => n.props?.className === "do-auth-google"),
    submitButton: () => render().find((n) => n.props?.className === "do-auth-submit"),
  };
}
for (const language of ["zh-CN", "en"]) {
  {
    const h = harness(language);
    const first = h.reset().props.onClick();
    assert.equal(h.calls.reset, 1);
    assert.equal(h.reset().props.disabled, true);
    // Re-render after resetBusy was committed: this is a separately available
    // visible action, not a same-tick or stale-handler double-click artifact.
    assert.equal(h.submitButton().props.disabled, false);
    const second = h.form().props.onSubmit({ preventDefault() {} });
    assert.equal(h.calls.signin, 1);
    h.pending.resolve();
    await Promise.all([first, second]);
    console.log(
      "FINDING: " + language + "_password_reset_request_pending_still_allows_password_signin",
    );
  }
  for (const action of ["signin", "google"]) {
    const h = harness(language);
    const first =
      action === "signin"
        ? h.form().props.onSubmit({ preventDefault() {} })
        : h.google().props.onClick();
    assert.equal(h.calls[action], 1);
    assert.equal(h.submitButton().props.disabled, true);
    assert.equal(h.reset().props.disabled, false);
    const second = h.reset().props.onClick();
    assert.equal(h.calls.reset, 1);
    h.pending.resolve();
    await Promise.all([first, second]);
    console.log("FINDING: " + language + "_" + action + "_pending_still_allows_reset_mail_request");
  }
  const control = harness(language);
  const first = control.form().props.onSubmit({ preventDefault() {} });
  await control.form().props.onSubmit({ preventDefault() {} });
  assert.equal(control.calls.signin, 1);
  control.pending.resolve();
  await first;
}
console.log("CONTROL: repeated_password_signin_is_guarded_but_cross_action_overlap_is_not");
{
  const pending = gate(),
    calls = [];
  const sdk = createClient("https://synthetic.supabase.co", "synthetic-public-key", {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.origin, "https://synthetic.supabase.co");
        assert.equal(init.method, "POST");
        const body = JSON.parse(init.body);
        assert.equal(body.email, "synthetic@example.invalid");
        if (url.pathname === "/auth/v1/token") {
          assert.equal(url.searchParams.get("grant_type"), "password");
          assert.equal(body.password, "Synthetic-only-password");
          calls.push("signin");
          await pending.promise;
          return new Response(
            JSON.stringify({ code: "invalid_credentials", msg: "Synthetic rejection" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        assert.equal(url.pathname, "/auth/v1/recover");
        calls.push("reset");
        await pending.promise;
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  try {
    await sdk.auth.initialize();
    const first = sdk.auth.signInWithPassword({
      email: "synthetic@example.invalid",
      password: "Synthetic-only-password",
    });
    const second = sdk.auth.resetPasswordForEmail("synthetic@example.invalid");
    for (let i = 0; i < 20 && calls.length < 2; i++) await new Promise((r) => setImmediate(r));
    assert.deepEqual(calls.sort(), ["reset", "signin"]);
    pending.resolve();
    await Promise.all([first, second]);
    console.log(
      "CONFIRMED: installed_SDK_starts_both_mocked_signin_and_recovery_requests_before_either_completes",
    );
  } finally {
    pending.resolve();
    sdk.auth.stopAutoRefresh();
  }
}
console.log(
  "AUDIT: diagnosis_complete; actual_auth_component; SDK_calls_modeled_only; no_network_mail_real_accounts_password_changes_or_deployment",
);
