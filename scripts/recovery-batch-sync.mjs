// Cloud recovery only. Disposable users and synthetic text, exact cleanup.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api = 'https://esovqvampbrhuhamkfcs.supabase.co', site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
const users = [], contexts = [], releases = [];
let browser, stage = 'guard', failed = false, productionTraffic = false, cleaned = false;
const check = (ok, code) => { if (!ok) { const error = Error(code); error.auditCode = code; throw error; } };
const pass = name => console.log('PASS: ' + name);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function poll(fn, predicate) { for (let i = 0; i < 100; i++) { const v = await fn(); if (predicate(v)) return v; await new Promise(r => setTimeout(r, 250)); } throw Error('State did not settle'); }
async function request(path, { method = 'GET', body } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'relative_recovery_path');
  const r = await fetch(api + path, { method, signal: AbortSignal.timeout(45000), headers: { apikey: admin, Authorization: 'Bearer ' + admin,
    'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: r.ok, status: r.status, data };
}
async function req(path, options) { const r = await request(path, options); check(r.ok, 'recovery_http_' + r.status); return r.data; }
async function makeUser() {
  const email = 'batch-' + randomBytes(12).toString('hex') + '@example.invalid', password = randomBytes(32).toString('base64url');
  const user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  const fixture = { ...user, email, password }; users.push(fixture); return fixture;
}
async function session(user) {
  const r = await fetch(api + '/auth/v1/token?grant_type=password', { method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password: user.password }) });
  check(r.ok, 'fixture_signin'); const s = await r.json(); return { access_token: s.access_token, refresh_token: s.refresh_token };
}
async function newContext(noLocks = false) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', serviceWorkers: 'block' }); contexts.push(c);
  await c.route('**/*', route => { const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com','www.supdiver.com'].includes(u.hostname)) { productionTraffic = true; return route.abort(); }
    return route.continue(); });
  await c.addInitScript(noLocks => { localStorage.setItem('deepocean-language','zh-CN');
    if (noLocks) Object.defineProperty(navigator,'locks',{ value:undefined,configurable:true }); }, noLocks);
  return c;
}
async function login(page, user) {
  await page.goto(site + '/auth', { waitUntil:'networkidle',timeout:90000 });
  await page.getByLabel('邮箱',{exact:true}).fill(user.email); await page.getByLabel('密码',{exact:true}).fill(user.password);
  await page.getByRole('button',{name:'登录',exact:true}).click(); await page.waitForURL('**/dives',{timeout:60000});
}
async function drafts(page) { return page.evaluate(() => new Promise((resolve,reject) => {
  const r = indexedDB.open('supdiver-offline',1); r.onerror = reject;
  r.onsuccess = () => { const db=r.result,tx=db.transaction('dive-drafts','readonly'),q=tx.objectStore('dive-drafts').getAll(); let rows;
    q.onsuccess=()=>{rows=q.result;};tx.oncomplete=()=>{db.close();resolve(rows);};tx.onerror=()=>{db.close();reject(Error('Read failed'));}; };
})); }
async function seed(page, marker) {
  await page.goto(site + '/offline',{waitUntil:'networkidle'});
  await page.getByLabel('潜水国家',{exact:true}).fill('Indonesia'); await page.getByLabel('潜点名称',{exact:true}).fill(marker);
  await page.getByRole('textbox',{name:'深蓝记忆',exact:true}).fill('synthetic original');
  await page.getByRole('button',{name:'保存到此设备',exact:true}).click();
  return poll(()=>drafts(page),rows=>rows.some(r=>r.site_name===marker));
}
async function workspace(page, user) {
  await page.goto(site + '/offline-sync',{waitUntil:'networkidle'}); await page.getByText(user.email,{exact:true}).waitFor();
}
async function select(page, marker) { await page.getByRole('button',{name:'选择草稿 '+marker,exact:true}).click(); }
async function sync(page) { page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'同步到我的账号',exact:true}).click(); }
async function switchSession(page, fixtureSession) {
  check(await page.evaluate(async value => {
    const manifest=await (await fetch('/offline-assets.json')).json(), path=manifest.find(p=>/^\/assets\/client-[^/]+\.js$/.test(p));
    if(!path)return false; const module=await import(path);
    const client=Object.values(module).find(value=>value && typeof value==='object' && typeof value.auth?.setSession==='function');
    if(!client)return false; const {error}=await client.auth.setSession(value);return !error;
  },fixtureSession),'actual_client_session_switch');
}
async function rows(user) { return req('/rest/v1/dives?user_id=eq.'+user.id+'&select=id,site_name,notes'); }
async function holdInsert(page) {
  const entered=deferred(),release=deferred(); releases.push(release); let held=false, body;
  await page.route(api+'/rest/v1/dives**',async route=>{
    if(route.request().method()!=='POST'||held)return route.continue(); held=true;body=route.request().postDataJSON();
    const response=await route.fetch();check(response.ok(),'fixture_insert_committed');entered.resolve();await release.promise;
    return route.fulfill({response});
  });
  return { entered,release,body:()=>body };
}
try {
  check(process.env.GITHUB_ACTIONS==='true' && !!admin,'cloud_recovery_guard');
  const marker='BATCH-'+randomBytes(7).toString('hex'), A=await makeUser(),B=await makeUser();
  browser=await chromium.launch({channel:process.env.RECOVERY_BROWSER_CHANNEL||undefined});
  stage='batch account switch after committed response';
  const c=await newContext(),p=await c.newPage();await login(p,A);
  await seed(p,marker+'-ONE');await seed(p,marker+'-TWO');await workspace(p,A);
  await select(p,marker+'-ONE');await select(p,marker+'-TWO');const held=await holdInsert(p);await sync(p);await held.entered.promise;
  await switchSession(p,await session(B));await p.getByText(B.email,{exact:true}).waitFor();held.release.resolve();
  await p.getByRole('button',{name:'同步到我的账号',exact:true}).waitFor();
  check((await rows(A)).length===1 && (await rows(B)).length===0,'batch_did_not_stop_at_owner_change');
  check((await drafts(p)).length===2,'unconfirmed_drafts_removed_after_switch');
  check(await p.locator('[aria-pressed="true"]').count()===0,'old_selection_survived_account_change');
  check(!await p.getByText(/同步完成：/).count(),'old_success_under_new_account');
  pass('actual_account_switch_after_A_commit_stops_remaining_batch_retains_two_local_drafts_clears_selection_no_B_row_or_late_A_success');
  stage='foreign duplicate cannot be confirmed by B';await p.unroute(api+'/rest/v1/dives**');
  await select(p,held.body().site_name);await sync(p);await p.locator('[role="alert"]').waitFor();
  check((await rows(B)).length===0 && (await drafts(p)).length===2,'foreign_duplicate_removed_or_uploaded');
  pass('actual_B_cannot_confirm_A_duplicate_or_remove_local_draft');
  stage='explicit original-account retry';await switchSession(p,await session(A));await p.getByText(A.email,{exact:true}).waitFor();
  await select(p,marker+'-ONE');await select(p,marker+'-TWO');await sync(p);await p.getByText('同步完成：2 条记录已保存到账号。',{exact:true}).waitFor();
  check((await rows(A)).length===2 && (await rows(B)).length===0 && (await drafts(p)).length===0,'retry_duplicate_or_missing_row');
  pass('actual_explicit_A_retry_confirms_prior_commit_and_uploads_only_remaining_draft_without_duplicate');
  stage='real origin lock across independently logged-in tabs';
  const lc=await newContext(),la=await lc.newPage(),lb=await lc.newPage();await login(la,A);await login(lb,A);
  check(await la.evaluate(()=>!!navigator.locks),'WebLocks_not_available_in_Chromium');
  await seed(la,marker+'-LOCK');await workspace(la,A);await workspace(lb,A);await select(la,marker+'-LOCK');await select(lb,marker+'-LOCK');
  const lockHeld=await holdInsert(la);let bPosts=0;lb.on('request',r=>{if(r.url().startsWith(api+'/rest/v1/dives')&&r.method()==='POST')bPosts++;});
  await sync(la);await lockHeld.entered.promise;await sync(lb);await lb.getByText('另一个页面正在同步。请等待完成后，刷新列表并重新核对草稿。',{exact:true}).waitFor();
  check(bPosts===0,'busy_tab_sent_insert');lockHeld.release.resolve();await la.getByText('同步完成：1 条记录已保存到账号。',{exact:true}).waitFor();
  await lb.reload({waitUntil:'networkidle'});check((await drafts(lb)).length===0,'locked_sync_local_cleanup');
  check((await rows(A)).filter(r=>r.site_name===marker+'-LOCK').length===1,'lock_duplicate');
  pass('actual_origin_WebLock_prevents_second_tab_request_then_refresh_reads_one_confirmed_cloud_row_and_empty_local_store');
  stage='real no-lock concurrent identical sync';
  const fc=await newContext(true),fa=await fc.newPage(),fb=await fc.newPage();await login(fa,A);await login(fb,A);
  check(await fa.evaluate(()=>!navigator.locks),'fallback_not_enabled');await seed(fa,marker+'-FALLBACK');await workspace(fa,A);await workspace(fb,A);
  await select(fa,marker+'-FALLBACK');await select(fb,marker+'-FALLBACK');const fallbackHeld=await holdInsert(fa),bEntered=deferred(),afterA=deferred();releases.push(afterA);
  let bBlocked=false;await fb.route(api+'/rest/v1/dives**',async route=>{if(route.request().method()!=='POST'||bBlocked)return route.continue();bBlocked=true;bEntered.resolve();await afterA.promise;return route.continue();});
  await sync(fa);await fallbackHeld.entered.promise;await sync(fb);await bEntered.promise;fallbackHeld.release.resolve();
  await fa.getByText('同步完成：1 条记录已保存到账号。',{exact:true}).waitFor();check((await drafts(fa)).length===0,'first_fallback_cleanup');afterA.resolve();
  await fb.getByText('同步完成：1 条记录已保存到账号。',{exact:true}).waitFor();
  check((await rows(A)).filter(r=>r.site_name===marker+'-FALLBACK').length===1 && (await drafts(fb)).length===0,'fallback_duplicate_or_retention_error');
  check(await fb.locator('[role="alert"]').count()===0,'false_modified_draft_failure');
  pass('actual_two_tab_without_WebLocks_identical_duplicate_and_already_absent_draft_both_reconcile_success_one_cloud_row');
  stage='genuinely edited in-flight local draft remains';await fa.unroute(api+'/rest/v1/dives**');await fb.unroute(api+'/rest/v1/dives**');
  const local=await seed(fa,marker+'-EDIT'),edited=local.find(r=>r.site_name===marker+'-EDIT');await workspace(fa,A);await select(fa,marker+'-EDIT');
  const editHeld=await holdInsert(fa);await sync(fa);await editHeld.entered.promise;
  await fb.goto(site+'/offline?draft='+edited.id,{waitUntil:'networkidle'});await fb.getByRole('textbox',{name:'深蓝记忆',exact:true}).fill('synthetic newer local content');
  await fb.getByRole('button',{name:'保存到此设备',exact:true}).click();await poll(()=>drafts(fb),rows=>rows[0]?.notes==='synthetic newer local content');
  editHeld.release.resolve();await fa.getByText(/同步期间本机内容已修改/).waitFor();
  check((await drafts(fa))[0]?.notes==='synthetic newer local content','genuine_local_edit_removed');
  check((await rows(A)).find(r=>r.id===edited.id)?.notes==='synthetic original','genuine_cloud_snapshot_overwritten');
  pass('actual_inflight_edit_preserves_newer_local_draft_and_old_confirmed_cloud_snapshot_reports_real_conflict');
  check(!productionTraffic,'production_request_guard');
}catch(error){failed=true;console.log('INCOMPLETE: stage='+stage+' error='+error.constructor.name+'; check='+(error.auditCode||'browser_operation')+'; details suppressed');}
finally{
  releases.forEach(r=>r.resolve());if(browser)await browser.close();
  let removed=0;for(const user of users){try{await req('/auth/v1/admin/users/'+user.id,{method:'DELETE'});
    const absent=await request('/auth/v1/admin/users/'+user.id),remaining=await rows(user);check(absent.status===404 && remaining.length===0,'cleanup_absence');removed++;
  }catch{failed=true;console.log('INCOMPLETE: disposable fixture cleanup '+user.id);}}
  cleaned=users.length===2&&removed===2;if(cleaned)pass('exact_two_disposable_users_generated_rows_cleanup_verified_all_browser_local_storage_disposed_no_media_or_mail');
  console.log('AUDIT: complete='+(!failed&&cleaned&&!productionTraffic)+'; recovery_only_real_two_account_two_tab_and_no_lock_fallback');
  if(failed||!cleaned||productionTraffic)process.exitCode=1;
}
