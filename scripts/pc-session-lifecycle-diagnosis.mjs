// Diagnosis only: actual root/layout functions with deterministic session/router models.
// No network, accounts, credentials, application changes or deployment.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {createRouter,createRootRoute,createRoute,createMemoryHistory,redirect} from '@tanstack/react-router';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function load(file,require){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:1,jsx:4,target:9}}).outputText,{module,exports:module.exports,require,console,fetch(){throw Error('Network forbidden');}});return module.exports;}
const jsx=(type,props,key)=>({type,props,key});
for(const change of [null,'B']){
 let owner='A',reads=0,denials=0;
 const guard=load('src/routes/_authenticated/route.tsx',name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='@tanstack/react-router'?{createFileRoute:()=>x=>x,redirect}:name==='@/integrations/supabase/client'?{supabase:{auth:{getSession:async()=>{reads++;return{data:{session:owner?{user:{id:owner}}:null},error:null};}}}}:{}).Route.beforeLoad;
 const root=createRootRoute();const privateRoute=createRoute({getParentRoute:()=>root,path:'/private',beforeLoad:async()=>{try{return await guard();}catch(error){assert.equal(error.options.to,'/auth');denials++;throw error;}}});const login=createRoute({getParentRoute:()=>root,path:'/auth'});
 const router=createRouter({routeTree:root.addChildren([privateRoute,login]),history:createMemoryHistory({initialEntries:['/private']}),isServer:false});
 await router.load();assert.equal(router.state.matches.at(-1).context.user.id,'A');const initialReads=reads;
 owner=change;
 // The actual root callback only clears QueryClient; it makes no router call.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(router.state.matches.at(-1).context.user.id,'A');assert.equal(reads,initialReads);
 await router.invalidate();
 assert(reads>initialReads);
 if(change)assert.equal(router.state.matches.at(-1).context.user.id,'B');else assert(denials>0);
 console.log('PASS: installed_router_retains_A_context_until_explicit_invalidation_after_'+(change?'B_switch':'signout')+'_then_guard_updates_owner_or_requests_auth_redirect');
}
for(const change of [null,'B']){
 let callback,clears=0,invalidations=0,navigations=0,sessionOwner='A',guardReads=0,unsubscribed=false;
 const effects=[];const routeContext={user:{id:'A'}};
 const auth={getSession:async()=>{guardReads++;return{data:{session:sessionOwner?{user:{id:sessionOwner}}:null},error:null};},onAuthStateChange(fn){callback=fn;return{data:{subscription:{unsubscribe(){unsubscribed=true;}}}};}};
 const router={invalidate(){invalidations++;},navigate(){navigations++;}};
 const queryClient={clear(){clears++;}};
 const rootRoute={createRootRouteWithContext:()=>options=>({...options,useRouteContext:()=>({queryClient})}),useRouter:()=>router,Outlet:'Outlet',Link:'Link',HeadContent:'Head',Scripts:'Scripts'};
 const resolve=name=>{
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'Fragment'};
  if(name==='react')return{useEffect:fn=>effects.push(fn),Fragment:'Fragment'};
  if(name==='@/integrations/supabase/client')return{supabase:{auth}};
  if(name==='@tanstack/react-query')return{QueryClientProvider:'Provider'};
  if(name==='@tanstack/react-router')return rootRoute;
  return{};
 };
 const root=load('src/routes/__root.tsx',resolve).Route;
 const authenticated=load('src/routes/_authenticated/route.tsx',name=>name==='@tanstack/react-router'?{...rootRoute,createFileRoute:()=>options=>({...options,useRouteContext:()=>routeContext}),redirect:options=>({redirect:options.to})}:resolve(name)).Route;
 assert.equal((await authenticated.beforeLoad()).user.id,'A');root.component();const cleanup=effects[0]();
 callback('INITIAL_SESSION',{user:{id:'A'}});
 callback('TOKEN_REFRESHED',{user:{id:'A'}});assert.equal(clears,0);
 sessionOwner=change;callback(change?'SIGNED_IN':'SIGNED_OUT',change?{user:{id:change}}:null);
 assert.equal(clears,1);assert.equal(invalidations,0);assert.equal(navigations,0);assert.equal(guardReads,1);
 const tree=authenticated.component();assert.equal(tree.key,'A');assert(tree.props.children.some(n=>n.type==='Outlet'));
 console.log('FINDING: '+(change?'A_to_B':'A_to_signed_out')+'_auth_event_clears_queries_but_no_route_revalidation_or_navigation_existing_layout_still_keyed_A_in_model');
 if(change){assert.equal((await authenticated.beforeLoad()).user.id,'B');routeContext.user={id:'B'};assert.equal(authenticated.component().key,'B');}
 else {await assert.rejects(authenticated.beforeLoad(),error=>error.redirect==='/auth');}
 cleanup();assert(unsubscribed);
}
const sources=['src/routes/__root.tsx','src/routes/_authenticated/route.tsx','src/router.tsx'].map(read).join('\n');
assert(!/addEventListener\(\s*['"](?:pageshow|visibilitychange)['"]/.test(sources));
console.log('PASS: fresh_guard_denies_signed_out_and_returns_new_owner_when_explicitly_run_same_owner_event_retains_cache_listener_cleanup');
console.log('COVERAGE: no_pageshow_or_visibility_revalidation_hook_in_inspected_root_layout_router; real_bfcache_expiry_cross_tab_native_behavior_not_tested');
console.log('AUDIT: local_diagnosis_complete=true; one_lifecycle_finding_group; no_network_real_account_or_production_mutation; browser_acceptance_pending');
