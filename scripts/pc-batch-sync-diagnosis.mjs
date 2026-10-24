// Actual current API/component, deterministic storage/auth/API models only.
// No browser, backend credentials, network requests or real data mutations.
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
const clone = value => value === undefined ? undefined : structuredClone(value);
const tick = () => new Promise(resolve => setImmediate(resolve));
const baseline = '9ac9a990c0595f77dcabfbd5cedfc96f4c4defea';
function load(path, require, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(execFileSync('git', ['show', baseline + ':' + path], { encoding: 'utf8' }), { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    { module, exports: module.exports, require, crypto: webcrypto, fetch() { throw Error('Network forbidden'); }, ...globals });
  return module.exports;
}
const stored = new Map(), queue = []; let active = false;
function drain() { if (!active && queue.length) { active = true; queue.shift()(); } }
const indexedDB = { open() { const request = {}; setImmediate(() => {
  request.result = { close() {}, transaction() {
    let view, started = false, finished = false, pending = 0; const operations = [], tx = {};
    function finish(abort = false) { if (finished) return; finished = true;
      if (!abort) { stored.clear(); view.forEach((v, k) => stored.set(k, v)); }
      setImmediate(() => { if (abort) tx.onabort?.(); else tx.oncomplete?.(); active = false; drain(); }); }
    function op(fn) { const r = {}; pending++; const run = () => { if (finished) return; r.result = clone(fn()); r.onsuccess?.(); pending--;
      if (!pending && !finished) setImmediate(() => { if (!pending && !finished) finish(); }); };
      if (started) setImmediate(run); else operations.push(run); return r; }
    tx.abort = () => finish(true); tx.objectStore = () => ({ getAll: () => op(() => [...view.values()]), get: id => op(() => view.get(id)),
      put: row => op(() => { view.set(row.id, clone(row)); return row.id; }), delete: id => op(() => view.delete(id)) });
    queue.push(() => { view = new Map([...stored].map(([k,v]) => [k,clone(v)])); started = true; operations.forEach(fn => setImmediate(fn)); }); drain(); return tx;
  } }; request.onsuccess?.(); }); return request; } };
const rows = new Map(); let gateA, gateB, authReads = 0;
function api(label) {
  const state = { owner: 'synthetic-A', attempts: [], committed: [], denied: [], afterCommit: null };
  const supabase = { auth: { getUser: async () => { authReads++; return { data: { user: { id: state.owner } } }; } },
    from() { let body, filters = []; const q = { insert(value) { body = value; return q; }, select() { return q; }, eq(k,v) { filters.push([k,v]); return q; },
      maybeSingle: async () => ({ data: clone([...rows.values()].find(row => row.user_id === state.owner && filters.every(([k,v]) => row[k] === v))) ?? null, error: null }),
      then(resolve, reject) { return (async () => {
        state.attempts.push(clone(body)); if (label === 'A') await gateA?.(); if (label === 'B') await gateB?.();
        // Model owner-scoped insert/read RLS, do not claim live policy acceptance.
        if (body.user_id !== state.owner) { state.denied.push(body.id); return { error: { code: '42501', message: 'Synthetic RLS rejected mismatched account' } }; }
        if (rows.has(body.id)) return { error: { code: '23505' } };
        rows.set(body.id, clone(body)); state.committed.push(body.id); await state.afterCommit?.(body); return { error: null };
      })().then(resolve, reject); } }; return q;
    } };
  return { state, module: load('src/lib/offline-dives.ts', () => ({ supabase }), { indexedDB, navigator: { onLine: true } }) };
}
const a = api('A'), b = api('B');
const fields = { ...a.module.emptyOfflineDive(), country: 'Indonesia', site_name: 'SYNTHETIC-BATCH', notes: 'synthetic' };
await a.module.saveOfflineDive(fields);
await assert.rejects(a.module.syncOfflineDives(undefined, { expectedUserId: 'wrong' }));
assert.equal(stored.size, 1); assert.equal(rows.size, 0);
console.log('PASS: initial_account_mismatch_rejects_before_any_cloud_write_or_local_removal');
stored.clear(); rows.clear(); authReads = 0;
await a.module.saveOfflineDive({ ...fields, site_name: 'First' }); await a.module.saveOfflineDive({ ...fields, site_name: 'Second' });
a.state.afterCommit = () => { a.state.owner = 'synthetic-B'; };
const switched = await a.module.syncOfflineDives(undefined, { expectedUserId: 'synthetic-A' });
assert.equal(a.state.committed.length, 1); assert.equal(a.state.denied.length, 1); assert.equal(authReads, 1);
assert.equal(stored.size, 1); assert([...rows.values()].every(row => row.user_id === 'synthetic-A'));
console.log('PASS: modeled_RLS_prevents_cross_account_insert_and_rejected_draft_remains_no_B_record');
console.log('FINDING: batch_rechecks_account_only_once_and_still_attempts_remaining_A_payload_after_session_changes_to_B');
stored.clear(); rows.clear(); a.state.owner = b.state.owner = 'synthetic-A'; a.state.afterCommit = null;
const draft = await a.module.saveOfflineDive(fields);
let bEntered, releaseB; const atB = new Promise(resolve => { bEntered = resolve; }), afterA = new Promise(resolve => { releaseB = resolve; });
gateA = () => atB; gateB = async () => { bEntered(); await afterA; };
const first = a.module.syncOfflineDives(undefined, { selectedIds: [draft.id], expectedUserId: 'synthetic-A' });
const second = b.module.syncOfflineDives(undefined, { selectedIds: [draft.id], expectedUserId: 'synthetic-A' });
const resultA = await first; releaseB(); const resultB = await second;
assert.equal(resultA.synced, 1); assert.equal(rows.size, 1); assert.equal(stored.size, 0);
assert.equal(resultB.synced, 0); assert.equal(resultB.failures.length, 1); assert.match(resultB.failures[0], /新草稿仍保留/);
gateA = gateB = null;
console.log('PASS: concurrent_module_model_creates_one_cloud_row_without_overwrite_or_duplicate');
console.log('FINDING: second_tab_reports_modified_local_draft_retained_even_when_other_tab_already_synced_and_removed_it');
function nodes(tree, out = []) { if (Array.isArray(tree)) tree.forEach(v => nodes(v,out)); else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children,out); } return out; }
function content(tree) { if (Array.isArray(tree)) return tree.map(content).join(''); if (tree && typeof tree === 'object') return content(tree.props?.children); return tree == null ? '' : String(tree); }
function workspace() {
  let cursor = 0, authCallback, resolveSync; const cells = [], effects = [], cleanups = [], invalidations = [];
  const jsx = (type,props) => ({ type,props });
  const react = { useCallback: fn => fn, useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useEffect(fn) { const i = cursor++; if (!(i in cells)) { cells[i] = true; effects.push(fn); } } };
  const Component = load('src/components/OfflineSyncWorkspace.tsx', name => {
    if (name === 'react') return react; if (name === 'react/jsx-runtime') return { jsx,jsxs:jsx };
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async () => invalidations.push('invalidated') }) };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN',toggleLanguage() {} }) };
    if (name === '@/integrations/supabase/client') return { supabase: { auth: { onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } } } };
    if (name === '@/lib/offline-dives') return { listOfflineDives: async () => [draft], syncOfflineDives: () => new Promise(resolve => { resolveSync = resolve; }) };
    return new Proxy({}, { get: (_,key) => key });
  }, { navigator: { onLine: true }, Blob, window: { confirm: () => true, addEventListener() {}, removeEventListener() {} } }).OfflineSyncWorkspace;
  const h = { render() { cursor = 0; const tree = Component(); effects.splice(0).forEach(fn => cleanups.push(fn())); return tree; },
    account(id) { authCallback('SIGNED_IN', { user: { id,email:id+'@example.invalid' } }); }, finish() { resolveSync({ synced:1,total:1,failures:[] }); }, invalidations };
  h.render(); return h;
}
const h = workspace(); await tick(); h.account('synthetic-A');
nodes(h.render()).find(n => n.props['aria-label'] === '选择草稿 '+draft.site_name).props.onClick();
nodes(h.render()).find(n => n.props.className === 'do-sync-button').props.onClick();
h.account('synthetic-B'); h.finish(); await tick(); await tick();
const screen = content(h.render()); assert(screen.includes('synthetic-B@example.invalid')); assert(screen.includes('同步完成：1 条记录已保存到账号。')); assert.equal(h.invalidations.length,1);
console.log('FINDING: actual_sync_workspace_displays_A_success_beneath_current_B_account_after_pending_sync_resolves');
console.log('AUDIT: local_actual_source_models_complete=true findings=3; no_real_two_account_or_two_tab_browser_acceptance');
