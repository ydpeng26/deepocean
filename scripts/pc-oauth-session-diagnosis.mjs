// Diagnosis only: actual adapter and auth UI with synthetic SDK results; no OAuth/network.
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const sdk = createClient("https://example.invalid", "synthetic-public-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch() {
      throw Error("Network forbidden");
    },
  },
});
const invalid = await sdk.auth.setSession({
  access_token: "synthetic-invalid",
  refresh_token: "synthetic-invalid",
});
assert(invalid.error);
assert.equal(invalid.data.session, null);
sdk.auth.stopAutoRefresh();
console.log(
  "PASS: installed_SDK_setSession_can_resolve_with_error_and_null_session_without_throwing_or_network",
);

function load(file, require, globals = {}) {
  const module = { exports: {} };
  // Preserve historical diagnosis rather than silently testing the repaired app.
  const source = execFileSync("git", ["show", `cf123a6:${file}`], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  }).replaceAll("import.meta.env", "({PROD:false})");
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    { module, exports: module.exports, require, URL, console: { error() {} }, ...globals },
  );
  return module.exports;
}
const jsx = (type, props) => ({ type, props });
const nodes = (n) =>
  Array.isArray(n)
    ? n.flatMap(nodes)
    : n && typeof n === "object"
      ? [n, ...nodes(n.props?.children)]
      : [];
for (const mode of ["returned-error", "thrown-error", "normal", "provider-error", "redirected"]) {
  let saved = 0,
    navigated = 0,
    toasts = 0,
    cursor = 0;
  const cells = [];
  const tokens = { access_token: "synthetic-only", refresh_token: "synthetic-only" };
  const providerError = new Error("synthetic provider refusal");
  const adapter = load("src/integrations/lovable/index.ts", (name) =>
    name === "@lovable.dev/cloud-auth-js"
      ? {
          createLovableAuth: () => ({
            signInWithOAuth: async () =>
              mode === "provider-error"
                ? { error: providerError }
                : mode === "redirected"
                  ? { redirected: true }
                  : { tokens },
          }),
        }
      : {
          supabase: {
            auth: {
              setSession: async () => {
                saved++;
                if (mode === "thrown-error") throw new Error("synthetic session refusal");
                return mode === "returned-error"
                  ? invalid
                  : { data: { session: { user: { id: "synthetic-id" } } }, error: null };
              },
            },
          },
        },
  ).lovable;
  const result = await adapter.auth.signInWithOAuth("google");
  if (mode === "returned-error")
    assert(!result.error, "diagnosis expects currently ignored returned session error");
  if (mode === "thrown-error" || mode === "provider-error") assert(result.error);
  if (mode === "redirected") assert.equal(saved, 0);
  const react = {
    useEffect() {},
    useRef: (value) => ({ current: value }),
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
  const route = load(
    "src/routes/auth.tsx",
    (name) =>
      name === "react"
        ? react
        : name === "react/jsx-runtime"
          ? { jsx, jsxs: jsx }
          : name === "@tanstack/react-router"
            ? {
                createFileRoute: () => (options) => ({ ...options, useSearch: () => ({}) }),
                useNavigate: () => () => {
                  navigated++;
                },
              }
            : name === "@/i18n/LanguageProvider"
              ? { useLanguage: () => ({ language: "en" }) }
              : name === "@/i18n/liveCopy"
                ? { useLiveCopy() {} }
                : name === "@/hooks/useAuthStorageStatus"
                  ? { useAuthStorageStatus: () => "available" }
                  : name === "@/lib/tab-auth-storage"
                    ? { authStorageAvailable: () => true }
                    : name === "@/integrations/lovable"
                      ? { lovable: adapter }
                      : name === "@/integrations/supabase/client"
                        ? { supabase: { auth: {} } }
                        : name === "sonner"
                          ? {
                              toast: {
                                dismiss() {},
                                error() {
                                  toasts++;
                                },
                                success() {},
                              },
                            }
                          : name === "@/lib/password-recovery"
                            ? { passwordRecoveryEnabled: true }
                            : name === "@/lib/auth-return"
                              ? { safeAuthReturn: () => undefined }
                              : {},
    { window: { location: { origin: "https://example.invalid" } } },
  ).Route;
  const render = () => {
    cursor = 0;
    return nodes(route.component());
  };
  await render()
    .find((n) => n.props?.className === "do-auth-google")
    .props.onClick();
  const button = render().find((n) => n.props?.className === "do-auth-google");
  if (mode === "returned-error") {
    assert.equal(navigated, 1);
    assert.equal(toasts, 0);
    assert.equal(button.props.disabled, true);
    console.log(
      "FINDING: actual_OAuth_adapter_ignores_returned_setSession_error_actual_auth_UI_navigates_without_session_error_toast_and_stays_busy",
    );
  } else if (mode === "thrown-error" || mode === "provider-error") {
    assert.equal(navigated, 0);
    assert.equal(toasts, 1);
    assert.equal(button.props.disabled, false);
  } else if (mode === "normal") assert.equal(navigated, 1);
  else assert.equal(navigated, 0);
}
console.log(
  "PASS: normal_adapter_completion_provider_error_thrown_session_failure_and_redirected_branches_modeled",
);
console.log(
  "AUDIT: diagnosis_only; synthetic_tokens; no_network_real_Google_authorization_accounts_mail_deployment_or_production_changes; no_auth_bypass_claim",
);
