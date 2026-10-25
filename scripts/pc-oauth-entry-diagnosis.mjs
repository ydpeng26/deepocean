// Actual installed provider SDK in a synthetic top-level window; no browser/network.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const sdkSource = fs.readFileSync(
  new URL("../node_modules/@lovable.dev/cloud-auth-js/dist/index.js", import.meta.url),
  "utf8",
);
const integration = fs.readFileSync(
  new URL("../src/integrations/lovable/index.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile("integration.ts", integration, ts.ScriptTarget.Latest, true);
let defaultBroker = false;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "createLovableAuth")
    defaultBroker = node.arguments.length === 0;
  ts.forEachChild(node, visit);
}
visit(ast);
assert(defaultBroker, "diagnosis expects existing default broker configuration");
const module = { exports: {} };
const window = { location: { origin: "https://example.invalid", href: "" } };
window.self = window;
window.top = window;
vm.runInNewContext(
  ts.transpileModule(sdkSource, { compilerOptions: { module: 1, target: 9 } }).outputText,
  {
    module,
    exports: module.exports,
    window,
    navigator: { userAgent: "Synthetic desktop", maxTouchPoints: 0 },
    URLSearchParams,
  },
);
const result = await module.exports
  .createLovableAuth()
  .signInWithOAuth("google", { redirect_uri: "https://example.invalid/dives" });
assert.equal(result.redirected, true);
assert.equal(result.error, null);
const target = new URL(window.location.href, window.location.origin);
assert.equal(target.origin, window.location.origin);
assert.equal(target.pathname, "/~oauth/initiate");
assert.equal(target.searchParams.get("provider"), "google");
assert.equal(target.searchParams.get("redirect_uri"), "https://example.invalid/dives");
assert(target.searchParams.get("state"));
console.log(
  "FINDING: actual_default_provider_SDK_normal_top_level_flow_navigates_to_same_site_oauth_initiate_endpoint_and_returns_redirected_before_any_session_save",
);
console.log(
  "AUDIT: local_source_diagnosis_only_no_network_real_authorization_accounts_credentials_storage_or_deployment_changes; live_HTTP_status_is_separate_readonly_preflight_evidence",
);
