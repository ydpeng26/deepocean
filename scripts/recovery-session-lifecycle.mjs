// GitHub cloud only. Two disposable recovery accounts, synthetic local text, exact cleanup.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api='https://esovqvampbrhuhamkfcs.supabase.co',site='https://supdiver-recovery-test.vercel.app';
const admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
const users=[];let browser,page,stage='cloud guard',failed=false,unsafe=false;
const check=(value,code)=>{if(!value){const e=Error(code);e.auditCode=code;throw e;}};
const pass=message=>console.log('PASS: '+message);
async function request(path,{method='GET',body,publicAuth=false}={}){
 check(path.startsWith('/')&&!path.startsWith('//'),'relative_recovery_path');
 const key=publicAuth?anon:admin;
 const r=await fetch(api+path,{method,signal:AbortSignal.timeout(45000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}return{ok:r.ok,status:r.status,data};
}
async function req(path,options){const r=await request(path,options);check(r.ok,'recovery_http_'+r.status);return r.data;}
async function makeUser(label){
 const email='lifecycle-'+randomBytes(12).toString('hex')+'@example.invalid',password=randomBytes(32).toString('base64url');
 const user=await req('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});const fixture={...user,email,password,label};users.push(fixture);
 const updated=await req('/rest/v1/profiles?id=eq.'+user.id,{method:'PATCH',body:{display_name:label,bio:'synthetic lifecycle fixture'}});
 if(!updated.length)await req('/rest/v1/profiles',{method:'POST',body:{id:user.id,display_name:label,bio:'synthetic lifecycle fixture',tank_count:0}});
 return fixture;
}
async function tokenSession(user){const s=await req('/auth/v1/token?grant_type=password',{method:'POST',publicAuth:true,body:{email:user.email,password:user.password}});return{access_token:s.access_token,refresh_token:s.refresh_token};}
async function clientAction(page,action,value){return page.evaluate(async({action,value})=>{
 const paths=await(await fetch('/offline-assets.json')).json(),path=paths.find(p=>/^\/assets\/client-[^/]+\.js$/.test(p));if(!path)return false;
 const module=await import(path),client=Object.values(module).find(v=>v&&typeof v==='object'&&typeof v.auth?.setSession==='function');if(!client)return false;
 if(action==='set')return !(await client.auth.setSession(value)).error;
 if(action==='out')return !(await client.auth.signOut({scope:'local'})).error;
 if(action==='fail'){window.__lifecycleAuth=client.auth;window.__lifecycleOriginal=client.auth.getSession;client.auth.getSession=async()=>{throw Error('synthetic session read failure');};window.dispatchEvent(new Event('focus'));return true;}
 if(action==='restore'){window.__lifecycleAuth.getSession=window.__lifecycleOriginal;delete window.__lifecycleAuth;delete window.__lifecycleOriginal;return true;}
 return false;
},{action,value});}
async function login(page,user){await page.goto(site+'/auth?next=%2Fprofile',{waitUntil:'networkidle',timeout:90000});await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill(user.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/profile',{timeout:60000});await profile(page,user.label);}
async function profile(page,label){await page.waitForFunction(label=>document.querySelector('.do-profile-fields input')?.value===label,label,{timeout:45000});}
async function drafts(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('supdiver-offline',1);r.onerror=()=>reject(Error('fixture draft read'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('dive-drafts','readonly'),q=tx.objectStore('dive-drafts').getAll();q.onsuccess=()=>resolve(q.result.map(row=>({id:row.id,site:row.site_name})));tx.oncomplete=()=>db.close();tx.onerror=()=>reject(Error('fixture draft read'));};}));}
try{
 check(process.env.GITHUB_ACTIONS==='true'&&!!admin,'cloud_only_recovery_guard');
 stage='fixed site repair preflight';const manifestResponse=await fetch(site+'/offline-assets.json',{signal:AbortSignal.timeout(30000),cache:'no-store'});check(manifestResponse.ok,'fixed_site_manifest');const assets=await manifestResponse.json();check(Array.isArray(assets),'fixed_site_asset_list');
 const scripts=await Promise.all(assets.filter(path=>/^\/assets\/[^/]+\.js$/.test(path)).map(async path=>{const r=await fetch(site+path,{signal:AbortSignal.timeout(30000)});check(r.ok,'fixed_site_public_script');return r.text();}));
 check(scripts.some(text=>text.includes('Unable to verify your session. Your private pages are hidden.')),'fixed_site_missing_lifecycle_repair');pass('fixed_site_public_bundle_contains_session_lifecycle_repair_before_creating_accounts');
 const A=await makeUser('Lifecycle fixture A'),B=await makeUser('Lifecycle fixture B');
 browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),method=route.request().method();if((u.hostname.endsWith('.supabase.co')&&u.origin!==api)||['supdiver.com','www.supdiver.com'].includes(u.hostname)){unsafe=true;return route.abort();}if(u.origin===api&&!['GET','HEAD','OPTIONS'].includes(method)&&!['/auth/v1/token','/auth/v1/logout'].includes(u.pathname)){unsafe=true;return route.abort();}return route.continue();});
 await context.addInitScript(()=>localStorage.setItem('deepocean-language','zh-CN'));page=await context.newPage();
 stage='synthetic device draft';await page.goto(site+'/offline',{waitUntil:'networkidle',timeout:90000});await page.getByLabel('潜水国家',{exact:true}).fill('Indonesia');await page.getByLabel('潜点名称',{exact:true}).fill('Lifecycle device-only draft');await page.getByRole('button',{name:'保存到此设备',exact:true}).click();await page.waitForFunction(()=>document.body.textContent.includes('Lifecycle device-only draft'));
 const originalDrafts=await drafts(page);check(originalDrafts.length===1,'exact_one_device_fixture_draft');
 stage='initial member gate and same owner';await login(page,A);const input=page.locator('.do-profile-fields input').first();await input.fill('Unsaved lifecycle A marker');check(await clientAction(page,'set',await tokenSession(A)),'same_owner_client_set');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(600);check(await input.inputValue()==='Unsaved lifecycle A marker','same_owner_reset_unsaved_editor');
 pass('actual_signin_member_gate_completes_same_owner_session_and_focus_preserve_unsaved_editor');
 stage='A to B mounted profile';await page.evaluate(()=>{const router=window.__TSR_ROUTER__;if(router){const original=router.invalidate.bind(router);window.__lifecycleRouteAudit={started:0,settled:0,rejected:0};router.invalidate=(...args)=>{window.__lifecycleRouteAudit.started++;return original(...args).then(value=>{window.__lifecycleRouteAudit.settled++;return value;},error=>{window.__lifecycleRouteAudit.rejected++;throw error;});};}});check(await clientAction(page,'set',await tokenSession(B)),'B_client_set');await profile(page,B.label);check(!(await page.locator('input').evaluateAll(nodes=>nodes.some(n=>n.value==='Unsaved lifecycle A marker'))),'A_draft_visible_under_B');
 stage='A B A epoch';check(await clientAction(page,'set',await tokenSession(A)),'A_client_set');await profile(page,A.label);await input.fill('Second unsaved A marker');check(await clientAction(page,'set',await tokenSession(B)),'B_again');check(await clientAction(page,'set',await tokenSession(A)),'A_again');await profile(page,A.label);
 pass('actual_A_B_and_A_B_A_switches_refresh_route_context_replace_old_profile_and_discard_old_in_memory_edit');
 stage='external local signout without button navigation';check(await clientAction(page,'out'),'fixture_local_signout');await page.waitForURL('**/auth',{timeout:45000});check(await page.locator('.do-member-header,.do-profile-fields').count()===0,'private_subtree_after_signout');await page.goto(site+'/profile',{waitUntil:'networkidle'});await page.waitForURL('**/auth');
 pass('actual_signout_event_routes_to_auth_without_logout_button_protected_reload_stays_locked');
 stage='read failure and retry';await login(page,B);check(await clientAction(page,'fail'),'inject_session_read_error');await page.getByRole('alert').filter({hasText:'暂时无法核对登录状态'}).waitFor();check(await page.locator('.do-member-header,.do-profile-fields').count()===0,'private_subtree_after_read_failure');check(await clientAction(page,'restore'),'restore_fixture_client_method');await page.getByRole('button',{name:'重试',exact:true}).click();await profile(page,B.label);
 pass('actual_focus_read_failure_hides_private_subtree_retry_restores_current_account');
 stage='synthetic persisted pageshow';await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await profile(page,B.label);
 pass('synthetic_persisted_pageshow_handler_returns_to_verified_B_not_native_bfcache_acceptance');
 stage='silent device session loss on focus';await page.evaluate(()=>{sessionStorage.removeItem('sb-esovqvampbrhuhamkfcs-auth-token');window.dispatchEvent(new Event('focus'));});await page.waitForURL('**/auth',{timeout:45000});check(await page.locator('.do-profile-fields').count()===0,'profile_after_silent_device_session_loss');
 const finalDrafts=await drafts(page);check(JSON.stringify(finalDrafts)===JSON.stringify(originalDrafts),'device_drafts_changed');
 for(const user of users){const rows=await req('/rest/v1/profiles?id=eq.'+user.id+'&select=display_name');check(rows.length===1&&rows[0].display_name===user.label,'unsaved_editor_persisted');}
 check(!unsafe,'traffic_guard_failed');pass('focus_detects_device_session_loss_saved_local_draft_retained_no_profile_edits_persisted');
}catch(error){failed=true;console.log('INCOMPLETE: stage='+stage+'; error='+error.constructor.name+'; check='+(error.auditCode||'browser_operation')+'; details suppressed');
 if(page&&users.length===2)try{const diagnostic=await page.evaluate(({a,b})=>{const router=window.__TSR_ROUTER__,contexts=(router?.state.matches||[]).map(match=>match.context?.user?.id).filter(Boolean);return{atProfile:location.pathname==='/profile',atAuth:location.pathname==='/auth',memberHeader:!!document.querySelector('.do-member-header'),profileEditor:!!document.querySelector('.do-profile-fields'),checking:document.body.textContent.includes('正在核对登录状态'),gateError:document.body.textContent.includes('暂时无法核对登录状态'),contextA:contexts.includes(a),contextB:contexts.includes(b),profileA:document.querySelector('.do-profile-fields input')?.value==='Lifecycle fixture A',profileB:document.querySelector('.do-profile-fields input')?.value==='Lifecycle fixture B',oldUnsavedA:document.querySelector('.do-profile-fields input')?.value==='Unsaved lifecycle A marker',routerAudit:window.__lifecycleRouteAudit||null};},{a:users[0].id,b:users[1].id});console.log('DIAGNOSTIC: '+JSON.stringify(diagnostic));}catch{console.log('DIAGNOSTIC: safe_browser_state_unavailable');}
}
finally{
 try{await browser?.close();}catch{failed=true;console.log('INCOMPLETE: browser_cleanup');}
 let removed=0;for(const user of users){try{await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});const absent=await request('/auth/v1/admin/users/'+user.id),profiles=await req('/rest/v1/profiles?id=eq.'+user.id+'&select=id');check(absent.status===404&&profiles.length===0,'fixture_cleanup_absence');removed++;}catch{failed=true;console.log('INCOMPLETE: exact_disposable_fixture_cleanup '+user.id);}}
 const clean=users.length===removed;if(clean)pass(users.length===2?'exact_two_disposable_auth_users_and_profiles_absence_verified_isolated_browser_dropped':'no_remaining_disposable_accounts');
 console.log('AUDIT: complete='+(!failed&&clean&&!unsafe)+'; recovery_only; no_mail_photos_password_change_exports_or_existing_user_edits; native_bfcache_pending');if(failed||!clean||unsafe)process.exitCode=1;
}
