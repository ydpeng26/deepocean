// Actual API module, generated local data only. No network or credentials.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const state = { owner: 'viewer', tables: {}, fail: null, swap: false, countChange: false, duplicate: false, truncate: false, missingCount: false, reads: [], signSizes: [], rpcBusy: 0, rpcMax: 0 };
function query(table) {
  const filters = []; let range, sort;
  const chain = { select() { return chain; }, eq(k, v) { filters.push([k, v]); return chain; },
    order(k) { sort = k; return chain; }, range(a, b) { range = [a, b]; return chain; },
    then(resolve, reject) { return execute().then(resolve, reject); } };
  async function execute() {
    let rows = state.tables[table].filter(row => filters.every(([k, v]) => row[k] === v));
    const offset = range?.[0] ?? 0;
    state.reads.push([table, offset]);
    if (state.fail === table && offset === 500) return { error: Error('Second page rejected') };
    const count = state.missingCount ? null : rows.length + (state.countChange && offset === 500 ? 1 : 0);
    rows = [...rows].sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
    if (state.duplicate && offset === 500) rows[500] = rows[0];
    if (range) rows = rows.slice(offset, range[1] + 1);
    if (state.truncate && offset === 0) rows = rows.slice(0, 100);
    if (state.swap && offset === 500) state.owner = 'other';
    return { data: rows, count, error: null };
  }
  return chain;
}
const supabase = { from: query, auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
  storage: { from: () => ({ createSignedUrls: async paths => { state.signSizes.push(paths.length); return { data: paths.map(path => ({ path, signedUrl: 'signed:' + path })), error: null }; } }) },
  rpc: async () => { state.rpcBusy++; state.rpcMax = Math.max(state.rpcMax, state.rpcBusy); await Promise.resolve(); state.rpcBusy--; return { data: [{ display_name: 'Synthetic' }], error: null }; } };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/forum.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ supabase }), fetch() { throw Error('Network forbidden'); } });
const api = module.exports, id = i => String(i).padStart(6, '0');
function reset() {
  state.owner = 'viewer'; state.fail = null; state.swap = state.countChange = state.duplicate = state.truncate = state.missingCount = false;
  state.reads = []; state.signSizes = []; state.rpcMax = 0;
  state.tables = { forum_posts: [], forum_bookmarks: [], forum_follows: [], forum_blocks: [], forum_likes: [], forum_comments: [] };
}
function posts(n) { return Array.from({ length: n }, (_, i) => ({ id: id(i), user_id: 'author-' + id(i), body: 'Synthetic', title: 'Synthetic ' + i,
  created_at: '2026-10-23', topic: 'stories', image_path: i % 2 ? 'generated/' + id(i) : null,
  forum_likes: [{ count: 1234 }], forum_comments: [{ count: 1005 }] })); }
reset(); state.tables.forum_posts = posts(1017);
for (const [table, own, target] of [['forum_bookmarks', 'user_id', 'post_id'], ['forum_likes', 'user_id', 'post_id'], ['forum_follows', 'follower_id', 'following_id']])
  state.tables[table] = Array.from({ length: 1017 }, (_, i) => ({ [own]: 'viewer', [target]: target === 'following_id' ? 'author-' + id(i) : id(i) }));
let result = await api.listForumPosts();
assert.equal(result.length, 1017); assert.equal(result[0].id, id(1016));
assert.ok(result.every(row => row.saved && row.liked && row.following && row.likes === 1234 && row.comments === 1005));
assert.ok(state.signSizes.every(n => n <= 100));
console.log('PASS: complete_1017_posts_bookmarks_follows_own_likes_stable_order_exact_aggregate_counts_and_bounded_signing');
for (const table of ['forum_posts', 'forum_bookmarks', 'forum_follows', 'forum_blocks', 'forum_likes']) {
  const column = table === 'forum_blocks' ? 'blocked_id' : null;
  if (column) state.tables[table] = Array.from({ length: 1017 }, (_, i) => ({ blocker_id: 'viewer', blocked_id: 'unrelated-' + id(i) }));
  state.fail = table; await assert.rejects(api.listForumPosts()); state.fail = null;
}
for (const flag of ['swap', 'countChange', 'duplicate', 'truncate', 'missingCount']) {
  state[flag] = true; await assert.rejects(api.listForumPosts()); state[flag] = false; state.owner = 'viewer';
}
console.log('PASS: every_later_page_failure_account_switch_changed_count_duplicate_short_response_and_missing_count_rejects_entire_feed');
reset(); state.tables.forum_posts = posts(1017);
state.tables.forum_blocks = Array.from({ length: 1017 }, (_, i) => ({ blocker_id: 'viewer', blocked_id: 'author-' + id(i) }));
assert.equal((await api.listForumPosts()).length, 0);
assert.equal((await api.listBlockedForumAuthors('viewer')).length, 1017); assert.ok(state.rpcMax <= 5);
console.log('PASS: blocked_author_beyond_first_1000_never_enters_feed_management_list_complete_rpc_concurrency_at_most_five');
reset(); state.tables.forum_comments = Array.from({ length: 1005 }, (_, i) => ({ id: id(i), post_id: 'target', user_id: 'viewer', body: 'Synthetic', created_at: '2026-10-23' }));
assert.equal((await api.listForumComments('target')).length, 1005);
state.fail = 'forum_comments'; await assert.rejects(api.listForumComments('target')); state.fail = null;
state.swap = true; await assert.rejects(api.listForumComments('target'));
console.log('PASS: complete_1005_comments_and_later_failure_or_account_switch_does_not_publish_partial_comments');
reset(); state.tables.forum_posts = posts(20001); await assert.rejects(api.listForumPosts());
assert.equal(state.reads.filter(([table]) => table === 'forum_posts').length, 1);
console.log('PASS: explicit_20000_row_per_query_safety_ceiling_rejects_instead_of_unbounded_allocation_or_partial_success');
