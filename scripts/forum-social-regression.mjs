// Synthetic local mocks only. No network, credentials or persistent data.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(path,require){const code=ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require,fetch(){throw Error('Network forbidden');}});return module.exports;}
const state={owner:'a',tables:{forum_posts:[{id:'post',user_id:'b',body:'Synthetic',forum_likes:[],forum_comments:[]}],forum_likes:[],forum_bookmarks:[],forum_follows:[],forum_blocks:[]},fail:null,lost:false,ignore:false,swap:false,writes:0};
function query(table){let action='read',body,filters=[],range=null;const chain={select(){return chain;},eq(k,v){filters.push([k,v]);return chain;},order(){return chain;},range(a,b){range=[a,b];return chain;},insert(v){action='insert';body=v;return chain;},delete(){action='delete';return chain;},then(a,b){return execute().then(a,b);},maybeSingle(){return execute(true);}};
async function execute(single=false){let rows=state.tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(action==='read'&&state.fail===table)return{data:null,error:Error('Synthetic read failure')};if(action!=='read'){
state.writes++;if(action==='insert'){if(state.tables[table].some(r=>Object.entries(body).every(([k,v])=>r[k]===v)))return{error:{code:'23505'}};if(!state.ignore)state.tables[table].push({...body});}else if(!state.ignore)state.tables[table]=state.tables[table].filter(r=>!rows.includes(r));
if(state.lost){state.lost=false;return{error:Error('Lost response')};}}
if(state.swap)state.owner='b';const count=rows.length;if(range)rows=rows.slice(range[0],range[1]+1);return{data:single?(rows[0]??null):rows,count,error:null};}return chain;}
const supabase={auth:{getSession:async()=>({data:{session:{user:{id:state.owner}}}})},from:query};
const api=load('src/lib/forum.ts',()=>({supabase}));
for(const table of ['forum_posts','forum_bookmarks','forum_follows','forum_blocks']){state.fail=table;await assert.rejects(api.listForumPosts());}state.fail=null;state.tables.forum_blocks=[{blocker_id:'a',blocked_id:'b'}];assert.equal((await api.listForumPosts()).length,0);state.tables.forum_blocks=[];assert.equal((await api.listForumPosts()).length,1);state.swap=true;await assert.rejects(api.listForumPosts());state.swap=false;state.owner='a';
console.log('PASS: any_feed_or_private_state_read_error_rejects_whole_feed_blocks_remain_filtered_and_account_changes_reject');
for(const [table,fn,target] of [['forum_likes','toggleForumLike','post'],['forum_bookmarks','toggleForumBookmark','post'],['forum_follows','toggleForumFollow','b']]){
state.lost=true;await assert.rejects(api[fn](target,false,'a'));assert.equal(state.tables[table].length,1);await api[fn](target,false,'a');assert.equal(state.tables[table].length,1);
await Promise.all([api[fn](target,false,'a'),api[fn](target,false,'a')]);assert.equal(state.tables[table].length,1);
state.lost=true;await assert.rejects(api[fn](target,true,'a'));await api[fn](target,true,'a');assert.equal(state.tables[table].length,0);
state.ignore=true;await assert.rejects(api[fn](target,false,'a'));state.ignore=false;
state.owner='b';const before=state.writes;await assert.rejects(api[fn](target,false,'a'));assert.equal(state.writes,before);state.owner='a';}
console.log('PASS: like_bookmark_follow_lost_add_remove_retries_and_concurrent_add_are_idempotent_confirmed_and_owner_scoped');
function hook(){let cursor=0;const cells=[],cleanups=[];let actionResolve,refreshResolve;const s={calls:0,refreshes:0,successes:0,errors:0,owner:'a'};
const react={useRef(value){const i=cursor++;return cells[i]??={current:value};},useState(value){const i=cursor++;if(!(i in cells))cells[i]=value;return[cells[i],v=>cells[i]=v];},useEffect(fn){const i=cursor++;if(!(i in cells)){cells[i]=true;cleanups.push(fn());}}};
const useHook=load('src/hooks/useForumAction.ts',name=>name==='react'?react:{supabase}).useForumAction;
s.render=()=>{cursor=0;return useHook({ownerId:s.owner,refresh:()=>{s.refreshes++;return new Promise(r=>refreshResolve=r);},onSuccess:()=>s.successes++,onError:()=>s.errors++});};s.action=()=>{s.calls++;return new Promise(r=>actionResolve=r);};s.actionDone=()=>actionResolve();s.refreshDone=()=>refreshResolve();s.unmount=()=>cleanups.forEach(fn=>fn?.());return s;}
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
let s=hook();let h=s.render();const p=h.run(s.action,'done');h.run(s.action);await tick();assert.equal(s.calls,1);assert.equal(s.render().busy,true);s.actionDone();await tick();s.render().run(s.action);await tick();assert.equal(s.calls,1);assert.equal(s.refreshes,1);s.refreshDone();await p;assert.equal(s.render().busy,false);assert.equal(s.successes,1);
s=hook();const late=s.render().run(s.action,'done');await tick();s.unmount();s.actionDone();await late;assert.equal(s.refreshes,0);assert.equal(s.successes,0);
s=hook();state.owner='b';await s.render().run(s.action);assert.equal(s.calls,0);assert.equal(s.errors,1);state.owner='a';
console.log('PASS: real_action_hook_synchronous_lock_through_refresh_blocks_duplicate_clicks_and_late_or_wrong_account_callbacks');
