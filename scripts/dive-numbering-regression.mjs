import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

function load(path, require = () => { throw Error('Unexpected import'); }) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require });
  return module.exports;
}
const ordering = load('src/lib/dive-order.ts');
const { diveNumbers, newestDivesFirst } = ordering;
const entries = rows => JSON.parse(JSON.stringify([...diveNumbers(rows)]));
const fixture = (id, date, created = '2026-10-30T10:00:00.000000+00:00') => ({
  id, dive_date: date, created_at: created, user_id: 'synthetic', country: 'Indonesia',
  site_name: id, region: null, notes: null, photo_urls: [], photo_thumbnail_urls: [],
});
const a = fixture('a', '2026-10-10');
const b = fixture('b', '2026-10-20');
const c = fixture('c', '2026-10-30');
assert.equal(diveNumbers([c]).get('c'), 1);
assert.deepEqual(entries([c, a, b]), [['a', 1], ['b', 2], ['c', 3]]);
const moved = { ...a, dive_date: '2026-11-01' };
assert.deepEqual(entries([c, moved, b]), [['b', 1], ['c', 2], ['a', 3]]);
assert.deepEqual(entries([c, a]), [['a', 1], ['c', 2]]);
const sameDay = [fixture('z', '2026-10-10', '2026-10-30T10:00:00.000002+00:00'),
  fixture('b', '2026-10-10'), fixture('a', '2026-10-10')];
assert.deepEqual(entries(sameDay), [['a', 1], ['b', 2], ['z', 3]]);
const frozen = Object.freeze([Object.freeze(a), Object.freeze(c), Object.freeze(b)]);
assert.equal(newestDivesFirst(frozen).map(d => d.id).join(','), 'c,b,a');
assert.equal(frozen.map(d => d.id).join(','), 'a,c,b');
const many = Array.from({ length: 1017 }, (_, i) => fixture(String(i).padStart(5, '0'), '2026-10-10'));
assert.equal(diveNumbers(many).get('01016'), 1017);
console.log('PASS: first log, backdated insert, date edit, deletion, same-day ties, immutable cache and 1017 records');

// Render the actual list and its actual photo-number component with synthetic data.
let rows = [c, b, a], search = '', country = 'all', stateIndex = 0;
const jsx = (type, props) => ({ type, props });
const page = load('src/routes/_authenticated/dives/logs.tsx', name => {
  if (name === 'react') return { useMemo: f => f(), useState: () => [stateIndex++ === 0 ? search : country, () => {}] };
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === '@tanstack/react-router') return { createFileRoute: () => o => o, useNavigate: () => () => {}, Link: 'Link' };
  if (name === '@tanstack/react-query') return { useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'dives' ? rows : [], refetch: async () => {} }) };
  if (name === '@/lib/dive-order') return ordering;
  if (name === '@/lib/dives') return { diveCover: () => ({ path: null, videoOnly: false }) };
  if (name === '@/hooks/useProfile') return { useProfile: () => ({ profile: { id: 'synthetic' } }) };
  if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN' }) };
  return new Proxy({}, { get: (_, key) => key });
}).Route.component;
function nodes(tree, all = []) {
  if (Array.isArray(tree)) tree.forEach(n => nodes(n, all));
  else if (tree && typeof tree === 'object') { all.push(tree); nodes(tree.props?.children, all); }
  return all;
}
function displayed() {
  stateIndex = 0;
  return nodes(page()).filter(n => typeof n.type === 'function' && n.type.name === 'DivePhoto').map(n => {
    const span = nodes(n.type(n.props)).find(child => child.type === 'span');
    return span.props.children.join('');
  });
}
assert.equal(displayed().join(','), '#003,#002,#001');
search = 'b'; assert.equal(displayed().join(','), '#002');
search = ''; country = 'Philippines'; rows = [c, { ...b, country }, a];
assert.equal(displayed().join(','), '#002');
country = 'all'; rows = [c]; assert.equal(displayed().join(','), '#001');
rows = []; assert.equal(displayed().length, 0);
rows = newestDivesFirst(many); assert.equal(displayed()[0], '#1017');
console.log('PASS: actual list renders chronological padded numbers, preserves them during search/country filters, handles empty and >999 histories');

const timed = (id, time) => ({ ...fixture(id, '2026-10-10'), entry_time: time });
const morning = timed('morning', '08:30:00');
const afternoon = timed('afternoon', '14:15:00');
const midnight = timed('midnight', '00:00:00');
const unknown = timed('unknown', null);
assert.deepEqual(entries([afternoon, unknown, midnight, morning]), [['midnight',1],['morning',2],['afternoon',3],['unknown',4]]);
assert.deepEqual(entries([{...afternoon, entry_time:'07:00:00'}, morning]), [['afternoon',1],['morning',2]]);
assert.equal(newestDivesFirst([morning, afternoon, unknown]).map(d=>d.id).join(','), 'unknown,afternoon,morning');
assert.equal(ordering.parseDiveEntryTime('08:30'), '08:30:00');
assert.equal(ordering.parseDiveEntryTime('00:00'), '00:00:00');
assert.equal(ordering.parseDiveEntryTime('23:59'), '23:59:00');
assert.equal(ordering.parseDiveEntryTime('08:30:00'), '08:30:00');
assert.equal(ordering.parseDiveEntryTime(''), null);
assert.equal(ordering.parseDiveEntryTime(undefined), null);
for(const invalid of ['24:00','12:60','-1:00','8:30','08:30:01','noon']) assert.throws(()=>ordering.parseDiveEntryTime(invalid));
rows = newestDivesFirst([afternoon, morning, midnight]);
assert.equal(displayed().join(','), '#003,#002,#001');
search = 'morning'; assert.equal(displayed().join(','), '#002');
console.log('PASS: entry time orders same-day logs, edits renumber, missing differs from midnight, minute validation and filtered UI');
