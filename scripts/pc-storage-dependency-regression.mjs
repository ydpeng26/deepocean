import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
import { supabaseStorageCompat } from "./lib/supabase-storage-compat.mjs";

const path = new URL("../node_modules/@supabase/auth-js/dist/module/lib/locks.js", import.meta.url);
const original = fs.readFileSync(path, "utf8");
const plugin = supabaseStorageCompat();
const patched = plugin.transform(original, path.pathname).code;
const run = (source, mode) => {
  const module = { exports: {} };
  const localStorage = {
    getItem() {
      if (mode === "read") throw new DOMException("synthetic denied", "SecurityError");
      return mode === "enabled" ? "true" : null;
    },
  };
  const globals = {
    module,
    exports: module.exports,
    require: () => ({ supportsLocalStorage: () => true }),
    DOMException,
  };
  Object.defineProperty(globals, "localStorage", {
    get() {
      if (mode === "getter") throw new DOMException("synthetic denied", "SecurityError");
      return localStorage;
    },
  });
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: 1, target: 9 } }).outputText,
    globals,
  );
  return module.exports;
};
assert.throws(
  () => run(original, "read"),
  (error) => error.name === "SecurityError",
);
for (const mode of ["read", "getter", "normal"])
  assert.equal(run(patched, mode).internals.debug, false);
assert.equal(run(patched, "enabled").internals.debug, true);
assert.equal(typeof run(patched, "normal").navigatorLock, "function");
assert.equal(typeof run(patched, "normal").processLock, "function");
assert.equal(plugin.transform(original, "/unrelated/locks.js"), null);
assert.throws(() => plugin.transform("changed dependency", path.pathname), /target changed/);
assert.equal(
  patched.replace(
    /debug: \(\(\) => \{ try \{ return ([\s\S]*?); \} catch \{ return false; \} \}\)\(\)/,
    "debug: $1",
  ),
  original,
);
console.log(
  "PASS: installed_auth_dependency_module_reproduces_read_denial_guard_contains_optional_debug_read_only_preserves_lock_exports_and_fails_on_source_drift",
);
