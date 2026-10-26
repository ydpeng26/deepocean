// Executes application code with synthetic in-memory data only. No network or credentials.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, require) {
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require, crypto: { randomUUID: () => 'stable' }, fetch() { throw Error('No network'); } });
  return module.exports;
}
let owner = 'a', rpcError = null, rpcRow = { likes_received: '2', saves_received: '1', followers: '3' }, swap = false;
const tables = { forum_posts: [], forum_bookmarks: [], forum_likes: [], forum_follows: [], forum_blocks: [] };
const signed = [];
function from(table) {
  let filters = [], values, action = 'read', slice;
  const q = {
    select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, order() { return q; }, range(a, b) { slice = [a, b]; return q; },
    insert(v) { values = v; action = 'insert'; return q; }, update(v) { values = v; action = 'update'; return q; },
    then(resolve, reject) { return run().then(resolve, reject); }, maybeSingle() { return run(true); },
  };
  async function run(single = false) {
    let rows = tables[table].filter(r => filters.every(([k, v]) => r[k] === v));
    if (action === 'insert') { tables[table].push({ ...values, updated_at: 'v1' }); rows = [values]; }
    if (action === 'update') rows.forEach(r => Object.assign(r, values));
    const count = rows.length;
    if (slice) rows = rows.slice(slice[0], slice[1] + 1);
    return { data: single ? rows[0] ?? null : rows, count, error: null };
  }
  return q;
}
const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: owner } } } }) }, from,
  storage: { from: () => ({ createSignedUrls: async (paths, ttl) => { signed.push({ paths, ttl }); return { data: paths.map(path => ({ path, signedUrl: 'safe-' + path })) }; } }) },
  rpc: async () => { if (swap) owner = 'b'; return { data: rpcRow ? [rpcRow] : [], error: rpcError }; },
};
const api = load('src/lib/forum.ts', () => ({ supabase }));
await api.createForumPost({ requestId: 'own-private', body: 'Private synthetic', title: '', topic: 'stories', visibility: 'private' });
assert.equal(tables.forum_posts[0].visibility, 'private');
await api.createForumPost({ requestId: 'own-private', body: 'Private synthetic', title: '', topic: 'stories', visibility: 'private' });
assert.equal(tables.forum_posts.length, 1);
await assert.rejects(api.createForumPost({ requestId: 'own-private', body: 'Private synthetic', title: '', topic: 'stories', visibility: 'public' }));
await api.updateForumPost('own-private', { body: 'Private synthetic', title: '', topic: 'stories', visibility: 'public' }, 'a', 'v1');
assert.equal(tables.forum_posts[0].visibility, 'public');
await api.updateForumPost('own-private', { body: 'Private synthetic', title: '', topic: 'stories', visibility: 'private' }, 'a', 'v1');
await api.updateForumPost('own-private', { body: 'Edited', title: '', topic: 'stories' }, 'a', 'v1');
assert.equal(tables.forum_posts[0].visibility, 'private', 'Legacy content edits must not republish private posts');
tables.forum_posts.push({ id: 'other-private', user_id: 'b', visibility: 'private', image_path: 'b/secret', created_at: '2026-10-27', body: 'Hidden' });
tables.forum_posts[0].created_at = '2026-10-27';
tables.forum_posts[0].image_path = 'a/photo';
tables.forum_bookmarks.push({ post_id: 'own-private', user_id: 'a' }, { post_id: 'other-private', user_id: 'a' });
const posts = await api.listForumPosts('a');
assert.equal(posts.length, 1); assert.equal(posts[0].visibility, 'private'); assert.equal(posts[0].saved, true);
assert.equal(signed[0].ttl, 60); assert.equal(JSON.stringify(signed[0].paths), JSON.stringify(['a/photo']));
await assert.rejects(api.listForumPosts('b'));
assert.equal(JSON.stringify(await api.getMyCommunityStats('a')), JSON.stringify({ likesReceived: 2, savesReceived: 1, followers: 3 }));
for (const bad of [null, { likes_received: null, saves_received: 0, followers: 0 }, { likes_received: -1, saves_received: 0, followers: 0 }, { likes_received: '9007199254740992', saves_received: 0, followers: 0 }]) {
  rpcRow = bad; await assert.rejects(api.getMyCommunityStats('a'));
}
rpcRow = { likes_received: 0, saves_received: 0, followers: 0 };
rpcError = Error('Failed'); await assert.rejects(api.getMyCommunityStats('a')); rpcError = null;
swap = true; await assert.rejects(api.getMyCommunityStats('a')); swap = false; owner = 'a';
console.log('PASS: private/public create-edit-idempotent retry, legacy edits preserve privacy, hidden media not signed, 60s URLs, owner guarded stats and invalid/error responses fail closed');

// Render the real passport components, including error states and saved-post cards.
let query;
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
const ui = load('src/components/PassportCommunity.tsx', name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === '@tanstack/react-query') return { useQuery: () => query };
  if (name === '@/i18n/LanguageProvider') return { useLanguage: () => ({ language: 'zh-CN' }) };
  return new Proxy({}, { get: (_, key) => key });
});
function nodes(v) { return Array.isArray(v) ? v.flatMap(nodes) : v && typeof v === 'object' ? [v, ...nodes(v.props?.children)] : []; }
function text(v) { return Array.isArray(v) ? v.map(text).join('') : v && typeof v === 'object' ? text(v.props?.children) : String(v ?? ''); }
query = { isError: true, data: { likesReceived: 999, savesReceived: 999, followers: 999 }, refetch() {} };
let tree = ui.PassportCommunityStats({ ownerId: 'a' });
assert.equal(nodes(tree).filter(n => n.type === 'strong').map(n => text(n)).join(''), '———');
assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
query = { isError: false, isPending: false, data: posts, refetch() {} };
tree = ui.PassportSavedPosts({ ownerId: 'a' });
assert.equal(nodes(tree).filter(n => n.type === 'article').length, 1);
assert.ok(nodes(tree).some(n => n.props?.to === '/saved'));
query = { ...query, isError: true };
assert.equal(nodes(ui.PassportSavedPosts({ ownerId: 'a' })).filter(n => n.type === 'article').length, 0);
console.log('PASS: real passport components display real saved count/cards, use saved route, hide stale totals/content on errors');
