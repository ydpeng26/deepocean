// Actual worker and update observer, isolated model; no network/browser/user data.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://offline-fixture.invalid', stores = new Map();
const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
let offline = false, assets = ['/assets/old.js'], windows = [{}], failure = false;
const caches = {
  keys: async () => [...stores.keys()], delete: async name => stores.delete(name),
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return { match: async request => map.get(key(request))?.clone(),
      put: async (request, response) => { map.set(key(request), response.clone()); },
      async addAll(urls) { const responses = await Promise.all(urls.map(network)); responses.forEach((r, i) => map.set(key(urls[i]), r)); } };
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
      skipWaiting: async () => { state.skipped = true; },
      clients: { matchAll: async options => { assert.equal(options.includeUncontrolled, true); return windows; }, claim: async () => { state.claimed = true; } } },
    caches, fetch: network, URL, Response,
  });
  return { state, async event(name) { let pending; events[name]({ waitUntil(value) { pending = value; } }); await pending; },
    async fetch(path, mode = 'cors', method = 'GET') { let pending; events.fetch({ request: { url: new URL(path, origin).href, mode, method }, respondWith(value) { pending = value; } }); return pending; } };
}
const old = worker('old'); await old.event('install'); await old.event('activate');
assert.equal(old.state.skipped, false); assert.equal(old.state.claimed, true);
offline = true; assert.equal((await old.fetch('/assets/old.js')).status, 200);
assert.equal((await old.fetch('/missing', 'navigate')).status, 200);
assert.equal(await old.fetch('https://outside.invalid/private'), undefined);
assert.equal(await old.fetch('/private', 'cors', 'POST'), undefined);
console.log('PASS: actual_worker_initial_install_control_offline_assets_navigation_and_request_scope');
offline = false; failure = true; const failed = worker('failed'); await assert.rejects(failed.event('install'));
assert.equal(failed.state.skipped, false); assert(stores.has('supdiver-offline-old'));
failure = false; assets = ['/assets/new.js']; const next = worker('new'); await next.event('install');
assert.equal(next.state.skipped, false); assert(stores.has('supdiver-offline-old'));
offline = true; assert.equal((await old.fetch('/assets/old.js')).status, 200);
console.log('PASS: failed_or_waiting_update_cannot_force_activation_or_remove_old_chunks');
// Defensive activation with an uncontrolled/legacy window retains older resources.
await next.event('activate'); assert(stores.has('supdiver-offline-old'));
assert.equal((await next.fetch('/assets/old.js')).status, 200);
assert.equal((await next.fetch('/assets/new.js')).status, 200);
const unrelated = await caches.open('unrelated-cache'); await unrelated.put('/assets/private.js', new Response('No'));
await assert.rejects(next.fetch('/assets/private.js'));
console.log('PASS: live_window_activation_retains_old_cache_hashed_asset_fallback_excludes_unrelated_caches');
windows = []; offline = false; assets = ['/assets/final.js']; const final = worker('final');
await final.event('install'); await final.event('activate');
assert(!stores.has('supdiver-offline-old') && !stores.has('supdiver-offline-new'));
assert(stores.has('supdiver-offline-final') && stores.has('unrelated-cache'));
console.log('PASS: only_windowless_activation_retires_old_app_caches_never_other_storage');
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) { const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name, list); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(f => f !== fn)); }
  emit(name) { for (const fn of this.listeners.get(name) ?? []) fn(); }
}
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/offline-updates.ts', import.meta.url), 'utf8'), { compilerOptions: { module: 1, target: 9 } }).outputText,
  { module, exports: module.exports });
const { watchOfflineUpdates } = module.exports;
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function registration() { const r = new Events(); r.waiting = null; r.installing = null; r.update = async () => { throw Error('Offline check'); }; return r; }
let notified = 0; const r = registration(), container = { controller: {}, register: async (url, opts) => { assert.equal(url, '/sw.js'); assert.equal(opts.updateViaCache, 'none'); return r; } };
const stop = watchOfflineUpdates(container, () => notified++); await tick();
const installing = new Events(); installing.state = 'installing'; r.installing = installing; r.emit('updatefound');
assert.equal(notified, 0); installing.state = 'installed'; installing.emit('statechange'); assert.equal(notified, 1);
stop(); installing.emit('statechange'); r.emit('updatefound'); assert.equal(notified, 1);
assert.equal(r.listeners.get('updatefound').length, 0); assert.equal(installing.listeners.get('statechange').length, 0);
r.waiting = {}; const stopWaiting = watchOfflineUpdates(container, () => notified++); await tick(); assert.equal(notified, 2); stopWaiting();
const stopEarly = watchOfflineUpdates(container, () => notified++); stopEarly(); await tick(); assert.equal(notified, 2);
const first = registration(); first.waiting = {}; const stopFirst = watchOfflineUpdates({ controller: null, register: async () => first }, () => notified++);
await tick(); assert.equal(notified, 2); stopFirst();
const stopFailure = watchOfflineUpdates({ register: async () => { throw Error('Registration failure'); } }, () => notified++); await tick(); stopFailure();
console.log('PASS: actual_update_observer_waiting_install_first_install_errors_unmount_and_listener_cleanup_without_reload');
const notice = fs.readFileSync(new URL('../src/components/OfflineUpdateNotice.tsx', import.meta.url), 'utf8');
assert(!/location\.reload|skipWaiting|postMessage|indexedDB|caches\.delete/.test(notice));
assert(notice.includes('未保存的输入不会自动保存') && notice.includes('Unsaved input is not saved automatically'));
let cursor = 0, language = 'zh-CN', readyCallback, unmounted = false;
const cells = [], effects = [], cleanups = [];
const jsx = (type, props) => ({ type, props });
const componentModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(notice.replaceAll('import.meta.env', '({PROD:true})'), { compilerOptions: { module: 1, target: 9, jsx: 4 } }).outputText,
  { module: componentModule, exports: componentModule.exports, navigator: { serviceWorker: {} }, require(name) {
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = value; }]; },
      useEffect(fn) { const i = cursor++; if (!(i in cells)) { cells[i] = true; effects.push(fn); } },
    };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language }) };
    if (name === '@/lib/offline-updates') return { watchOfflineUpdates: (_container, callback) => { readyCallback = callback; return () => { unmounted = true; }; } };
    throw Error('Unexpected import');
  } });
function render() { cursor = 0; const tree = componentModule.exports.OfflineUpdateNotice(); effects.splice(0).forEach(fn => cleanups.push(fn())); return tree; }
function nodes(tree, out = []) { if (Array.isArray(tree)) tree.forEach(n => nodes(n, out)); else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children, out); } return out; }
assert.equal(render(), null); readyCallback();
assert(nodes(render()).some(n => n.props.role === 'status' && n.props.children.includes('先保存当前输入')));
language = 'en'; assert(nodes(render()).some(n => n.props.role === 'status' && n.props.children.includes('Save your work')));
nodes(render()).find(n => n.type === 'button').props.onClick(); assert.equal(render(), null);
cleanups.forEach(fn => fn?.()); assert(unmounted);
console.log('PASS: actual_notice_readiness_bilingual_warning_dismissal_and_observer_cleanup_no_activation_action');
console.log('AUDIT: local_worker_and_observer_models_passed; real_two_release_browser_acceptance_pending');
