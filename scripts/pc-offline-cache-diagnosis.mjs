// Executes the actual service worker in an isolated cache/network model.
// Cross-release model evidence, not a real deployed two-release browser test.
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = execFileSync('git', ['show', '2afc408bea57dd426a1e2c1f5ea44611bb2290cc:public/sw.js'], { encoding: 'utf8' });
const origin = 'https://offline-fixture.invalid', stores = new Map();
const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
let offline = false, assets = ['/assets/new.js'], failure = false;
const cacheStorage = {
  keys: async () => [...stores.keys()],
  delete: async name => stores.delete(name),
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      match: async request => map.get(key(request))?.clone(),
      put: async (request, response) => { map.set(key(request), response.clone()); },
      async addAll(urls) {
        const responses = await Promise.all(urls.map(url => network(url)));
        responses.forEach((response, index) => map.set(key(urls[index]), response));
      },
    };
  },
};
async function network(request) {
  if (offline || failure) throw Error('Synthetic network unavailable');
  return key(request).endsWith('/offline-assets.json') ? Response.json(assets) : new Response('Synthetic asset');
}
function worker(version) {
  const events = {}, state = { skipped: false, claimed: false };
  vm.runInNewContext(source.replace('__BUILD_ID__', version), {
    self: { location: { origin }, addEventListener: (name, fn) => { events[name] = fn; },
      skipWaiting: async () => { state.skipped = true; }, clients: { claim: async () => { state.claimed = true; } } },
    caches: cacheStorage, fetch: network, URL, Response,
  });
  return { state, async event(name) { let pending; events[name]({ waitUntil(value) { pending = value; } }); await pending; },
    async fetch(path, mode = 'cors', method = 'GET') { let pending;
      events.fetch({ request: { url: new URL(path, origin).href, mode, method }, respondWith(value) { pending = value; } });
      return pending;
    } };
}
const old = worker('old'); assets = ['/assets/old-lazy.js']; await old.event('install'); await old.event('activate');
assert(old.state.skipped && old.state.claimed);
offline = true; assert.equal((await old.fetch('/assets/old-lazy.js')).status, 200);
assert.equal((await old.fetch('/unvisited-path', 'navigate')).status, 200);
assert.equal(await old.fetch('https://outside.invalid/private'), undefined);
assert.equal(await old.fetch('/private', 'cors', 'POST'), undefined);
console.log('PASS: actual_worker_cached_asset_navigation_fallback_and_cross_origin_non_GET_bypass');
offline = false; failure = true;
const failed = worker('failed'); await assert.rejects(failed.event('install'));
assert.equal(failed.state.skipped, false); assert(stores.has('supdiver-offline-old'));
console.log('PASS: failed_install_does_not_skip_waiting_or_remove_active_old_cache');
failure = false; assets = ['/assets/new-lazy.js']; const next = worker('new');
await next.event('install'); await next.event('activate');
assert.equal(stores.has('supdiver-offline-old'), false);
offline = true;
await assert.rejects(next.fetch('/assets/old-lazy.js'));
console.log('FINDING: new_worker_immediately_claims_old_tabs_and_deletes_old_asset_cache_so_old_lazy_chunk_is_unavailable_offline');
assert.equal((await next.fetch('/assets/new-lazy.js')).status, 200);
console.log('PASS: new_release_own_cached_assets_remain_available');
console.log('AUDIT: local_actual_worker_model_complete=true findings=1; not_real_cross_release_browser_acceptance');
