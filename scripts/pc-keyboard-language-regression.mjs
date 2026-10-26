// Actual hook/components with a deterministic DOM/hook model, no network/browser/data.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
function load(file, require, globals = {}) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replaceAll('import.meta.env', '({PROD:false,VITE_SITE_URL:"https://example.invalid"})');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    { module, exports: module.exports, require, crypto: webcrypto, fetch() { throw Error('Network forbidden'); }, ...globals });
  return module.exports;
}
const copy = load('src/i18n/liveCopy.ts', () => ({}));
for (const [zh, en] of Object.entries(copy.liveEnglish)) {
  assert.equal(copy.liveText('zh-CN', zh), zh);
  assert.equal(copy.liveText('en', zh), en);
  assert.ok(!/[\u4e00-\u9fff]/.test(en));
}
for (const file of ['src/components/DiveForm.tsx','src/routes/_authenticated/gear.tsx','src/routes/_authenticated/marine.tsx','src/routes/_authenticated/dives/new.tsx']) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), tree = ts.createSourceFile(file, source, 99, true, 4);
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 't' && ts.isStringLiteral(n.arguments[0]))
      assert.ok(!/[\u4e00-\u9fff]/.test(copy.liveText('en', n.arguments[0].text)), 'Missing English copy: ' + file);
    ts.forEachChild(n, visit);
  }
  visit(tree);
}
assert.match(copy.liveText('en', '最大深度请填写非负数字（最多一位小数）'), /non-negative/);
assert.equal(copy.liveText('en', '中文 / English guard.'), 'English guard.');
assert.equal(copy.liveText('en', 'Synthetic user text'), 'Synthetic user text');
console.log('PASS: static_live_copy_complete_Chinese_unchanged_English_labels_validation_and_unknown_text_preserved');
// Re-render the actual editors with the same hook state across language changes.
const diveConstants = load('src/lib/dives.ts', () => ({}));
function editorHarness(file, exported) {
  let cursor = 0;
  const cells = [], h = { language: 'zh-CN' };
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value;
      return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; }, useEffect() {},
  };
  const module = load(file, name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/i18n/liveCopy') return { useLiveCopy: () => text => copy.liveText(h.language, text) };
    if (name === '@/hooks/useModalFocus') return { useModalFocus() {} };
    if (name === '@/hooks/useProfile') return { useProfile: () => ({ profile: { id: 'synthetic-owner' } }) };
    if (name === '@tanstack/react-router') return { createFileRoute: () => options => options, useNavigate: () => () => {}, Link: 'Link' };
    if (name === '@tanstack/react-query') return { useQuery: () => ({ data: [], isPending: false }), useQueryClient: () => ({}) };
    if (name === '@/lib/dives') return diveConstants;
    return new Proxy({}, { get: (_, key) => key });
  });
  const component = exported ? module[exported] : module.Route.component;
  h.render = () => { cursor = 0; return nodes(component({})); };
  h.field = (key, value) => h.render().find(n => n.props[key] === value);
  h.switch = () => { h.language = h.language === 'en' ? 'zh-CN' : 'en'; return h.render(); };
  return h;
}
const diveEditor = editorHarness('src/components/DiveForm.tsx', 'DiveForm');
diveEditor.field('id', 'site').props.onChange({ target: { value: 'Synthetic unsaved site' } });
const weather = diveEditor.render().find(n => n.type === 'Select');
weather.props.onValueChange('晴');
for (let i = 0; i < 2; i++) {
  diveEditor.switch();
  assert.equal(diveEditor.field('id', 'site').props.value, 'Synthetic unsaved site');
  assert.equal(diveEditor.render().find(n => n.type === 'Select').props.value, '晴');
  assert(diveEditor.render().some(n => n.type === 'SelectItem' && n.props.value === '晴'));
}
const gearEditor = editorHarness('src/routes/_authenticated/gear.tsx');
gearEditor.render().find(n => n.type === 'Button' && nodes(n).some(x => x.type === 'Plus')).props.onClick();
gearEditor.field('maxLength', 80).props.onChange({ target: { value: 'Synthetic unsaved brand' } });
gearEditor.render().find(n => n.type === 'select').props.onChange({ target: { value: 'mask' } });
for (let i = 0; i < 2; i++) {
  gearEditor.switch();
  assert.equal(gearEditor.field('maxLength', 80).props.value, 'Synthetic unsaved brand');
  assert.equal(gearEditor.render().find(n => n.type === 'select').props.value, 'mask');
}
const marineEditor = editorHarness('src/routes/_authenticated/marine.tsx');
marineEditor.render().find(n => n.type === 'button' && nodes(n).some(x => x.type === 'Plus')).props.onClick();
marineEditor.field('maxLength', 120).props.onChange({ target: { value: 'Synthetic unsaved species' } });
marineEditor.field('maxLength', 200).props.onChange({ target: { value: 'Synthetic unsaved location' } });
for (let i = 0; i < 2; i++) {
  marineEditor.switch();
  assert.equal(marineEditor.field('maxLength', 120).props.value, 'Synthetic unsaved species');
  assert.equal(marineEditor.field('maxLength', 200).props.value, 'Synthetic unsaved location');
}
console.log('PASS: actual_dive_gear_marine_language_switch_preserves_unsaved_fields_and_stored_weather_category_values');
const listeners = new Map();
const doc = { activeElement: null, addEventListener(name, fn) { const all = listeners.get(name) ?? []; all.push(fn); listeners.set(name, all); },
  removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) ?? []).filter(f => f !== fn)); } };
class Element {
  constructor(name, children = []) { this.name = name; this.children = children; this.tabIndex = 0; this.isConnected = true; this.disabled = false; this.focuses = 0; }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  querySelectorAll() { return this.children; }
  matches() { return this.disabled || this.hidden; }
  hasAttribute(name) { return name === 'data-modal-initial-focus' && !!this.initialFocus; }
  closest() { return null; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  focus() { doc.activeElement = this; this.focuses++; for (const f of [...(listeners.get('focusin') ?? [])]) f({ target: this }); }
}
let currentHarness;
const react = { useRef(value) { const h = currentHarness, i = h.cursor++; return h.cells[i] ??= { current: value }; },
  useEffect(fn, deps) { const h = currentHarness, i = h.cursor++; if (!h.cells[i] || deps.some((v, n) => v !== h.cells[i][n])) {
    h.pending.push(() => { h.cleanups[i]?.(); h.cleanups[i] = fn(); }); h.cells[i] = deps;
  } } };
const { useModalFocus } = load('src/hooks/useModalFocus.ts', () => react,
  { document: doc, HTMLElement: Element, Node: Element, getComputedStyle: () => ({ visibility: 'visible' }) });
function modal() {
  const first = new Element('first'), last = new Element('last'), dialog = new Element('dialog', [first, last]); dialog.tabIndex = -1;
  const h = { cursor: 0, cells: [], pending: [], cleanups: [], ref: { current: dialog }, open: true, busy: false, closed: 0, scope: 'one',
    render() { currentHarness = h; h.cursor = 0; useModalFocus(h.ref, h.open, () => h.closed++, () => !h.busy, h.scope); h.pending.splice(0).forEach(fn => fn()); },
    cleanup() { h.cleanups.forEach(fn => fn?.()); }, first, last, dialog };
  return h;
}
function key(value, shiftKey = false, isComposing = false) {
  const e = { key: value, shiftKey, isComposing, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  for (const f of [...(listeners.get('keydown') ?? [])]) f(e);
  return e;
}
const opener = new Element('opener'); opener.focus(); const h = modal(); h.render();
assert.equal(doc.activeElement, h.first);
h.last.focus(); assert.equal(key('Tab').prevented, true); assert.equal(doc.activeElement, h.first);
key('Tab', true); assert.equal(doc.activeElement, h.last);
new Element('background').focus(); assert.equal(doc.activeElement, h.first);
assert.equal(key('Escape', false, true).prevented, false); assert.equal(h.closed, 0);
h.busy = true; h.render(); assert.equal(key('Escape').prevented, true); assert.equal(h.closed, 0);
h.first.disabled = h.last.disabled = true; key('Tab'); assert.equal(doc.activeElement, h.dialog);
h.first.disabled = h.last.disabled = false; h.busy = false; h.render(); key('Escape'); assert.equal(h.closed, 1);
h.cleanup(); assert.equal(doc.activeElement, opener); assert.equal(listeners.get('keydown').length, 0);
console.log('PASS: real_modal_hook_focus_entry_bidirectional_Tab_background_guard_busy_fallback_IME_Escape_and_restore');
const outer = modal(); outer.render(); const inner = modal(); inner.render(); key('Escape');
assert.equal(inner.closed, 1); assert.equal(outer.closed, 0); inner.cleanup(); assert.equal(doc.activeElement, outer.first);
outer.scope = 'new-view'; outer.ref.current = new Element('replacement', [new Element('replacement-first')]); outer.render();
assert.equal(doc.activeElement, outer.ref.current.children[0]); outer.cleanup();
assert.equal(listeners.get('focusin').length, 0);
console.log('PASS: nested_modal_only_top_handles_keys_replaced_marine_view_refocuses_and_cleanup_has_no_listeners');
opener.focus(); const preferred = modal(); preferred.last.initialFocus = true; preferred.render();
assert.equal(doc.activeElement, preferred.last); preferred.cleanup(); assert.equal(doc.activeElement, opener);
console.log('PASS: marine_initial_name_focus_is_applied_after_opener_capture_and_returns_to_trigger');
function nodes(tree, out = []) { if (Array.isArray(tree)) tree.forEach(v => nodes(v, out));
  else if (tree && typeof tree === 'object') { if (tree.type) out.push(tree); nodes(tree.props?.children, out); } return out; }
function authHarness() {
  const cells = []; let cursor = 0, resolve; const sent = [];
  const react = { useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = typeof value === 'function' ? value() : value;
    return [cells[i], v => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }]; },
    useRef(value) { const i = cursor++; return cells[i] ??= { current: value }; }, useEffect() {} };
  const jsx = (type, props) => ({ type, props });
  const { Route } = load('src/routes/auth.tsx', name => {
    if (name === '@/hooks/useAuthStorageStatus') return { useAuthStorageStatus: () => 'available' };
    if (name === '@/lib/tab-auth-storage') return { authStorageAvailable: () => true };
    if (name === '@/i18n/liveCopy') return { useLiveCopy() {} };
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@tanstack/react-router') return { createFileRoute: () => options => ({ ...options, useSearch: () => ({}) }), useNavigate: () => () => {}, Link: 'Link' };
    if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN' }) };
    if (name === '@/integrations/supabase/client') return { supabase: { auth: { signInWithPassword: args => { sent.push(args); return new Promise(r => { resolve = r; }); }, getSession: async () => ({ data: {} }) } } };
    if (name === 'sonner') return { toast: { dismiss() {}, error() {}, info() {} } };
    if (name === '@/lib/password-recovery') return { passwordRecoveryEnabled: true };
    return {};
  }, { window: { location: { origin: 'https://example.invalid' } }, navigator: { onLine: false }, URL });
  const h = { sent, render() { cursor = 0; const all = nodes(Route.component());
    for (const n of all.filter(n => n.props.role === 'tab')) n.props.ref.current = new Element(n.props.id);
    return all;
  }, tab(mode) { return h.render().find(n => n.props.id === 'auth-' + mode + '-tab'); },
    key(mode, key, composing = false) { h.tab(mode).props.onKeyDown({ key, isDefaultPrevented: () => false, nativeEvent: { isComposing: composing }, preventDefault() {} }); },
    resolve() { resolve({ error: null }); } };
  return h;
}
const auth = authHarness(); auth.key('signin', 'ArrowRight'); assert.equal(auth.tab('signup').props['aria-selected'], true);
const passwordHint = auth.render().find(n => n.props.id === 'signup-password-requirements');
assert(passwordHint && /6–12.*不强制/.test(passwordHint.props.children));
assert.equal(auth.render().find(n => n.props.id === 'password').props['aria-describedby'], passwordHint.props.id);
assert.equal(auth.render().find(n => n.props.id === 'password').props.minLength, 6);
assert.equal(auth.render().find(n => n.props.id === 'password').props.maxLength, 12);
assert.equal(auth.tab('signin').props.tabIndex, -1); assert.equal(auth.tab('signup').props.tabIndex, 0);
auth.key('signup', 'Home'); assert.equal(auth.tab('signin').props['aria-selected'], true);
assert(!auth.render().some(n => n.props.id === 'signup-password-requirements'));
assert.equal(auth.render().find(n => n.props.id === 'password').props['aria-describedby'], undefined);
assert.equal(auth.render().find(n => n.props.id === 'password').props.maxLength, 72, 'Existing longer passwords must remain usable for sign-in');
auth.key('signin', 'End'); assert.equal(auth.tab('signup').props['aria-selected'], true);
auth.key('signup', 'ArrowLeft'); assert.equal(auth.tab('signin').props['aria-selected'], true);
auth.key('signin', 'ArrowRight', true); assert.equal(auth.tab('signin').props['aria-selected'], true);
for (const [id, value] of [['email','synthetic@example.invalid'], ['password','synthetic-password']])
  auth.render().find(n => n.props.id === id).props.onChange({ target: { value } });
const saving = auth.render().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
auth.key('signin', 'ArrowRight'); assert.equal(auth.tab('signin').props['aria-selected'], true);
assert.equal(auth.tab('signup').props.disabled, true); auth.resolve(); await saving;
assert.equal(auth.sent.length, 1); assert.equal(auth.render().find(n => n.props.id === 'email').props.value, 'synthetic@example.invalid');
console.log('PASS: actual_auth_tabs_arrow_wrap_Home_End_roving_tabindex_IME_busy_guard_and_credentials_retained');
console.log('AUDIT: local_source_models_passed; real_recovery_browser_acceptance_pending');
