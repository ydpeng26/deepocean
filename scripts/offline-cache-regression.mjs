// Actual worker and update observer, isolated model; no network/browser/user data.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const source = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://offline-fixture.invalid",
  stores = new Map();
const key = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
let offline = false,
  assets = ["/assets/old.js"],
  windows = [{}],
  failure = false;
const caches = {
  keys: async () => [...stores.keys()],
  delete: async (name) => stores.delete(name),
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      match: async (request) => map.get(key(request))?.clone(),
      put: async (request, response) => {
        map.set(key(request), response.clone());
      },
      async addAll(urls) {
        const responses = await Promise.all(urls.map(network));
        responses.forEach((r, i) => map.set(key(urls[i]), r));
      },
    };
  },
};
async function network(request) {
  if (offline || failure) throw Error("Synthetic network unavailable");
  return key(request).endsWith("/offline-assets.json")
    ? Response.json(assets)
    : new Response("Synthetic asset");
}
function worker(version) {
  const events = {},
    state = { skipped: false, claimed: false };
  vm.runInNewContext(source.replace("__BUILD_ID__", version), {
    self: {
      location: { origin },
      addEventListener: (name, fn) => {
        events[name] = fn;
      },
      skipWaiting: async () => {
        state.skipped = true;
      },
      clients: {
        matchAll: async (options) => {
          assert.equal(options.includeUncontrolled, true);
          return windows;
        },
        claim: async () => {
          state.claimed = true;
        },
      },
    },
    caches,
    fetch: network,
    URL,
    Response,
  });
  return {
    state,
    async event(name) {
      let pending;
      events[name]({
        waitUntil(value) {
          pending = value;
        },
      });
      await pending;
    },
    async fetch(path, mode = "cors", method = "GET") {
      let pending;
      events.fetch({
        request: { url: new URL(path, origin).href, mode, method },
        respondWith(value) {
          pending = value;
        },
      });
      return pending;
    },
  };
}
const old = worker("old");
await old.event("install");
await old.event("activate");
assert.equal(old.state.skipped, true);
assert.equal(old.state.claimed, true);
offline = true;
assert.equal((await old.fetch("/assets/old.js")).status, 200);
assert.equal((await old.fetch("/missing", "navigate")).status, 200);
assert.equal(await old.fetch("https://outside.invalid/private"), undefined);
assert.equal(await old.fetch("/private", "cors", "POST"), undefined);
console.log(
  "PASS: actual_worker_initial_install_control_offline_assets_navigation_and_request_scope",
);
offline = false;
failure = true;
const failed = worker("failed");
await assert.rejects(failed.event("install"));
assert.equal(failed.state.skipped, false);
assert(stores.has("supdiver-offline-old"));
failure = false;
assets = ["/assets/new.js"];
const next = worker("new");
await next.event("install");
assert.equal(next.state.skipped, true);
assert(stores.has("supdiver-offline-old"));
offline = true;
assert.equal((await old.fetch("/assets/old.js")).status, 200);
console.log(
  "PASS: complete_update_activates_silently_failed_install_does_not_activate_or_remove_old_chunks",
);
// Defensive activation with an uncontrolled/legacy window retains older resources.
await next.event("activate");
assert(stores.has("supdiver-offline-old"));
assert.equal((await next.fetch("/assets/old.js")).status, 200);
assert.equal((await next.fetch("/assets/new.js")).status, 200);
const unrelated = await caches.open("unrelated-cache");
await unrelated.put("/assets/private.js", new Response("No"));
await assert.rejects(next.fetch("/assets/private.js"));
console.log(
  "PASS: live_window_activation_retains_old_cache_hashed_asset_fallback_excludes_unrelated_caches",
);
windows = [];
offline = false;
assets = ["/assets/final.js"];
const final = worker("final");
await final.event("install");
await final.event("activate");
assert(!stores.has("supdiver-offline-old") && !stores.has("supdiver-offline-new"));
assert(stores.has("supdiver-offline-final") && stores.has("unrelated-cache"));
console.log("PASS: only_windowless_activation_retires_old_app_caches_never_other_storage");
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(new URL("../src/lib/offline-updates.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: 1, target: 9 } },
  ).outputText,
  { module, exports: module.exports },
);
const { watchOfflineUpdates } = module.exports;
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
let updates = 0;
const container = {
  register: async (url, opts) => {
    assert.equal(url, "/sw.js");
    assert.equal(opts.updateViaCache, "none");
    return {
      update: async () => {
        updates++;
        throw Error("Offline");
      },
    };
  },
};
const stop = watchOfflineUpdates(container);
await tick();
assert.equal(updates, 1);
stop();
const stopEarly = watchOfflineUpdates(container);
stopEarly();
await tick();
assert.equal(updates, 1);
const stopFailure = watchOfflineUpdates({
  register: async () => {
    throw Error("Registration failure");
  },
});
await tick();
stopFailure();
console.log(
  "PASS: background_registration_and_update_failures_are_quiet_and_unmount_stops_followup",
);
const notice = fs.readFileSync(
  new URL("../src/components/OfflineUpdateNotice.tsx", import.meta.url),
  "utf8",
);
assert(
  !/location\.reload|skipWaiting|postMessage|indexedDB|caches\.delete|新版本已准备好|An update is ready/.test(
    notice,
  ),
);
let unmounted = false,
  registered = 0;
const effects = [],
  componentModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(notice.replaceAll("import.meta.env", "({PROD:true})"), {
    compilerOptions: { module: 1, target: 9, jsx: 4 },
  }).outputText,
  {
    module: componentModule,
    exports: componentModule.exports,
    navigator: { serviceWorker: {} },
    require(name) {
      if (name === "react")
        return {
          useEffect(fn) {
            effects.push(fn);
          },
        };
      if (name === "@/lib/offline-updates")
        return {
          watchOfflineUpdates: () => {
            registered++;
            return () => {
              unmounted = true;
            };
          },
        };
      throw Error("Unexpected import");
    },
  },
);
assert.equal(componentModule.exports.OfflineUpdateNotice(), null);
const cleanups = effects.map((fn) => fn());
assert.equal(registered, 1);
cleanups.forEach((fn) => fn?.());
assert(unmounted);
console.log("PASS: actual_root_update_component_has_no_notice_no_reload_and_registration_cleanup");
console.log(
  "AUDIT: isolated_worker_and_background_update_models_passed; real_browser_lifecycle_not_run_locally",
);
