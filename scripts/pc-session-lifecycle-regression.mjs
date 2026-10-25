// Actual gate/layout; deterministic Auth, React lifecycle and browser-event models.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function load(file,require,globals={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:1,jsx:4,target:9}}).outputText,{module,exports:module.exports,require,console,...globals,fetch(){throw Error('Network forbidden');}});return module.exports;}
const {createMemberSessionGate}=load('src/lib/authenticated-session.ts',()=>({supabase:{}}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
function authHarness(){
 let owner='A',error=false,nextGate,reads=0;const callbacks=new Set();
 const auth={async getSession(){reads++;const result={data:{session:owner?{user:{id:owner}}:null},error:error?Error('synthetic'):null};const pending=nextGate;nextGate=undefined;if(pending)await pending.promise;return result;},onAuthStateChange(fn){callbacks.add(fn);return{data:{subscription:{unsubscribe(){callbacks.delete(fn);}}}};}};
 return{auth,owner(value,emit=true){owner=value;if(emit)callbacks.forEach(fn=>fn(value?'SIGNED_IN':'SIGNED_OUT',value?{user:{id:value}}:null));},refresh(){callbacks.forEach(fn=>fn('TOKEN_REFRESHED',owner?{user:{id:owner}}:null));},error(value){error=value;},hold(){return nextGate=deferred();},get reads(){return reads;},get listeners(){return callbacks.size;}};
}
{
 const a=authHarness(),gate=createMemberSessionGate(a.auth);let notified=0;const unsubscribe=gate.subscribe(()=>notified++);await tick();assert.equal(gate.getSnapshot().ownerId,'A');
 const initial=gate.getSnapshot();a.refresh();assert.equal(gate.getSnapshot(),initial);assert.equal(a.reads,1);
 a.owner('B');assert.equal(gate.getSnapshot().ownerId,'B');a.owner('A');assert(gate.getSnapshot().epoch>initial.epoch);
 const pending=a.hold();const checking=gate.recheck();a.owner(null);pending.resolve();await checking;assert.equal(gate.getSnapshot().ownerId,null);
 a.error(true);await gate.recheck();assert.equal(gate.getSnapshot().status,'error');a.error(false);a.owner('A',false);await gate.recheck();assert.equal(gate.getSnapshot().ownerId,'A');
 const late=a.hold();const lateCheck=gate.recheck();unsubscribe();late.resolve();await lateCheck;assert.equal(a.listeners,0);assert.equal(gate.getSnapshot().status,'checking');assert(notified>0);
 console.log('PASS: actual_store_sync_owner_changes_A_B_A_epoch_same_owner_stability_stale_read_error_retry_and_unsubscribe');
}
const jsx=(type,props,key)=>({type,props,key});
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
function layoutHarness(){
 const a=authHarness(),gate=createMemberSessionGate(a.auth),context={user:{id:'A'}},cells=[],effects=[],cleanups=[],events=new Map();
 let cursor=0,unmounted=false,holdRoutes=false,failRoute=false,lateWrites=0,invalidations=0,storageStatus='available',storageRevision=0;const routeGates=[],navigations=[];
 const state=value=>{const i=cursor++;if(!(i in cells))cells[i]=value;return[cells[i],value=>{if(unmounted)lateWrites++;cells[i]=typeof value==='function'?value(cells[i]):value;}];};
 const router={async invalidate(){invalidations++;if(holdRoutes){const pending=deferred();routeGates.push(pending);await pending.promise;}if(failRoute)throw Error('synthetic route error');const snapshot=gate.getSnapshot();if(snapshot.ownerId)context.user={id:snapshot.ownerId};},async navigate(value){if(failRoute)throw Error('synthetic navigation error');navigations.push(value);}};
 const react={Fragment:'Fragment',useState:state,useEffect(fn,deps){const i=cursor++;const previous=cells[i];if(!previous||deps.some((v,index)=>!Object.is(v,previous[index]))){cells[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}},useSyncExternalStore(subscribe,getSnapshot){const i=cursor++;if(!cells[i]){cells[i]=true;cleanups[i]=subscribe(()=>{});}return getSnapshot();}};
 const window={addEventListener(name,fn){events.set('w:'+name,fn);},removeEventListener(name){events.delete('w:'+name);}};
 const document={visibilityState:'visible',addEventListener(name,fn){events.set('d:'+name,fn);},removeEventListener(name){events.delete('d:'+name);}};
 const route=load('src/routes/_authenticated/route.tsx',name=>{
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='react')return react;
  if(name==='@tanstack/react-router')return{createFileRoute:()=>options=>({...options,useRouteContext:()=>context}),Outlet:'Outlet',redirect:options=>options,useRouter:()=>router};
  if(name==='@/lib/authenticated-session')return{memberSessionGate:gate};
  if(name==='@/hooks/useAuthStorageStatus')return{useAuthStorageStatus:()=>storageStatus};
  if(name==='@/lib/tab-auth-storage')return{authStorageAvailable:()=>storageStatus==='available',authStorageState:{getRevision:()=>storageRevision}};
  if(name==='@/i18n/LanguageProvider')return{useLanguage:()=>({language:'en'})};
  if(name==='@/components/MemberHeader')return{MemberHeader:'MemberHeader'};
  return{};
 },{window,document}).Route;
 return{storage(value){storageStatus=value;storageRevision++;},a,gate,context,navigations,routeGates,events,render(){cursor=0;const tree=route.component();effects.splice(0).forEach(fn=>fn());return tree;},async settle(){for(let i=0;i<5;i++){await tick();this.render();}},hold(value){holdRoutes=value;},fail(value){failRoute=value;},event(name,value={}){events.get(name)?.(value);},unmount(){unmounted=true;cleanups.forEach(fn=>fn?.());},get lateWrites(){return lateWrites;},get invalidations(){return invalidations;}};
}
const visible=tree=>nodes(tree).some(n=>n.type==='Outlet');
const role=(tree,value)=>nodes(tree).some(n=>n.props?.role===value);
const h=layoutHarness();assert(!visible(h.render()));await h.settle();assert(visible(h.render()));const firstKey=h.render().key,invalidations=h.invalidations;
h.a.refresh();await h.settle();assert.equal(h.render().key,firstKey);assert.equal(h.invalidations,invalidations);
h.hold(true);h.a.owner('B');assert(!visible(h.render()));await tick();assert(h.routeGates.length);h.a.owner('A');assert(!visible(h.render()));await tick();h.hold(false);h.routeGates.splice(0).forEach(g=>g.resolve());await h.settle();assert(visible(h.render()));assert.notEqual(h.render().key,firstKey);
h.a.owner(null);assert(!visible(h.render()));await h.settle();assert.equal(h.navigations.at(-1).to,'/auth');assert.equal(h.navigations.at(-1).replace,true);
console.log('PASS: actual_layout_initial_gate_sync_signout_B_switch_A_B_A_remount_stale_invalidation_ignored_same_owner_does_not_remount');
h.unmount();assert.equal(h.events.size,0);assert.equal(h.a.listeners,0);
const focus=layoutHarness();focus.render();await focus.settle();focus.a.owner(null,false);focus.event('w:focus');await focus.settle();assert(!visible(focus.render()));assert.equal(focus.navigations.at(-1).to,'/auth');focus.unmount();
const restore=layoutHarness();restore.render();await restore.settle();const pending=restore.a.hold();restore.event('w:pageshow',{persisted:true});assert(!visible(restore.render()));pending.resolve();await restore.settle();assert(visible(restore.render()));
restore.a.error(true);restore.event('d:visibilitychange');await restore.settle();assert(!visible(restore.render()));assert(role(restore.render(),'alert'));
restore.a.error(false);const retry=nodes(restore.render()).find(n=>n.type==='button');retry.props.onClick();await restore.settle();assert(visible(restore.render()));
restore.fail(true);restore.hold(false);restore.a.owner('B');restore.render();await restore.settle();assert(role(restore.render(),'alert'));assert(!visible(restore.render()));restore.fail(false);nodes(restore.render()).find(n=>n.type==='button').props.onClick();await restore.settle();assert(visible(restore.render()));
restore.hold(true);restore.a.owner('A');restore.render();await tick();restore.unmount();restore.routeGates.splice(0).forEach(g=>g.resolve());await tick();assert.equal(restore.lateWrites,0);assert.equal(restore.events.size,0);
console.log('PASS: focus_and_visibility_recheck_persisted_pageshow_hides_before_async_check_errors_fail_closed_retry_and_unmount_cleanup');
const storage=layoutHarness();storage.render();await storage.settle();assert(visible(storage.render()));const before=storage.invalidations;storage.storage('blocked');assert(!visible(storage.render()));await storage.settle();assert.equal(storage.invalidations,before);storage.storage('available');assert(!visible(storage.render()));await storage.settle();assert(visible(storage.render()));storage.unmount();
console.log('PASS: storage_denial_hides_member_subtree_recovery_revision_requires_fresh_validation_before_redisplay');
console.log('AUDIT: actual_source_local_models_passed; no_network_real_account_storage_clear_or_production_mutation; native_bfcache_and_recovery_browser_acceptance_pending');
