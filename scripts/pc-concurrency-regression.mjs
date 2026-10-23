// Actual modules/components, synthetic serialized IDB/API model only. No network.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => value === undefined ? undefined : structuredClone(value);
function load(path, require, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require, crypto: webcrypto,
    fetch() { throw Error('Network forbidden'); }, ...globals });
  return module.exports;
}
const stored = new Map(), queue = [];
let active = false;
function drain() { if (!active && queue.length) { active = true; queue.shift()(); } }
// Each transaction snapshots at its serialized start; commit/abort then release.
const indexedDB = { open() {
  const request = {};
  setImmediate(() => {
    request.result = { close() {}, transaction() {
      let view, pending = 0, started = false, finished = false;
      const operations = [], tx = {};
      function finish(abort = false) {
        if (finished) return;
        finished = true;
        if (!abort) { stored.clear(); view.forEach((v, k) => stored.set(k, v)); }
        setImmediate(() => { if (abort) tx.onabort?.(); else tx.oncomplete?.(); active = false; drain(); });
      }
      function schedule(fn) { if (started) setImmediate(fn); else operations.push(fn); }
      function op(fn) {
        const req = {}; pending++;
        schedule(() => {
          if (finished) return;
          req.result = clone(fn()); req.onsuccess?.(); pending--;
          if (!pending && !finished) setImmediate(() => { if (!pending && !finished) finish(); });
        });
        return req;
      }
      tx.abort = () => finish(true);
      tx.objectStore = () => ({ getAll: () => op(() => [...view.values()]), get: id => op(() => view.get(id)),
        put: value => op(() => { view.set(value.id, clone(value)); return value.id; }),
        delete: id => op(() => { view.delete(id); }),
      });
      queue.push(() => { view = new Map([...stored].map(([k, v]) => [k, clone(v)])); started = true; operations.forEach(fn => setImmediate(fn)); });
      drain(); return tx;
    } };
    request.onsuccess?.();
  });
  return request;
} };
let owner = 'synthetic-A', revision = 0, beforeUpdate, onInsert;
const rows = new Map();
function query() {
  let action = 'read', body; const filters = [];
  const chain = { select() { return chain; }, eq(k, v) { filters.push([k, v]); return chain; },
    insert(v) { action = 'insert'; body = v; return chain; }, update(v) { action = 'update'; body = v; return chain; },
    single: () => execute(), maybeSingle: () => execute(), then: (a, b) => execute().then(a, b) };
  async function execute() {
    if (action === 'update') await beforeUpdate?.();
    let selected = [...rows.values()].filter(r => filters.every(([k, v]) => r[k] === v));
    if (action === 'update') selected.forEach(r => Object.assign(r, clone(body), { updated_at: 'revision-' + ++revision }));
    if (action === 'insert') {
      await onInsert?.(body);
      if (rows.has(body.id)) return { error: { code: '23505' } };
      const row = { ...clone(body), updated_at: 'revision-' + ++revision };
      rows.set(row.id, row); selected = [row];
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
let initial = await a.saveOfflineDive(fields);
let tabA = (await a.listOfflineDives())[0], tabB = (await b.listOfflineDives())[0];
await a.saveOfflineDive({ ...fields, notes: 'newer A' }, initial.id, { expected: tabA });
await assert.rejects(b.saveOfflineDive({ ...fields, site_name: 'stale B' }, initial.id, { expected: tabB }), /Draft changed/);
assert.equal((await a.listOfflineDives())[0].notes, 'newer A');
await assert.rejects(a.saveOfflineDive(fields, initial.id), /Draft changed/);
await assert.rejects(b.deleteOfflineDive(initial.id, tabB), /Draft changed/);
console.log('PASS: stale_offline_save_delete_and_missing_expected_snapshot_reject_without_overwrite');
let latest = (await a.listOfflineDives())[0];
await a.deleteOfflineDive(initial.id, latest);
await assert.rejects(b.saveOfflineDive(fields, initial.id, { expected: tabB }), /Draft changed/);
assert.equal(stored.size, 0);
console.log('PASS: stale_offline_editor_cannot_recreate_removed_or_synced_draft');
// Legacy persisted records without revision are editable exactly once by old snapshot.
stored.set('legacy', { ...fields, id: 'legacy', saved_at: 'legacy-time' });
const legacy = (await a.listOfflineDives())[0];
const revised = await a.saveOfflineDive({ ...fields, notes: 'legacy edit' }, 'legacy', { expected: legacy });
assert.ok(revised.revision);
await assert.rejects(b.saveOfflineDive(fields, 'legacy', { expected: legacy }), /Draft changed/);
stored.clear();
const stable = 'synthetic-stable';
const both = await Promise.all([a.saveOfflineDive(fields, undefined, { requestId: stable }), b.saveOfflineDive(fields, undefined, { requestId: stable })]);
assert.equal(stored.size, 1); assert.equal(both[0].revision, both[1].revision);
await assert.rejects(a.saveOfflineDive({ ...fields, notes: 'changed retry' }, undefined, { requestId: stable }), /Draft changed/);
const snapshot = (await a.listOfflineDives())[0];
const races = await Promise.allSettled([a.saveOfflineDive({ ...fields, notes: 'race A' }, stable, { expected: snapshot }), b.saveOfflineDive({ ...fields, notes: 'race B' }, stable, { expected: snapshot })]);
assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
console.log('PASS: legacy_draft_upgrade_stable_create_retry_and_atomic_two_writer_conflict');
stored.clear(); rows.clear();
initial = await a.saveOfflineDive(fields);
onInsert = async () => { await b.saveOfflineDive({ ...fields, notes: 'edited during sync' }, initial.id, { expected: initial }); };
let result = await a.syncOfflineDives(undefined, { expectedUserId: owner });
assert.equal(result.synced, 0); assert.equal(result.failures.length, 1);
assert.equal((await a.listOfflineDives())[0].notes, 'edited during sync');
onInsert = undefined;
await assert.rejects(a.syncOfflineDives(undefined, { expectedUserId: 'wrong' }));
stored.clear(); rows.clear();
initial = await a.saveOfflineDive(fields);
result = await a.syncOfflineDives(undefined, { expectedUserId: owner });
assert.equal(result.synced, 1); assert.equal(stored.size, 0);
await assert.rejects(b.saveOfflineDive(fields, initial.id, { expected: initial }), /Draft changed/);
console.log('PASS: sync_preserves_inflight_edits_rejects_wrong_account_and_synced_draft_resurrection');
const dives = load('src/lib/dives.ts', name => name.endsWith('/images') ? {} : { supabase });
const payload = { user_id: owner, country: 'Indonesia', site_name: 'original', notes: 'original', photo_urls: [], photo_thumbnail_urls: [] };
const base = { ...payload, id: 'synthetic-dive', updated_at: 'base' };
rows.clear(); rows.set(base.id, clone(base));
const savedA = await dives.saveDive({ ...payload, notes: 'newer A' }, base.id, true, 'base');
await assert.rejects(dives.saveDive({ ...payload, site_name: 'old B' }, base.id, true, 'base'), /changed elsewhere/);
assert.equal(rows.get(base.id).notes, 'newer A');
await assert.rejects(dives.saveDive(payload, base.id, true), /Reopen/);
const lostReply = await dives.saveDive({ ...payload, notes: 'newer A' }, base.id, true, 'base');
assert.equal(lostReply.updated_at, savedA.updated_at);
beforeUpdate = async () => { rows.get(base.id).notes = 'concurrent third writer'; rows.get(base.id).updated_at = 'third'; };
await assert.rejects(dives.saveDive({ ...payload, notes: 'attempt after preread' }, base.id, true, savedA.updated_at), /changed elsewhere/);
assert.equal(rows.get(base.id).notes, 'concurrent third writer');
beforeUpdate = undefined;
owner = 'synthetic-B'; await assert.rejects(dives.saveDive(payload, base.id, true, 'third')); owner = 'synthetic-A';
console.log('PASS: online_revision_CAS_stale_read_write_race_missing_version_lost_reply_and_owner_guards');
function nodes(tree, out = []) {
  if (Array.isArray(tree)) tree.forEach(v => nodes(v, out));
  else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children, out); }
  return out;
}
function formHarness(initialItems = []) {
  const cells = [], effects = [], cleanups = [], pending = [], errors = []; let cursor = 0, language = 'zh-CN';
  const react = {
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value;
      return [cells[i], v => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }]; },
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!(i in cells)) { cells[i] = deps; effects.push(fn); } },
  };
  const jsx = (type, props) => ({ type, props });
  const route = load('src/routes/offline.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-router') return { createFileRoute: () => config => ({ ...config, useSearch: () => initialItems.length ? { draft: initialItems[0].id } : {} }), Link: 'Link' };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language, toggleLanguage() { language = 'en'; } }) };
    if (name === 'sonner') return { toast: { error: m => errors.push(m), success() {} } };
    if (name === '@/lib/offline-dives') return { ...a, listOfflineDives: async () => clone(initialItems),
      saveOfflineDive: (fields, id, options) => new Promise((resolve, reject) => pending.push({ fields: clone(fields), id, options, resolve, reject })) };
    return new Proxy({}, { get: (_, k) => k });
  }, { document: { getElementById: () => null }, window: { confirm: () => true } }).Route;
  const h = { pending, errors, render() { cursor = 0; return nodes(route.component()); },
    input(index, value) { h.render().filter(n => n.type === 'input')[index].props.onChange({ target: { value } }); },
    submit() { return h.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); },
    unmount() { cleanups.forEach(fn => fn?.()); },
    async init() { h.render(); effects.splice(0).forEach(fn => cleanups.push(fn())); await tick(); h.render(); },
  };
  return h;
}
let h = formHarness(); await h.init(); h.input(0, 'Indonesia'); h.input(2, 'Submitted');
const p = h.submit(), duplicate = h.submit();
assert.equal(h.pending.length, 1);
assert.equal(h.render().find(n => n.type === 'fieldset').props.disabled, true);
h.input(2, 'Typed during save');
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, 'Submitted');
h.pending[0].reject(Error('synthetic storage failure')); await Promise.all([p, duplicate]);
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, 'Submitted');
const retry = h.submit(); assert.equal(h.pending[0].options.requestId, h.pending[1].options.requestId);
h.pending[1].resolve({ ...fields, site_name: 'Submitted', id: 'saved', saved_at: 'time', revision: 'r' }); await retry;
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, '');
console.log('PASS: actual_offline_form_sync_lock_field_lock_failure_retention_stable_retry_success_reset');
const draft = { ...fields, id: 'editing', saved_at: 'time', revision: 'r' };
h = formHarness([draft]); await h.init(); h.input(2, 'Unsaved conflict text');
const conflictSave = h.submit(); assert.equal(h.pending[0].options.expected.revision, 'r');
h.pending[0].reject(new a.OfflineDraftConflict()); await conflictSave;
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, 'Unsaved conflict text');
assert.ok(h.render().some(n => n.props.role === 'alert'));
const button = h.render().find(n => n.type === 'button' && String(n.props.children).includes('将当前输入另存为新草稿'));
button.props.onClick();
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, 'Unsaved conflict text');
const copySave = h.submit(); assert.equal(h.pending[1].id, undefined); assert.equal(h.pending[1].options.expected, undefined);
h.pending[1].reject(Error('synthetic')); await copySave;
console.log('PASS: actual_offline_conflict_keeps_fields_and_explicit_save_as_new_requires_separate_save');
h = formHarness(); await h.init(); h.input(0, 'Indonesia'); h.input(2, 'Unmounted');
const late = h.submit(); h.unmount(); h.pending[0].resolve({ ...draft, site_name: 'Unmounted' }); await late;
assert.equal(h.render().filter(n => n.type === 'input')[2].props.value, 'Unmounted');
console.log('PASS: unmounted_offline_save_does_not_clear_fields_or_run_late_UI_completion');
function onlineFormHarness() {
  const cells = [], effects = [], calls = []; let cursor = 0;
  let currentDive = { ...base, updated_at: 'loaded-version' };
  const react = {
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value;
      return [cells[i], v => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }]; },
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; },
    useEffect(fn) { const i = cursor++; if (!(i in cells)) { cells[i] = true; effects.push(fn); } },
  };
  const jsx = (type, props) => ({ type, props });
  const Component = load('src/components/DiveForm.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-router') return { useNavigate: () => () => {} };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data: [] }), useQueryClient: () => ({ setQueryData() {}, invalidateQueries: async () => {} }) };
    if (name === 'sonner') return { toast: { error() {}, success() {} } };
    if (name === '@/lib/dives') return { ...dives, saveDive: async (...args) => { calls.push(args); throw Error('simulated conflict'); } };
    return new Proxy({}, { get: (_, k) => k });
  }).DiveForm;
  const render = () => { cursor = 0; return nodes(Component({ dive: currentDive })); };
  return { calls, render, effects, refresh() { currentDive = { ...currentDive, updated_at: 'background-new-version', notes: 'background value' }; } };
}
const onlineForm = onlineFormHarness();
onlineForm.render(); onlineForm.effects.splice(0).forEach(fn => fn());
onlineForm.render().find(n => n.props.id === 'site').props.onChange({ target: { value: 'Unsaved online text' } });
onlineForm.refresh();
await onlineForm.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
assert.equal(onlineForm.calls.length, 1);
assert.equal(onlineForm.calls[0][3], 'loaded-version');
assert.equal(onlineForm.calls[0][0].site_name, 'Unsaved online text');
assert.equal(onlineForm.render().find(n => n.props.id === 'site').props.value, 'Unsaved online text');
console.log('PASS: actual_online_form_keeps_mount_revision_after_background_refresh_and_retains_conflict_draft');
console.log('AUDIT: local_regression_passed; real_browser_recovery_acceptance_not_run');
