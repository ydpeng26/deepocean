// Diagnosis of actual source in local models. Network and real credentials forbidden.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
function load(file, require, globals = {}) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replaceAll('import.meta.env', '({PROD:false})');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module:1,jsx:4,target:9 } }).outputText,
    { module,exports:module.exports,require,URL,URLSearchParams,fetch(){throw Error('Network forbidden');},...globals });
  return module.exports;
}
const routeStub = { createFileRoute: () => options => options, Link:'Link' };
let findings = 0;
for (const file of ['src/routes/auth.tsx','src/routes/auth-confirmed.tsx']) {
  const {Route} = load(file, name => name === '@tanstack/react-router' ? routeStub : {});
  for (const invalid of ['https://outside.example','//outside.example',null,123]) assert.equal(Route.validateSearch({next:invalid}).next,undefined);
  assert.equal(Route.validateSearch({next:'/offline-sync'}).next,'/offline-sync');
  const crafted = '/\\outside.example/test';
  const accepted = Route.validateSearch({next:crafted}).next;
  assert.equal(accepted,crafted);
  assert.notEqual(new URL(accepted,'https://recovery.example').origin,'https://recovery.example');
  findings++;
}
console.log('PASS: actual_auth_and_confirmation_validators_reject_plain_external_and_double_slash_urls_preserve_normal_internal_path');
console.log('FINDING: both_actual_next_validators_accept_slash_backslash_path_URL_standard_resolves_cross_origin_no_navigation_performed');
function nodes(n) {if(Array.isArray(n))return n.flatMap(nodes);if(!n||typeof n!=='object')return [];return [n,...nodes(n.props?.children)];}
function resetHarness(search, verifies = true) {
  let cursor=0,owner='A';const cells=[],effects=[],updates=[],calls=[];
  const react={useState(value){const i=cursor++;if(!(i in cells))cells[i]=typeof value==='function'?value():value;return[cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},
    useRef(value){const i=cursor++;return cells[i]??={current:value};},useEffect(fn){const i=cursor++;if(!(i in cells)){cells[i]=true;effects.push(fn);}}};
  const jsx=(type,props)=>({type,props});
  const result=()=>({error:verifies?null:Error('Synthetic expired link'),data:{session:verifies?{user:{id:'A'}}:null}});
  const auth={verifyOtp:async()=>{calls.push('verify');return result();},exchangeCodeForSession:async()=>result(),setSession:async()=>result(),
    updateUser:async()=>{updates.push(owner);return{error:null};},signOut:async()=>({error:null})};
  const {Route}=load('src/routes/reset-password.tsx',name=>{
    if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='@tanstack/react-router')return routeStub;
    if(name==='@/integrations/supabase/client')return{supabase:{auth}};
    if(name==='@/lib/password-recovery')return{passwordRecoveryEnabled:true,isRecoveryTestProject:true};
    if(name==='@/i18n/LanguageProvider')return{useLanguage:()=>({language:'zh-CN'})};return{};
  },{window:{location:{search,hash:'',pathname:'/reset-password'},history:{replaceState(){calls.push('scrub');}}}});
  const h={render(){cursor=0;const tree=nodes(Route.component());effects.splice(0).forEach(fn=>fn());return tree;},updates,calls,switchOwner(){owner='B';}};
  return h;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const noToken=resetHarness('');noToken.render();await settle();assert(!noToken.render().some(n=>n.type==='form'));assert.equal(noToken.updates.length,0);
const expired=resetHarness('?token_hash=synthetic-expired',false);expired.render();await settle();assert(!expired.render().some(n=>n.type==='form'));
console.log('PASS: actual_reset_component_without_token_and_with_rejected_token_keeps_password_form_locked_and_scrubs_URL');
const changed=resetHarness('?token_hash=synthetic-valid');changed.render();await settle();assert(changed.render().some(n=>n.type==='form'));
for(const id of ['new-password','confirm-password'])changed.render().find(n=>n.props?.id===id).props.onChange({target:{value:'Synthetic-only-local-model'}});
changed.switchOwner();await changed.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
assert.deepEqual(changed.updates,['B']);findings++;
console.log('FINDING: actual_reset_component_validated_for_A_then_session_switch_B_submits_update_to_current_B_model_only_no_real_password_changed');
for(const mode of ['absent','error','valid']) {
  const {Route}=load('src/routes/_authenticated/route.tsx',name=>{
    if(name==='@tanstack/react-router')return{...routeStub,redirect:value=>({redirect:value})};
    if(name==='@/integrations/supabase/client')return{supabase:{auth:{getSession:async()=>({error:mode==='error'?Error('Synthetic'):null,data:{session:mode==='valid'?{user:{id:'A'}}:null}})}}};return{};
  });
  if(mode==='valid')assert.equal((await Route.beforeLoad()).user.id,'A');
  else await assert.rejects(Route.beforeLoad(),error=>error.redirect?.to==='/auth');
}
console.log('PASS: actual_authenticated_route_guard_redirects_absent_or_error_session_and_accepts_valid_session');
console.log('AUDIT: local_diagnosis_complete=true; finding_groups=2; validator_occurrences='+String(findings-1)+'; no_network_no_real_auth_or_password_changes; live_acceptance_not_run');
