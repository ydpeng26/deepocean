// Historical diagnosis at formal 1d1c3cc; actual UI + synthetic SDK results.
// No browser, network, mail, account, deployment or application mutation.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const jsx = (type, props) => ({ type, props });
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
function load(file, deps, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      file === "src/routes/auth-confirmed.tsx"
        ? execFileSync("git", ["show", "1d1c3cc:src/routes/auth-confirmed.tsx"], {
            encoding: "utf8",
          })
        : fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      {
        compilerOptions: { module: 1, jsx: 4, target: 9 },
      },
    ).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => deps[name] ?? {},
      URL,
      URLSearchParams,
      ...globals,
    },
  );
  return module.exports;
}
const returns = load("src/lib/auth-return.ts", {});
const existing = { user: { id: "synthetic-existing-owner" } };
function harness(language, mode) {
  let state,
    effect,
    timer,
    listener,
    resolveVerification,
    calls = 0;
  const pending = new Promise((resolve) => {
    resolveVerification = resolve;
  });
  const react = {
    useState: (initial) => {
      state ??= initial;
      return [
        state,
        (value) => {
          state = value;
        },
      ];
    },
    useEffect: (fn) => {
      effect = fn;
    },
  };
  const auth = {
    onAuthStateChange: (fn) => {
      listener = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    getSession: async () => ({
      data: { session: mode === "existing-without-link" ? existing : null },
      error: null,
    }),
    verifyOtp: async () => {
      calls++;
      if (mode === "throws") throw Error("synthetic-confirmation-failure");
      return pending;
    },
    exchangeCodeForSession: async () => {
      throw Error("No exchange expected in these cases");
    },
  };
  const module = load(
    "src/routes/auth-confirmed.tsx",
    {
      react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@tanstack/react-router": {
        createFileRoute: () => (config) => ({ ...config, useSearch: () => ({}) }),
        Link: "link",
        useNavigate: () => () => {},
      },
      "@/integrations/supabase/client": { supabase: { auth } },
      "@/i18n/LanguageProvider": { useLanguage: () => ({ language }) },
      "@/lib/auth-return": returns,
    },
    {
      window: {
        location: {
          search: mode === "existing-without-link" ? "" : "?token_hash=synthetic-only",
          hash: "",
        },
        setTimeout: (fn) => {
          timer = fn;
          return 1;
        },
        clearTimeout() {},
      },
    },
  );
  function title() {
    const tree = module.Route.component();
    return nodes(tree).find((n) => n.type === "h1").props.children;
  }
  title();
  const cleanup = effect();
  return {
    title,
    cleanup,
    emitExisting: () => listener("INITIAL_SESSION", existing),
    resolveVerification,
    timeout: () => timer(),
    get calls() {
      return calls;
    },
  };
}
for (const language of ["zh-CN", "en"]) {
  const success = language === "en" ? "Email confirmed" : "邮箱验证成功";
  const checking = language === "en" ? "Confirming your email" : "正在确认邮箱";
  const error =
    language === "en" ? "This confirmation link is invalid or expired" : "验证链接无效或已过期";
  {
    const h = harness(language, "pending-invalid");
    assert.equal(h.title(), checking);
    assert.equal(h.calls, 1);
    h.emitExisting();
    assert.equal(h.title(), success);
    h.resolveVerification({ data: { session: null }, error: Error("synthetic invalid link") });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.title(), success);
    h.timeout();
    assert.equal(h.title(), success);
    h.cleanup();
  }
  {
    const h = harness(language, "existing-without-link");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.title(), success);
    assert.equal(h.calls, 0);
    h.cleanup();
  }
  {
    const h = harness(language, "pending-invalid");
    h.resolveVerification({ data: { session: null }, error: Error("synthetic invalid link") });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.title(), error);
    h.cleanup();
  }
}
console.log(
  "FINDING: actual_email_confirmation_old_session_event_reports_success_while_current_link_pending_and_keeps_success_after_verification_rejects_in_both_languages",
);
console.log(
  "CONTROL: invalid_link_without_session_event_reports_error; existing_session_without_link_reports_success_without_verification",
);
const rejected = [];
const onUnhandled = (error) => {
  if (error?.message === "synthetic-confirmation-failure") rejected.push(true);
  else throw error;
};
process.on("unhandledRejection", onUnhandled);
try {
  const h = harness("en", "throws");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rejected.length, 1);
  assert.equal(h.title(), "Confirming your email");
  h.timeout();
  assert.equal(h.title(), "This confirmation link is invalid or expired");
  h.cleanup();
} finally {
  process.off("unhandledRejection", onUnhandled);
}
console.log(
  "FINDING: actual_email_confirmation_thrown_verification_escapes_as_unhandled_rejection_and_stays_checking_until_timeout",
);
console.log(
  "AUDIT: local_source_diagnosis_only_no_network_real_links_users_mail_secrets_user_data_application_edits_or_deployment_changes",
);
