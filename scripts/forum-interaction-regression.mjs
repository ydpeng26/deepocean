// Local-only API and component tests. No credentials/network/browser/database.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function load(path,require){const code=ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(code,{require,module,exports:module.exports,crypto:{randomUUID:()=> 'next-id'},fetch(){throw Error('Network forbidden');}});return module.exports;}
const state={owner:'a',comments:new Map(),blocks:[{blocker_id:'a',blocked_id:'b'}],writes:0,lost:false,fail:false,swap:false};
function query(table){let action='read',body,filters=[],range=null;const chain={select(){return chain;},eq(key,value){filters.push([key,value]);return chain;},order(){return chain;},range(a,b){range=[a,b];return chain;},insert(value){action='insert';body=value;return chain;},update(value){action='update';body=value;return chain;},delete(){action='delete';return chain;},then(resolve,reject){return execute(false).then(resolve,reject);},single(){return execute(true);},maybeSingle(){return execute(false,true);}};
  async function execute(single,maybe){let rows=table==='forum_comments'?[...state.comments.values()]:state.blocks;rows=rows.filter(row=>filters.every(([key,value])=>row[key]===value));
    if(action==='insert'){state.writes++;if(state.comments.has(body.id))return{data:null,error:{code:'23505'}};if(state.fail)return{data:null,error:{message:'Rejected'}};const row={...body,author_name:'Synthetic',created_at:'2026-10-22'};state.comments.set(row.id,row);if(state.lost){state.lost=false;return{data:null,error:{message:'Lost response'}};}rows=[row];}
    if(action==='update'){state.writes++;rows=rows.map(row=>{Object.assign(row,body);return row;});}
    if(action==='delete'){state.writes++;if(table==='forum_comments')for(const row of rows)state.comments.delete(row.id);else state.blocks=state.blocks.filter(row=>!rows.includes(row));}
    if(single&&!rows.length)return{data:null,error:{code:'PGRST116'}};
    if(maybe&&state.swap)state.owner='b';
    const count=rows.length;if(range)rows=rows.slice(range[0],range[1]+1);return{data:single||maybe?(rows[0]??null):rows,count,error:null};
  }return chain;
}
const supabase={auth:{getSession:async()=>({data:{session:{user:{id:state.owner}}}})},from:query,rpc:async()=>({data:[{display_name:'Synthetic B'}],error:null})};
const api=load('src/lib/forum.ts',()=>({supabase}));
state.lost=true;await assert.rejects(api.addForumComment('post',' body ','stable','a'));assert.equal(state.comments.size,1);
assert.equal((await api.addForumComment('post','body','stable','a')).id,'stable');assert.equal(state.writes,1);
await assert.rejects(api.addForumComment('post','changed','stable','a'));assert.equal(state.writes,1);
console.log('PASS: lost_response_retry_confirms_same_comment_and_rejects_changed_payload');
state.comments.clear();state.writes=0;await Promise.all([api.addForumComment('post','race','race','a'),api.addForumComment('post','race','race','a')]);assert.equal(state.comments.size,1);
console.log('PASS: concurrent_same_request_id_confirms_one_comment');
for(const body of ['','   ','x'.repeat(1001)])await assert.rejects(api.addForumComment('post',body,'invalid','a'));
state.owner='b';const before=state.writes;await assert.rejects(api.addForumComment('post','valid','x','a'));await assert.rejects(api.updateForumComment('race','post','edit','a'));await assert.rejects(api.deleteForumComment('race','post','a'));await assert.rejects(api.unblockForumAuthor('b','a'));assert.equal(state.writes,before);
state.owner='a';state.swap=true;await assert.rejects(api.addForumComment('post','valid','swap','a'));assert.equal(state.writes,before);state.swap=false;state.owner='a';
console.log('PASS: invalid_body_and_changed_account_before_write_rejected');
await assert.rejects(api.updateForumComment('missing','post','edit','a'));await assert.rejects(api.deleteForumComment('missing','post','a'));assert.equal((await api.updateForumComment('race','post','edited','a')).body,'edited');await api.deleteForumComment('race','post','a');assert.equal(state.comments.size,0);
const blocked=await api.listBlockedForumAuthors('a');assert.equal(blocked[0].name,'Synthetic B');await api.unblockForumAuthor('b','a');assert.equal(state.blocks.length,0);await assert.rejects(api.unblockForumAuthor('b','a'));
console.log('PASS: comment_edit_delete_and_unblock_require_actual_owner_scoped_rows');

function nodes(tree,out=[]){if(Array.isArray(tree))for(const item of tree)nodes(item,out);else if(tree&&typeof tree==='object'){if(tree.type)out.push(tree);nodes(tree.props?.children,out);}return out;}
const text=value=>typeof value==='string'?value:Array.isArray(value)?value.map(text).join(''):text(value?.props?.children??'');
function component(){let cursor=0;const cells=[],effects=[];let pendingResolve,pendingReject;const s={calls:0,changes:0,invalidations:0,closed:0,draft:{body:'Original',requestId:'stable'},query:{data:[],isError:false,isPending:false,isFetching:false,refetch:async()=>{}},tree:null};
  const react={useRef(value){const i=cursor++;return cells[i]??=( {current:value});},useState(value){const i=cursor++;if(!(i in cells))cells[i]=value;return[cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},useEffect(fn){const i=cursor++;if(!(i in cells)){cells[i]=true;effects.push(fn());}}};
  const jsx=(type,props)=>({type,props});
  const Component=load('src/components/ForumCommentsDialog.tsx',name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='@tanstack/react-query')return{useQuery:()=>s.query,useQueryClient:()=>({invalidateQueries:async()=>{s.invalidations++;}})};if(name==='@/lib/forum')return{addForumComment:()=>{s.calls++;return new Promise((resolve,reject)=>{pendingResolve=resolve;pendingReject=reject;});}};return new Proxy({},{get:(_,key)=>key});}).ForumCommentsDialog;
  s.render=()=>{cursor=0;s.tree=Component({post:{id:'post',title:'Synthetic'},ownerId:'a',language:'zh-CN',draft:s.draft,onDraftChange:draft=>{s.draft=draft;s.changes++;},onClose:()=>s.closed++});return nodes(s.tree);};
  s.button=label=>s.render().find(n=>n.type==='button'&&(text(n.props.children)===label||n.props['aria-label']===label));s.resolve=()=>pendingResolve();s.reject=()=>pendingReject(Error('Synthetic'));s.unmount=()=>effects.forEach(fn=>fn?.());return s;
}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let s=component();const send=s.button('发送');send.props.onClick();send.props.onClick();assert.equal(s.calls,1);assert.equal(s.button('正在处理…').props.disabled,true);const input=s.render().find(n=>n.type==='textarea');assert.equal(input.props.disabled,true);input.props.onChange({target:{value:'Unsent'}});s.button('取消').props.onClick();assert.equal(s.closed,0);assert.equal(s.changes,0);s.reject();await tick();assert.equal(s.draft.body,'Original');assert.equal(s.draft.requestId,'stable');assert.equal(s.render().some(n=>n.props?.role==='alert'),true);
s.button('发送').props.onClick();s.resolve();await tick();assert.equal(s.draft.body,'');assert.equal(s.invalidations,2);
console.log('PASS: real_dialog_synchronous_lock_pending_fields_failure_draft_and_success_reset');
s=component();s.query={...s.query,isError:true};assert.ok(s.button('重新加载回应'));assert.equal(s.render().some(n=>text(n.props?.children)==='还没有回应。'),false);
s=component();s.button('发送').props.onClick();s.unmount();s.resolve();await tick();assert.equal(s.changes,0);assert.equal(s.invalidations,0);
console.log('PASS: real_dialog_error_not_empty_and_no_late_updates_after_unmount');
s=component();s.query.data=Array.from({length:105},(_,i)=>({id:'comment-'+i,userId:'other',author:'Synthetic',body:'Body '+i}));
assert.equal(s.render().filter(n=>n.type==='article').length,50);
for(const expected of [100,105]){s.render().find(n=>n.type==='button'&&text(n.props.children).startsWith('继续查看回应')).props.onClick();assert.equal(s.render().filter(n=>n.type==='article').length,expected);}
assert.equal(s.render().some(n=>n.type==='button'&&text(n.props.children).startsWith('继续查看回应')),false);
console.log('PASS: real_comment_dialog_bounded_50_row_windows_reach_last_comment_and_end_control_disappears');
