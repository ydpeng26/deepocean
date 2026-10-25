// Actual auth route in a local deterministic hook model. All SDK/provider
// calls are mocked; no network, browser, real accounts, passwords or mail.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise((r) => setImmediate(r));
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
function harness(language = "en", enabled = true) {
  let cursor = 0,
    blocked = false,
    probes = 0,
    pending,
    completion,
    result = "normal";
  const cells = [],
    calls = [],
    toasts = [],
    navigations = [];
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
  async function request(kind, input) {
    calls.push({ kind, input });
    if (pending) await pending.promise;
    if (result === "throw") throw Error("Synthetic failure");
    if (result === "returned") return { error: Error("Synthetic failure") };
    return kind === "google"
      ? { error: null, redirected: result === "redirected" }
      : { error: null };
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    "@tanstack/react-router": {
      createFileRoute: () => (options) => ({ ...options, useSearch: () => ({}) }),
      useNavigate: () => (value) => navigations.push(value.to),
      Link: "Link",
    },
    sonner: {
      toast: Object.fromEntries(
        ["dismiss", "error", "success", "info"].map((kind) => [
          kind,
          (message) => toasts.push({ kind, message }),
        ]),
      ),
    },
    "@/integrations/lovable": {
      lovable: { auth: { signInWithOAuth: (_provider, input) => request("google", input) } },
    },
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          signInWithPassword: (input) => request("signin", input),
          signUp: (input) => request("signup", input),
          resend: (input) => request("resend", input),
          resetPasswordForEmail: (email, input) => request("reset", { email, ...input }),
          async getSession() {
            if (completion) await completion.promise;
            return { error: null, data: { session: null } };
          },
        },
      },
    },
    "@/i18n/LanguageProvider": { useLanguage: () => ({ language, toggleLanguage() {} }) },
    "@/i18n/liveCopy": { useLiveCopy() {} },
    "@/lib/password-recovery": { passwordRecoveryEnabled: enabled },
    "@/lib/auth-return": { safeAuthReturn: () => undefined },
    "@/lib/tab-auth-storage": {
      authStorageAvailable() {
        probes++;
        return !blocked;
      },
    },
    "@/hooks/useAuthStorageStatus": {
      useAuthStorageStatus: () => (blocked ? "blocked" : "available"),
    },
  };
  const source = fs
    .readFileSync(new URL("../src/routes/auth.tsx", import.meta.url), "utf8")
    .replaceAll("import.meta.env", '({PROD:false,VITE_SITE_URL:"https://synthetic.invalid"})');
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    {
      module,
      exports: module.exports,
      URL,
      require: (name) => {
        assert(name in modules, name);
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
  const tab = (mode) => field("auth-" + mode + "-tab");
  const h = {
    calls,
    toasts,
    navigations,
    render,
    field,
    tab,
    fill(email = "synthetic@example.invalid", password = "Synthetic-only-password") {
      field("email").props.onChange({ target: { value: email } });
      field("password").props.onChange({ target: { value: password } });
    },
    setBlocked: (value) => {
      blocked = value;
    },
    probes: () => probes,
    defer(mode = "normal", holdCompletion = false) {
      result = mode;
      pending = gate();
      completion = holdCompletion ? gate() : undefined;
      return { resolve: () => pending.resolve(), complete: () => completion?.resolve() };
    },
    setResult: (value) => {
      result = value;
    },
    handlers() {
      const tree = render(),
        form = tree.find((n) => n.type === "form"),
        google = tree.find((n) => n.props?.className === "do-auth-google");
      const aux =
        tree.find((n) => n.props?.className === "do-auth-forgot") ??
        tree.find(
          (n) =>
            n.type === "button" &&
            n.props?.children ===
              (language === "en" ? "Resend confirmation email" : "重新发送确认邮件"),
        );
      return {
        submit: () => form.props.onSubmit({ preventDefault() {} }),
        google: () => google.props.onClick(),
        ...(aux ? { aux: () => aux.props.onClick() } : {}),
      };
    },
    assertBusy(expected) {
      const tree = render();
      const controls = tree.filter(
        (n) =>
          n.type === "button" &&
          (n.props.role === "tab" ||
            n.props.type === "submit" ||
            ["do-auth-google", "do-auth-forgot"].includes(n.props.className) ||
            (typeof n.props.children === "string" &&
              /Resend|Resending|重新发送|正在重新发送/.test(n.props.children))),
      );
      for (const n of controls)
        assert.equal(n.props.disabled, expected, n.props.className ?? n.props.id ?? "resend");
      assert.equal(tree.find((n) => n.type === "form").props["aria-busy"], expected);
      assert.equal(field("email").props.disabled, expected);
      assert.equal(field("password").props.disabled, expected);
      assert.equal(field("email").props.value, "synthetic@example.invalid");
      assert.equal(field("password").props.value, "Synthetic-only-password");
    },
    async signupReady() {
      tab("signup").props.onClick();
      await h.handlers().submit();
      assert(h.handlers().aux);
      calls.length = 0;
      toasts.length = 0;
    },
  };
  h.fill();
  return h;
}
for (const language of ["zh-CN", "en"]) {
  for (const view of ["signin", "signup"]) {
    for (const owner of ["submit", "google", "aux"]) {
      const h = harness(language);
      if (view === "signup") await h.signupReady();
      const cached = h.handlers(),
        oldTab = h.tab(view === "signup" ? "signin" : "signup"),
        g = h.defer();
      const first = cached[owner]();
      assert.equal(h.calls.length, 1);
      const probes = h.probes();
      // Same tick, no disabled-controls render yet: all cached handlers must fail closed.
      for (const fn of Object.values(cached)) await fn();
      assert.equal(h.calls.length, 1);
      assert.equal(h.probes(), probes);
      h.assertBusy(true);
      // Fresh handlers after a re-render must behave identically, not just the UI.
      for (const fn of Object.values(h.handlers())) await fn();
      oldTab.props.onClick();
      assert.equal(h.tab(view).props["aria-selected"], true);
      assert.equal(h.calls.length, 1);
      assert.equal(h.probes(), probes);
      g.resolve();
      await first;
      h.assertBusy(false);
      assert.equal(h.calls.length, 1);
      if (owner === "aux") assert.equal(h.calls[0].kind, view === "signup" ? "resend" : "reset");
    }
  }
  for (const view of ["signin", "signup"])
    for (const owner of ["submit", "google", "aux"])
      for (const error of ["returned", "throw"]) {
        const h = harness(language);
        if (view === "signup") await h.signupReady();
        const g = h.defer(error),
          first = h.handlers()[owner]();
        h.assertBusy(true);
        g.resolve();
        await first;
        h.assertBusy(false);
        assert.equal(h.toasts.filter((t) => t.kind === "error").length, 1);
        assert.equal(h.calls.length, 1);
        const retry = h.defer();
        const second = h.handlers()[owner]();
        assert.equal(h.calls.length, 2);
        h.assertBusy(true);
        retry.resolve();
        await second;
        h.assertBusy(false);
      }
  {
    const h = harness(language),
      g = h.defer("normal", true),
      first = h.handlers().submit();
    g.resolve();
    await tick();
    h.assertBusy(true);
    await h.handlers().aux();
    assert.equal(h.calls.length, 1);
    g.complete();
    await first;
    h.assertBusy(false);
  }
  {
    const h = harness(language),
      g = h.defer("redirected"),
      first = h.handlers().google();
    g.resolve();
    await first;
    h.assertBusy(true);
    for (const fn of Object.values(h.handlers())) await fn();
    assert.equal(h.calls.length, 1);
  }
  {
    const h = harness(language);
    h.setBlocked(true);
    for (const fn of Object.values(h.handlers())) await fn();
    assert.equal(h.calls.length, 0);
    assert(h.render().some((n) => n.type === "fieldset" && n.props.disabled));
    h.setBlocked(false);
    const g = h.defer(),
      p = h.handlers().submit();
    g.resolve();
    await p;
    h.assertBusy(false);
  }
  {
    const h = harness(language);
    h.fill("", "short");
    await h.handlers().submit();
    await h.handlers().aux();
    assert.equal(h.calls.length, 0);
    h.fill();
    h.assertBusy(false);
    const g = h.defer(),
      p = h.handlers().aux();
    g.resolve();
    await p;
    h.assertBusy(false);
    assert.equal(h.calls[0].input.redirectTo, "https://synthetic.invalid/reset-password");
  }
  console.log(
    "PASS: " +
      language +
      "_all_auth_actions_single_flight_before_and_after_render_stale_handlers_tabs_and_inputs_locked_owned_release_error_retry_validation_storage_and_redirect_preserved",
  );
}
console.log(
  "AUDIT: local_actual_auth_route_only; all_provider_and_SDK_calls_mocked; no_network_mail_accounts_password_changes_or_deployment",
);
