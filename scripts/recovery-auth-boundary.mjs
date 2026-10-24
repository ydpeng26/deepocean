// Recovery-only cloud browser acceptance. No mail or real password update.
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.RECOVERY_PLAYWRIGHT_MODULE||'playwright');
const api='https://esovqvampbrhuhamkfcs.supabase.co',site='https://supdiver-recovery-test.vercel.app';
const admin=process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon=(await readFile(new URL('./recovery-browser.mjs',import.meta.url),'utf8')).match(/const anon = '([^']+)'/)[1];
const users=[],releases=[];let browser,stage='guard',failed=false,unsafe=false,unexpectedWrites=0;
const check=(ok,code)=>{if(!ok){const e=Error(code);e.auditCode=code;throw e;}};
const pass=name=>console.log('PASS: '+name);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
async function bounded(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('gate_timeout')),45000);})]);}finally{clearTimeout(timer);}}
async function request(path,{method='GET',body,publicAuth=false}={}){
  check(path.startsWith('/')&&!path.startsWith('//'),'relative_recovery_path');
  const key=publicAuth?anon:admin;
  const r=await fetch(api+path,{method,signal:AbortSignal.timeout(45000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}return{ok:r.ok,status:r.status,data};
}
async function req(path,options){const r=await request(path,options);check(r.ok,'recovery_http_'+r.status);return r.data;}
async function makeUser(){const email='auth-boundary-'+randomBytes(12).toString('hex')+'@example.invalid',password=randomBytes(32).toString('base64url');const user=await req('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});const fixture={...user,email,password};users.push(fixture);return fixture;}
async function tokenSession(user){const s=await req('/auth/v1/token?grant_type=password',{method:'POST',publicAuth:true,body:{email:user.email,password:user.password}});return{access_token:s.access_token,refresh_token:s.refresh_token};}
async function switchSession(page,value){check(await page.evaluate(async s=>{const paths=await(await fetch('/offline-assets.json')).json();const path=paths.find(p=>/^\/assets\/client-[^/]+\.js$/.test(p));if(!path)return false;const module=await import(path);const client=Object.values(module).find(v=>v&&typeof v==='object'&&typeof v.auth?.setSession==='function');if(!client)return false;return !(await client.auth.setSession(s)).error;},value),'actual_client_session_switch');}
async function login(page,user,next,expected){await page.goto(site+'/auth?next='+encodeURIComponent(next),{waitUntil:'networkidle',timeout:90000});await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill(user.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(u=>u.origin===site&&u.pathname===expected,{timeout:45000});}
async function reset(page,user){const generated=await req('/auth/v1/admin/generate_link',{method:'POST',body:{type:'recovery',email:user.email}});check(generated.hashed_token,'generated_fixture_recovery_hash');await page.goto(site+'/reset-password?token_hash='+encodeURIComponent(generated.hashed_token),{waitUntil:'networkidle',timeout:90000});await page.getByRole('button',{name:'保存新密码',exact:true}).waitFor();check(!page.url().includes('token_hash'),'recovery_URL_scrubbed');}
try{
  check(process.env.GITHUB_ACTIONS==='true'&&!!admin,'cloud_only_recovery_guard');const A=await makeUser(),B=await makeUser();
  browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',serviceWorkers:'block'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if((u.hostname.endsWith('.supabase.co')&&u.origin!==api)||['supdiver.com','www.supdiver.com','outside.example'].includes(u.hostname)){unsafe=true;return route.abort();}if(u.origin===api&&u.pathname==='/auth/v1/user'&&route.request().method()==='PUT'){unexpectedWrites++;return route.abort();}return route.continue();});
  await context.addInitScript(()=>localStorage.setItem('deepocean-language','zh-CN'));const page=await context.newPage();
  stage='real login return normalization';await login(page,A,'/\\outside.example/test','/dives');await login(page,A,'/offline-sync','/offline-sync');
  pass('actual_login_rejects_slash_backslash_external_return_preserves_normal_internal_return');
  stage='confirmation navigation consumer';await page.goto(site+'/auth-confirmed?next='+encodeURIComponent('/\\outside.example/test'),{waitUntil:'networkidle'});await page.getByRole('button',{name:'进入 SupDiver',exact:true}).click();await page.waitForURL('**/dives');
  pass('actual_existing_session_confirmation_enter_action_rejects_external_return_without_external_navigation');
  stage='missing and invalid recovery link';await page.goto(site+'/reset-password',{waitUntil:'networkidle'});await page.getByRole('alert').waitFor();check(await page.locator('form').count()===0,'missing_token_form_unlocked');await page.goto(site+'/reset-password?token_hash=synthetic-invalid-token',{waitUntil:'networkidle'});await page.getByRole('alert').waitFor();check(await page.locator('form').count()===0,'invalid_token_form_unlocked');
  pass('actual_signed_in_missing_or_invalid_recovery_link_stays_locked');
  stage='verified A then B session switch';await reset(page,A);await switchSession(page,await tokenSession(B));await page.getByRole('alert').waitFor();check(await page.locator('form').count()===0,'changed_owner_form_unlocked');await switchSession(page,await tokenSession(A));check(await page.locator('form').count()===0,'A_B_A_unlocked_stale_recovery');
  pass('actual_verified_A_then_B_and_back_to_A_latches_invalid_clears_form_without_password_request');
  let mockedWrites=0;
  stage='pending password request uses A token and ignores B late result';await reset(page,A);const entered=deferred(),release=deferred();releases.push(release);
  await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()!=='PUT')return route.continue();const bearer=route.request().headers().authorization?.replace(/^Bearer /,'');check(bearer,'fixture_bearer');const claims=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString());check(claims.sub===A.id,'mutation_not_bound_to_A');mockedWrites++;entered.resolve();await bounded(release.promise);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:A.id})});});
  await page.getByLabel('新密码',{exact:true}).fill('Synthetic-intercepted-only-123');await page.getByLabel('确认新密码',{exact:true}).fill('Synthetic-intercepted-only-123');await page.getByRole('button',{name:'保存新密码',exact:true}).click();await bounded(entered.promise);
  await switchSession(page,await tokenSession(B));release.resolve();await page.getByRole('alert').waitFor();check(await page.locator('form').count()===0,'late_mutation_result_unlocked_B');check(await page.getByRole('status').count()===0,'A_success_displayed_under_B');check(mockedWrites===1,'unexpected_mock_write_count');
  pass('actual_request_binds_A_bearer_B_switch_locks_form_late_mock_response_not_published_no_backend_password_update');
  await page.unroute(api+'/auth/v1/user');
  stage='normal verified flow with intercepted mutation';await reset(page,A);await page.route(api+'/auth/v1/user',route=>route.request().method()==='PUT'?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:A.id})}):route.continue());
  await page.getByLabel('新密码',{exact:true}).fill('Synthetic-intercepted-only-456');await page.getByLabel('确认新密码',{exact:true}).fill('Synthetic-intercepted-only-456');await page.getByRole('button',{name:'保存新密码',exact:true}).click();await page.getByRole('status').waitFor();check(await page.locator('form').count()===0,'normal_flow_form_remaining');
  await tokenSession(A);await tokenSession(B);check(unexpectedWrites===0&&!unsafe,'traffic_guard_failed');
  pass('normal_UI_mocked_update_and_local_logout_complete_both_original_fixture_passwords_still_work_no_mail_or_real_password_change');
}catch(error){failed=true;console.log('INCOMPLETE: stage='+stage+'; error='+error.constructor.name+'; check='+(error.auditCode||'browser_operation')+'; details suppressed');}
finally{
  releases.forEach(g=>g.resolve());if(browser)await browser.close();let removed=0;
  for(const user of users){try{await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});const absent=await request('/auth/v1/admin/users/'+user.id);const profiles=await req('/rest/v1/profiles?id=eq.'+user.id+'&select=id');check(absent.status===404&&profiles.length===0,'fixture_cleanup_absence');removed++;}catch{failed=true;console.log('INCOMPLETE: exact_disposable_fixture_cleanup '+user.id);}}
  const clean=users.length===2&&removed===2;if(clean)pass('exact_two_disposable_users_profiles_cleanup_verified_no_existing_user_data_changed');
  console.log('AUDIT: complete='+(!failed&&clean&&!unsafe&&!unexpectedWrites)+'; recovery_only; mutations_intercepted_not_real_password_update; no_mail_photos_exports');if(failed||!clean||unsafe||unexpectedWrites)process.exitCode=1;
}
