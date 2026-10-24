// Actual current API/component, deterministic storage/auth/API models only.
// No browser, backend credentials, network requests or real data mutations.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
const clone = value => value === undefined ? undefined : structuredClone(value);
const tick = () => new Promise(resolve => setImmediate(resolve));
const baseline = '9ac9a990c0595f77dcabfbd5cedfc96f4c4defea';
const fixed = process.argv.includes('--fixed');
function load(path, require, globals = {}) {
  const module = { exports: {} };
  const source = fixed ? fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8') : execFileSync('git', ['show', baseline + ':' + path], { encoding: 'utf8' });
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
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
function api(label, locks) {
  const listeners = new Set();
  const state = { owner: 'synthetic-A', attempts: [], committed: [], denied: [], afterCommit: null,
    change(owner) { state.owner = owner; for (const cb of listeners) cb('SIGNED_IN', owner ? {user:{id:owner}} : null); }, listeners };
  const supabase = { auth: { onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } }; }, getUser: async () => { authReads++; return { data: { user: { id: state.owner } } }; } },
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
  return { state, module: load('src/lib/offline-dives.ts', () => ({ supabase }), { indexedDB, navigator: { onLine: true, locks } }) };
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
if (fixed) {
  await assert.rejects(a.module.syncOfflineDives(undefined, { expectedUserId: 'synthetic-A' }));
  assert.equal(a.state.attempts.length, 1); assert.equal(a.state.committed.length,1); assert.equal(stored.size,2); assert.equal(a.state.listeners.size,0);
  console.log('PASS: account_switch_after_committed_response_stops_remaining_batch_and_retains_unconfirmed_local_drafts');
} else {
const switched = await a.module.syncOfflineDives(undefined, { expectedUserId: 'synthetic-A' });
assert.equal(a.state.committed.length, 1); assert.equal(a.state.denied.length, 1); assert.equal(authReads, 1);
assert.equal(stored.size, 1); assert([...rows.values()].every(row => row.user_id === 'synthetic-A'));
console.log('PASS: modeled_RLS_prevents_cross_account_insert_and_rejected_draft_remains_no_B_record');
console.log('FINDING: batch_rechecks_account_only_once_and_still_attempts_remaining_A_payload_after_session_changes_to_B');
}
stored.clear(); rows.clear(); a.state.owner = b.state.owner = 'synthetic-A'; a.state.afterCommit = null;
const draft = await a.module.saveOfflineDive(fields);
let bEntered, releaseB; const atB = new Promise(resolve => { bEntered = resolve; }), afterA = new Promise(resolve => { releaseB = resolve; });
gateA = () => atB; gateB = async () => { bEntered(); await afterA; };
const first = a.module.syncOfflineDives(undefined, { selectedIds: [draft.id], expectedUserId: 'synthetic-A' });
const second = b.module.syncOfflineDives(undefined, { selectedIds: [draft.id], expectedUserId: 'synthetic-A' });
const resultA = await first; releaseB(); const resultB = await second;
assert.equal(resultA.synced, 1); assert.equal(rows.size, 1); assert.equal(stored.size, 0);
if (fixed) { assert.equal(resultB.synced,1); assert.equal(resultB.failures.length,0); }
else { assert.equal(resultB.synced, 0); assert.equal(resultB.failures.length, 1); assert.match(resultB.failures[0], /新草稿仍保留/); }
gateA = gateB = null;
console.log('PASS: concurrent_module_model_creates_one_cloud_row_without_overwrite_or_duplicate');
console.log(fixed ? 'PASS: verified_identical_cloud_record_and_absent_local_draft_reconcile_as_success_without_WebLocks' : 'FINDING: second_tab_reports_modified_local_draft_retained_even_when_other_tab_already_synced_and_removed_it');
if (fixed) {
  stored.clear(); rows.clear();
  const transient = api('transient'); await transient.module.saveOfflineDive(fields);
  transient.state.afterCommit = () => { transient.state.change('synthetic-B'); transient.state.change('synthetic-A'); };
  await assert.rejects(transient.module.syncOfflineDives()); assert.equal(stored.size,1); assert.equal(transient.state.listeners.size,0);
  const cancelled = api('cancelled'); await assert.rejects(cancelled.module.syncOfflineDives(undefined,{isCurrent:()=>false})); assert.equal(cancelled.state.attempts.length,0);
  const deniedLock = api('locked',{request:async(_name,options,fn)=>{assert.equal(options.ifAvailable,true);return fn(null);}});
  await assert.rejects(deniedLock.module.syncOfflineDives()); assert.equal(deniedLock.state.attempts.length,0);
  const allowedLock = api('unlocked',{request:async(_name,options,fn)=>fn({name:'synthetic-lock'})});
  assert.equal((await allowedLock.module.syncOfflineDives()).synced,1);
  console.log('PASS: transient_A_B_A_auth_change_cancels_pending_work_stale_operation_blocks_and_optional_origin_lock_fails_closed');
  stored.clear(); rows.clear(); const changed = api('changed'); const newer = await changed.module.saveOfflineDive(fields);
  changed.state.afterCommit = () => stored.set(newer.id,{...stored.get(newer.id),notes:'new local content',revision:'new-revision'});
  const changedResult = await changed.module.syncOfflineDives();
  assert.equal(changedResult.synced,0); assert.equal(changedResult.failures.length,1); assert.equal(stored.get(newer.id).notes,'new local content');
  for(const cloudOwner of ['synthetic-A','synthetic-B']) {
    stored.clear(); rows.clear(); const mismatch = api('mismatch'); const local = await mismatch.module.saveOfflineDive(fields);
    rows.set(local.id,{id:local.id,user_id:cloudOwner,notes:'different cloud content'});
    const result = await mismatch.module.syncOfflineDives(); assert.equal(result.synced,0); assert.equal(result.failures.length,1); assert.equal(stored.size,1);
    assert.equal(rows.get(local.id).notes,'different cloud content'); assert.equal(mismatch.state.listeners.size,0);
  }
  console.log('PASS: genuinely_changed_local_draft_different_cloud_payload_and_other_owner_duplicate_are_retained_without_overwrite');
}
function nodes(tree, out = []) { if (Array.isArray(tree)) tree.forEach(v => nodes(v,out)); else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children,out); } return out; }
function content(tree) { if (Array.isArray(tree)) return tree.map(content).join(''); if (tree && typeof tree === 'object') return content(tree.props?.children); return tree == null ? '' : String(tree); }
function workspace() {
  let cursor = 0, authCallback, resolveSync, rejectSync, unmounted = false, options; const cells = [], effects = [], cleanups = [], invalidations = [], lateWrites = [];
  const jsx = (type,props) => ({ type,props });
  const react = { useCallback: fn => fn, useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value; return [cells[i], value => { if(unmounted)lateWrites.push(i); cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useEffect(fn) { const i = cursor++; if (!(i in cells)) { cells[i] = true; effects.push(fn); } } };
  const Component = load('src/components/OfflineSyncWorkspace.tsx', name => {
    if (name === '@/i18n/liveCopy') return { useLiveCopy() {} };
    if (name === 'react') return react; if (name === 'react/jsx-runtime') return { jsx,jsxs:jsx };
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async () => invalidations.push('invalidated') }) };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN',toggleLanguage() {} }) };
    if (name === '@/integrations/supabase/client') return { supabase: { auth: { onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } } } };
    if (name === '@/lib/offline-dives') return { OfflineSyncBusy: a.module.OfflineSyncBusy, listOfflineDives: async () => [draft], syncOfflineDives: (_progress,opts) => { options=opts;return new Promise((resolve,reject) => { resolveSync = resolve; rejectSync=reject; }); } };
    return new Proxy({}, { get: (_,key) => key });
  }, { navigator: { onLine: true }, Blob, window: { confirm: () => true, addEventListener() {}, removeEventListener() {} } }).OfflineSyncWorkspace;
  const h = { render() { cursor = 0; const tree = Component(); effects.splice(0).forEach(fn => cleanups.push(fn())); return tree; },
    account(id) { authCallback('SIGNED_IN', { user: { id,email:id+'@example.invalid' } }); }, finish() { resolveSync({ synced:1,total:1,failures:[] }); },
    failBusy() { rejectSync(new a.module.OfflineSyncBusy()); }, unmount() { cleanups.forEach(fn=>fn?.()); unmounted=true; }, current:()=>options?.isCurrent?.(), invalidations, lateWrites };
  h.render(); return h;
}
const h = workspace(); await tick(); h.account('synthetic-A'); await tick();
nodes(h.render()).find(n => n.props['aria-label'] === '选择草稿 '+draft.site_name).props.onClick();
nodes(h.render()).find(n => n.props.className === 'do-sync-button').props.onClick();
h.account('synthetic-B'); h.finish(); await tick(); await tick();
const screen = content(h.render()); assert(screen.includes('synthetic-B@example.invalid'));
if (fixed) {
  assert(!screen.includes('同步完成：1 条记录已保存到账号。')); assert.equal(h.invalidations.length,0); assert.equal(h.current(),false);
  assert(nodes(h.render()).filter(n=>n.props['aria-pressed']===true).length===0);
  const normal = workspace(); await tick(); normal.account('synthetic-A'); await tick();
  nodes(normal.render()).find(n=>n.props['aria-label']==='选择草稿 '+draft.site_name).props.onClick();
  nodes(normal.render()).find(n=>n.props.className==='do-sync-button').props.onClick(); normal.account('synthetic-A'); normal.finish(); await tick(); await tick();
  assert(content(normal.render()).includes('同步完成：1 条记录已保存到账号。')); assert.equal(normal.invalidations.length,1);
  const locked = workspace(); await tick(); locked.account('synthetic-A'); await tick();
  nodes(locked.render()).find(n=>n.props['aria-label']==='选择草稿 '+draft.site_name).props.onClick();
  nodes(locked.render()).find(n=>n.props.className==='do-sync-button').props.onClick(); locked.failBusy(); await tick(); await tick();
  assert(content(locked.render()).includes('另一个页面正在同步')); assert.equal(locked.invalidations.length,0);
  const gone = workspace(); await tick(); gone.account('synthetic-A'); await tick();
  nodes(gone.render()).find(n=>n.props['aria-label']==='选择草稿 '+draft.site_name).props.onClick();
  nodes(gone.render()).find(n=>n.props.className==='do-sync-button').props.onClick(); gone.unmount(); gone.finish(); await tick(); await tick();
  assert.equal(gone.lateWrites.length,0); assert.equal(gone.invalidations.length,0);
  console.log('PASS: actual_workspace_clears_old_selection_ignores_wrong_account_completion_retains_same_account_refresh_and_has_no_late_unmount_writes');
  console.log('AUDIT: repaired_local_actual_source_models_passed; real_recovery_acceptance_pending');
} else {
  assert(screen.includes('同步完成：1 条记录已保存到账号。')); assert.equal(h.invalidations.length,1);
  console.log('FINDING: actual_sync_workspace_displays_A_success_beneath_current_B_account_after_pending_sync_resolves');
  console.log('AUDIT: local_actual_source_models_complete=true findings=3; no_real_two_account_or_two_tab_browser_acceptance');
}
