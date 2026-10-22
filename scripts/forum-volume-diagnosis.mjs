// Diagnostic counterexamples, not fixed-behavior acceptance. Local generated data only.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const state = { tables: {}, reads: [] };
const cap = 1000;
function query(table) {
  const filters = [];
  const chain = {
    select() { return chain; }, eq(k, v) { filters.push([k, v]); return chain; }, order() { return chain; },
    then(resolve, reject) {
      state.reads.push(table);
      return Promise.resolve({ error: null, data: state.tables[table].filter(row => filters.every(([k, v]) => row[k] === v)).slice(0, cap) }).then(resolve, reject);
    },
  };
  return chain;
}
const supabase = { from: query, auth: { getSession: async () => ({ data: { session: { user: { id: 'viewer' } } } }) },
  rpc: async () => ({ data: [{ display_name: 'Synthetic' }], error: null }) };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/forum.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ supabase }), fetch() { throw Error('Network forbidden'); } });
const api = module.exports;
const post = i => ({ id: 'post-' + i, user_id: 'author-' + i, body: 'Synthetic', title: 'Synthetic ' + i,
  topic: 'stories', forum_likes: [], forum_comments: [] });
function reset() {
  state.tables = { forum_posts: [], forum_bookmarks: [], forum_follows: [], forum_blocks: [], forum_comments: [] };
  state.reads = [];
}
reset(); state.tables.forum_posts = Array.from({ length: 1006 }, (_, i) => post(i));
let result = await api.listForumPosts();
assert.equal(result.length, 1000); assert.equal(result.some(row => row.id === 'post-1005'), false);
console.log('FINDING: actual_feed_function_silently_returns_first_1000_of_1006_under_simulated_server_cap');
reset(); state.tables.forum_posts = [post(1005)];
state.tables.forum_bookmarks = Array.from({ length: 1006 }, (_, i) => ({ user_id: 'viewer', post_id: 'post-' + i }));
state.tables.forum_follows = Array.from({ length: 1006 }, (_, i) => ({ follower_id: 'viewer', following_id: 'author-' + i }));
result = await api.listForumPosts(); assert.equal(result[0].saved, false); assert.equal(result[0].following, false);
console.log('FINDING: simulated_capped_bookmarks_and_follows_render_existing_relations_as_absent');
state.tables.forum_blocks = Array.from({ length: 1006 }, (_, i) => ({ blocker_id: 'viewer', blocked_id: 'author-' + i }));
result = await api.listForumPosts(); assert.equal(result.length, 1);
assert.equal((await api.listBlockedForumAuthors('viewer')).length, 1000);
console.log('FINDING: simulated_capped_block_list_allows_omitted_blocked_author_into_feed_and_omits_management_entry');
reset(); state.tables.forum_comments = Array.from({ length: 1006 }, (_, i) => ({ id: 'c-' + i, post_id: 'target', user_id: 'viewer', body: 'Synthetic' }));
assert.equal((await api.listForumComments('target')).length, 1000);
console.log('FINDING: actual_comment_function_silently_returns_first_1000_under_simulated_server_cap');
console.log('AUDIT: local_synthetic_counterexamples_complete=true cloud_configuration_not_inferred=true');
