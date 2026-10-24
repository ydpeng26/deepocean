// Actual source and hook model only; no browser, network, account or data writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, require, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: 1, jsx: 4, target: 9 } }).outputText,
    { module, exports: module.exports, require, fetch() { throw Error('Network forbidden'); }, ...globals });
  return module.exports;
}
let language = 'zh-CN';
const document = { title: '' }, effects = [];
const copy = load('src/i18n/liveCopy.ts', name => {
  if (name === 'react') return { useEffect: fn => effects.push(fn) };
  if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language }) };
  throw Error('Unexpected import');
}, { document });
const titles = [
  ['src/routes/auth.tsx', '登录 · SupDiver', 'Sign in · SupDiver'],
  ['src/routes/offline.tsx', '无信号记录 · SupDiver', 'Offline log · SupDiver'],
  ['src/components/OfflineSyncWorkspace.tsx', '离线草稿与同步 · SupDiver', 'Offline drafts & sync · SupDiver'],
];
for (const [file, zh, en] of titles) {
  const tree = ts.createSourceFile(file, read(file), 99, true, 4);
  let wired = false;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useLiveCopy' && node.arguments[0]?.text === zh) wired = true;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert(wired, file + ' title hook is wired');
  for (const [lang, expected] of [['en', en], ['zh-CN', zh], ['en', en]]) {
    language = lang; document.title = 'Previous route'; copy.useLiveCopy(zh);
    effects.splice(0).forEach(effect => effect()); assert.equal(document.title, expected);
  }
}
console.log('PASS: three_route_title_hooks_wired_actual_language_effect_updates_English_Chinese_and_route_reentry');
const jsx = (type, props) => ({ type, props });
const header = load('src/components/MemberHeader.tsx', name => {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language }) };
  if (name === '@/hooks/useProfile') return { useProfile: () => ({ profile: { display_name: 'Synthetic diver' } }) };
  if (name === '@tanstack/react-router') return { Link: 'Link', useNavigate: () => () => {} };
  return new Proxy({}, { get: (_, key) => key });
});
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
for (const [lang, expected] of [['zh-CN', '离线草稿与同步'], ['en', 'Offline drafts & sync']]) {
  language = lang;
  const link = nodes(header.MemberHeader()).find(n => n.props?.to === '/offline-sync');
  assert.equal(link.props['aria-label'], expected);
  assert.equal(nodes(link).find(n => n.type === 'span').props.children, expected);
  assert.equal(String(nodes(link).find(n => n.type === 'CloudOff').props['aria-hidden']), 'true');
  // aria-label remains on the actual link even when compact CSS hides its span.
  assert.ok(link.props['aria-label'].length > 0);
}
assert.match(read('src/styles.css'), /\.do-passport-sync-link span\s*\{\s*display:\s*none/);
console.log('PASS: actual_member_header_has_bilingual_independent_link_name_matching_visible_text_with_hidden_decorative_icon');
console.log('AUDIT: local_source_models_passed; native_Safari_recovery_acceptance_pending');
