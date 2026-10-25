// Historical diagnosis of release 40e1c25/installed SDK. No real requests/accounts/mail.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
const historical = (file) =>
  execFileSync("git", ["show", "40e1c25:" + file], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });

const regressionUrl = new URL("./pc-auth-action-regression.mjs", import.meta.url);
const source = historical("scripts/pc-auth-action-regression.mjs");
const ast = ts.createSourceFile(
  "harness.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
// Reuse the actual-route harness, without running its unrelated test loops.
const firstLoop = ast.statements.find((node) => ts.isForOfStatement(node));
assert(firstLoop);
let prefix = source.slice(0, firstLoop.getStart(ast));
for (const node of [...ast.statements].reverse()) {
  if (ts.isImportDeclaration(node) && node.end < firstLoop.pos)
    prefix = prefix.slice(0, node.getStart(ast)) + prefix.slice(node.end);
}
prefix = prefix.replaceAll("import.meta.url", JSON.stringify(regressionUrl.href));
const scope = {
  fs: {
    ...fs,
    readFileSync(file, ...args) {
      return String(file).endsWith("/src/routes/auth.tsx")
        ? historical("src/routes/auth.tsx")
        : fs.readFileSync(file, ...args);
    },
  },
  vm,
  ts,
  assert,
  URL,
  setImmediate,
  console,
};
vm.runInNewContext(prefix + "\nglobalThis.makeHarness = harness;", scope);

const route = historical("src/routes/auth.tsx");
const client = historical("src/integrations/supabase/client.ts");
assert(!/setTimeout|AbortController|AbortSignal|Promise\.race/.test(route));
assert(!/setTimeout|AbortController|AbortSignal|Promise\.race/.test(client));
for (const language of ["zh-CN", "en"]) {
  for (const view of ["signin", "signup"]) {
    for (const owner of ["submit", "aux"]) {
      const h = scope.makeHarness(language);
      if (view === "signup") await h.signupReady();
      const held = h.defer("returned");
      let settled = false;
      const pending = h
        .handlers()
        [owner]()
        .finally(() => {
          settled = true;
        });
      await new Promise((resolve) => setImmediate(resolve));
      h.assertBusy(true);
      assert.equal(settled, false);
      for (const handler of Object.values(h.handlers())) await handler();
      assert.equal(h.calls.length, 1);
      held.resolve();
      await pending;
      h.assertBusy(false);
      console.log(
        "FINDING: " +
          language +
          "_" +
          view +
          "_" +
          owner +
          "_pending_request_holds_all_account_controls_until_request_settles_no_route_deadline",
      );
    }
  }
}

for (const kind of ["signin", "signup", "resend", "reset"]) {
  let release, observed;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const sdk = createClient("https://synthetic-pending.supabase.co", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (_url, init) => {
        observed = init;
        return held;
      },
    },
  });
  const email = "synthetic-pending@example.invalid";
  const password = "Synthetic-pending-only-726";
  const pending =
    kind === "signin"
      ? sdk.auth.signInWithPassword({ email, password })
      : kind === "signup"
        ? sdk.auth.signUp({ email, password })
        : kind === "resend"
          ? sdk.auth.resend({ type: "signup", email })
          : sdk.auth.resetPasswordForEmail(email);
  await new Promise((resolve) => setImmediate(resolve));
  assert(observed);
  assert.equal(observed.signal, undefined);
  release(
    new Response(JSON.stringify({ msg: "Synthetic pending diagnosis rejection" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }),
  );
  assert((await pending).error);
  console.log(
    "PASS: installed_SDK_" +
      kind +
      "_mock_fetch_receives_no_cancellation_signal_and_releases_on_modeled_response",
  );
}
console.log(
  "LIMIT: no real browser/network stall duration was measured; browser transport may eventually fail on its own. This diagnosis establishes missing application-defined deadline, not an observed infinite production outage.",
);
console.log(
  "AUDIT: local_diagnosis_complete=true; no_application_changes_deployment_network_real_accounts_mail_or_existing_data_changes",
);
