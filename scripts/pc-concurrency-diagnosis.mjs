// Diagnosis only. Actual modules with in-memory storage/API and synthetic fields.
// No browser, network, credentials, real database or user data.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
function load(path, require, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require, crypto: webcrypto,
    fetch() { throw Error('Network forbidden'); }, ...globals });
  return module.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => value === undefined ? undefined : structuredClone(value);
const stored = new Map();
// Minimal asynchronous IDB adapter for deterministic API counterexamples. This
// is not an actual browser IndexedDB/transaction durability acceptance test.
const indexedDB = { open() {
  const request = {};
  setImmediate(() => {
    request.result = { close() {}, transaction() {
      const tx = {}; let pending = 0;
      function op(fn) {
        const req = {}; pending++;
        setImmediate(() => {
          req.result = clone(fn()); req.onsuccess?.();
          if (--pending === 0) setImmediate(() => { if (!pending) tx.oncomplete?.(); });
        });
        return req;
      }
      tx.objectStore = () => ({ getAll: () => op(() => [...stored.values()]),
        get: id => op(() => stored.get(id)),
        put: value => op(() => { stored.set(value.id, clone(value)); return value.id; }),
        delete: id => op(() => { stored.delete(id); }),
      });
      return tx;
    } };
    request.onsuccess?.();
  });
  return request;
} };
let owner = 'synthetic-A';
const rows = new Map();
let onInsert;
function query() {
  let action = 'read', body, filters = [];
  const chain = { select() { return chain; }, eq(k, v) { filters.push([k, v]); return chain; },
    insert(v) { action = 'insert'; body = v; return chain; },
    update(v) { action = 'update'; body = v; return chain; },
    single: () => execute(), maybeSingle: () => execute(),
    then: (resolve, reject) => execute().then(resolve, reject),
  };
  async function execute() {
    let selected = [...rows.values()].filter(r => filters.every(([k, v]) => r[k] === v));
    if (action === 'insert') {
      await onInsert?.(body);
      if (rows.has(body.id)) return { error: { code: '23505' } };
      rows.set(body.id, clone(body)); selected = [body];
    }
    if (action === 'update') {
      selected.forEach(r => Object.assign(r, clone(body)));
    }
    return { data: clone(selected[0] ?? null), error: null };
  }
  return chain;
}
const supabase = { auth: { getUser: async () => ({ data: { user: { id: owner } } }),
  getSession: async () => ({ data: { session: { user: { id: owner } } } }) }, from: query };
const offline = () => load('src/lib/offline-dives.ts', () => ({ supabase }), { indexedDB, navigator: { onLine: true } });
const a = offline(), b = offline();
const fields = { ...a.emptyOfflineDive(), country: 'Indonesia', site_name: 'SYNTHETIC', notes: 'base' };
const initial = await a.saveOfflineDive(fields);
const tabA = (await a.listOfflineDives())[0], tabB = (await b.listOfflineDives())[0];
await a.saveOfflineDive({ ...tabA, notes: 'newer tab A' }, initial.id);
await b.saveOfflineDive({ ...tabB, site_name: 'stale tab B' }, initial.id);
assert.equal((await a.listOfflineDives())[0].notes, 'base');
console.log('FINDING: stale_offline_editor_silently_overwrites_other_tab_newer_fields');
await a.deleteOfflineDive(initial.id);
await b.saveOfflineDive(tabB, initial.id);
assert.equal((await a.listOfflineDives()).length, 1);
console.log('FINDING: stale_offline_editor_recreates_draft_after_other_tab_removed_it');
stored.clear(); rows.clear();
const during = await a.saveOfflineDive(fields);
onInsert = async () => { await b.saveOfflineDive({ ...during, notes: 'edited during sync' }, during.id); };
const result = await a.syncOfflineDives(undefined, { expectedUserId: owner });
assert.equal(result.synced, 0); assert.equal(result.failures.length, 1);
assert.equal((await a.listOfflineDives())[0].notes, 'edited during sync');
console.log('PASS: sync_cleanup_preserves_draft_changed_while_upload_is_pending');
onInsert = undefined; stored.clear(); rows.clear();
await a.saveOfflineDive(fields);
await assert.rejects(a.syncOfflineDives(undefined, { expectedUserId: 'other-account' }));
assert.equal(rows.size, 0); assert.equal(stored.size, 1);
console.log('PASS: sync_initial_account_mismatch_rejects_without_upload_or_local_delete');
const dives = load('src/lib/dives.ts', name => name.endsWith('/images') ? {} : { supabase });
const base = { id: 'synthetic-dive', user_id: owner, country: 'Indonesia', site_name: 'original',
  notes: 'original', photo_urls: [], photo_thumbnail_urls: [] };
rows.clear(); rows.set(base.id, clone(base));
const payloadA = { ...base, notes: 'newer device A' }, payloadB = { ...base, site_name: 'stale device B' };
delete payloadA.id; delete payloadB.id;
await dives.saveDive(payloadA, base.id, true);
await dives.saveDive(payloadB, base.id, true);
assert.equal(rows.get(base.id).notes, 'original');
console.log('FINDING: online_stale_edit_overwrites_newer_record_without_conflict_detection');
function nodes(tree, out = []) {
  if (Array.isArray(tree)) tree.forEach(v => nodes(v, out));
  else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children, out); }
  return out;
}
function formHarness() {
  const cells = [], pending = []; let cursor = 0;
  const react = { useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value;
    return [cells[i], v => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }]; }, useEffect() {} };
  const jsx = (type, props) => ({ type, props });
  const route = load('src/routes/offline.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-router') return { createFileRoute: () => config => ({ ...config, useSearch: () => ({}) }), Link: 'Link' };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN' }) };
    if (name === 'sonner') return { toast: { error() {}, success() {} } };
    if (name === '@/lib/offline-dives') return { ...a, listOfflineDives: async () => [],
      saveOfflineDive: fields => new Promise(resolve => pending.push({ fields: clone(fields), resolve })) };
    return new Proxy({}, { get: (_, k) => k });
  }, { document: { getElementById: () => null }, window: {} }).Route;
  const h = { pending, render() { cursor = 0; return nodes(route.component()); },
    input(index, value) { h.render().filter(n => n.type === 'input')[index].props.onChange({ target: { value } }); },
    submit() { return h.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); } };
  return h;
}
let h = formHarness(); h.input(0, 'Indonesia'); h.input(2, 'Synthetic draft');
const first = h.submit(), second = h.submit();
assert.equal(h.pending.length, 2);
h.pending.forEach(p => p.resolve()); await Promise.all([first, second]);
console.log('FINDING: offline_form_same_tick_submit_calls_save_twice_without_stable_create_id');
h = formHarness(); h.input(0, 'Indonesia'); h.input(2, 'Submitted');
const saving = h.submit(); h.input(2, 'Typed while saving');
assert.equal(h.render().filter(n => n.type === 'input')[2].props.disabled, undefined);
h.pending[0].resolve(); await saving; await tick();
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, '');
assert.equal(h.pending[0].fields.site_name, 'Submitted');
console.log('FINDING: offline_save_success_clears_new_text_typed_during_pending_save');
console.log('AUDIT: local_synthetic_complete=true findings=5; browser_cloud_cross_device_not_run; application_unchanged=true');
