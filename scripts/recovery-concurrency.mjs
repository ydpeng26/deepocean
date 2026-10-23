// Cloud-only actual two-tab/independent-context acceptance. Synthetic text only.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const api = 'https://esovqvampbrhuhamkfcs.supabase.co', site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
let browser, user, diagnosticPage, stage = 'guard', failed = false, productionTraffic = false, cleaned = false;
const check = (ok, message) => { if (!ok) throw Error(message); };
const pass = message => console.log('PASS: ' + message);
async function request(path, { method = 'GET', body } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Relative recovery path required');
  const r = await fetch(api + path, { method, headers: { apikey: admin, Authorization: 'Bearer ' + admin,
    'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const text = await r.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: r.ok, status: r.status, data };
}
async function req(path, options) { const r = await request(path, options); check(r.ok, 'Recovery HTTP ' + r.status); return r.data; }
async function drafts(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('supdiver-offline', 1);
    r.onerror = () => reject(Error('Synthetic storage read failed'));
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction('dive-drafts', 'readonly'), q = tx.objectStore('dive-drafts').getAll();
      let rows; q.onsuccess = () => { rows = q.result; };
      tx.oncomplete = () => { db.close(); resolve(rows); };
      tx.onerror = () => { db.close(); reject(Error('Synthetic storage transaction failed')); };
    };
  }));
}
async function poll(fn, predicate) { for (let i = 0; i < 80; i++) { const v = await fn(); if (predicate(v)) return v; await new Promise(r => setTimeout(r, 250)); } throw Error('Fixture did not settle'); }
async function context() {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', serviceWorkers: 'block' });
  await c.route('**/*', route => {
    const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(u.hostname)) {
      productionTraffic = true; return route.abort();
    }
    return route.continue();
  });
  await c.addInitScript(() => {
    localStorage.setItem('deepocean-language', 'zh-CN');
    // Delay only delivery of open success, not transaction operations, so the
    // real form has a deterministic pending-save window using actual IndexedDB.
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const native = original.apply(this, args), delay = window.__offlineOpenDelay || 0;
      if (!delay) return native;
      const wrapper = { get result() { return native.result; }, get error() { return native.error; } };
      native.onsuccess = event => setTimeout(() => wrapper.onsuccess?.(event), delay);
      native.onupgradeneeded = event => wrapper.onupgradeneeded?.(event);
      native.onerror = event => wrapper.onerror?.(event);
      native.onblocked = event => wrapper.onblocked?.(event);
      return wrapper;
    };
  });
  return c;
}
async function login(page, email, password) {
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL('**/dives', { timeout: 60000 });
}
async function openDraft(page, id) {
  await page.goto(site + '/offline' + (id ? '?draft=' + id : ''), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#offline-form fieldset')?.disabled === false);
}
const saveLocal = page => page.getByRole('button', { name: '保存到此设备', exact: true }).click();
const alert = page => page.locator('#offline-form [role="alert"]');
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Recovery cloud guard');
  const marker = 'CONCURRENCY-' + randomBytes(7).toString('hex');
  const email = 'concurrency-' + randomBytes(12).toString('hex') + '@example.invalid';
  const password = randomBytes(32).toString('base64url');
  stage = 'create disposable account';
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  const c = await context(), a = await c.newPage(), b = await c.newPage();
  await login(a, email, password);
  stage = 'seed actual local draft';
  await openDraft(a);
  await a.getByLabel('潜水国家', { exact: true }).fill('Indonesia');
  await a.getByLabel('潜点名称', { exact: true }).fill(marker);
  await a.getByRole('textbox', { name: '深蓝记忆', exact: true }).fill('base');
  await saveLocal(a);
  let local = await poll(() => drafts(a), rows => rows.length === 1);
  const originalId = local[0].id;
  stage = 'two actual tabs stale offline edit';
  await openDraft(a, originalId); await openDraft(b, originalId);
  await a.getByRole('textbox', { name: '深蓝记忆', exact: true }).fill('newer tab A');
  await saveLocal(a);
  await poll(() => drafts(a), rows => rows[0]?.notes === 'newer tab A');
  await b.getByLabel('潜点名称', { exact: true }).fill(marker + '-STALE');
  await saveLocal(b); await alert(b).waitFor();
  check(await b.getByLabel('潜点名称', { exact: true }).inputValue() === marker + '-STALE', 'Conflict erased input');
  check((await drafts(a))[0].notes === 'newer tab A', 'Stale offline write replaced current data');
  await b.getByRole('button', { name: '重新读取列表', exact: true }).click();
  check(await b.getByLabel('潜点名称', { exact: true }).inputValue() === marker + '-STALE', 'List refresh replaced input');
  b.once('dialog', d => d.accept());
  await b.locator('.do-offline-drafts').getByRole('button', { name: '编辑', exact: true }).click();
  check(await b.getByRole('textbox', { name: '深蓝记忆', exact: true }).inputValue() === 'newer tab A', 'Explicit reload did not load latest');
  pass('real_two_tab_offline_stale_write_rejected_draft_retained_explicit_refresh_loads_latest');
  stage = 'deleted draft cannot be resurrected';
  await openDraft(a, originalId); await openDraft(b, originalId);
  a.once('dialog', d => d.accept());
  await a.locator('.do-offline-drafts').getByRole('button', { name: '删除', exact: true }).click();
  await poll(() => drafts(a), rows => rows.length === 0);
  await b.getByLabel('潜点名称', { exact: true }).fill(marker + '-COPY');
  await saveLocal(b); await alert(b).waitFor();
  check((await drafts(a)).length === 0, 'Deleted draft resurrected');
  await b.getByRole('button', { name: '将当前输入另存为新草稿', exact: true }).click();
  check((await drafts(a)).length === 0, 'Copy action auto-saved');
  check(await b.getByLabel('潜点名称', { exact: true }).inputValue() === marker + '-COPY', 'Copy action lost fields');
  await saveLocal(b);
  local = await poll(() => drafts(a), rows => rows.length === 1);
  check(local[0].id !== originalId, 'Deliberate copy reused deleted id');
  pass('deleted_offline_draft_not_resurrected_explicit_copy_preserves_fields_and_creates_new_id');
  stage = 'synced draft cannot be resurrected';
  await openDraft(a, local[0].id);
  // Auth deliberately uses sessionStorage: same-context tabs share IndexedDB,
  // NOT the login session. Sign this tab in explicitly, preserving tab A.
  stage = 'sign in separate sync tab'; diagnosticPage = b;
  await login(b, email, password);
  stage = 'load sync workspace'; diagnosticPage = b;
  await b.goto(site + '/offline-sync', { waitUntil: 'networkidle' });
  stage = 'select copied draft for sync';
  await b.getByRole('button', { name: '选择草稿 ' + marker + '-COPY', exact: true }).click();
  stage = 'confirm copied draft sync';
  b.once('dialog', d => d.accept());
  await b.getByRole('button', { name: '同步到我的账号', exact: true }).click();
  stage = 'await copied draft sync result';
  await b.getByText('同步完成：1 条记录已保存到账号。', { exact: true }).waitFor();
  stage = 'save old tab after sync'; diagnosticPage = a;
  await a.getByLabel('潜点名称', { exact: true }).fill(marker + '-AFTER-SYNC');
  await saveLocal(a); await alert(a).waitFor();
  check((await drafts(a)).length === 0, 'Synced draft resurrected');
  pass('actual_sync_removes_exact_draft_and_old_tab_cannot_resave_it');
  stage = 'double submit and locked pending editor';
  await openDraft(a);
  await a.getByLabel('潜水国家', { exact: true }).fill('Indonesia');
  await a.getByLabel('潜点名称', { exact: true }).fill(marker + '-DOUBLE');
  await a.evaluate(() => { window.__offlineOpenDelay = 1500; const form = document.querySelector('#offline-form'); form.requestSubmit(); form.requestSubmit(); });
  await a.waitForFunction(() => document.querySelector('#offline-form fieldset').disabled);
  check(!await a.getByLabel('潜点名称', { exact: true }).isEnabled(), 'Pending field editable');
  check(!await a.getByRole('button', { name: '新建记录', exact: true }).isEnabled(), 'Pending new-entry control enabled');
  await a.evaluate(() => { window.__offlineOpenDelay = 0; });
  local = await poll(() => drafts(b), rows => rows.length === 1);
  await a.waitForFunction(() => document.querySelector('#offline-form fieldset').disabled === false);
  check((await drafts(b)).length === 1 && local[0].site_name === marker + '-DOUBLE', 'Double submit duplicated draft');
  pass('real_form_immediate_double_submit_creates_one_draft_pending_fields_and_new_control_lock');
  stage = 'independent browser contexts online stale edit';
  const diveId = randomUUID();
  await req('/rest/v1/dives', { method: 'POST', body: { id: diveId, user_id: user.id, country: 'Indonesia',
    site_name: marker + '-ONLINE', dive_date: '2026-10-24', dive_type: 'recreational', notes: 'base', photo_urls: [], photo_thumbnail_urls: [] } });
  const d = await context(), device = await d.newPage(); await login(device, email, password);
  async function edit(page) { await page.goto(site + '/dives/' + diveId, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '编辑', exact: true }).click(); await page.locator('#site').waitFor(); }
  const cloudRow = async () => (await req('/rest/v1/dives?id=eq.' + diveId + '&select=*'))[0];
  await edit(a); await edit(device);
  await a.locator('#notes').fill('newer independent A');
  await a.getByRole('button', { name: '保存记录', exact: true }).click();
  await poll(cloudRow, row => row.notes === 'newer independent A');
  await device.locator('#site').fill(marker + '-STALE-DEVICE');
  await device.getByRole('button', { name: '保存记录', exact: true }).click();
  await device.getByText(/记录已被其他页面修改/).waitFor();
  check((await cloudRow()).notes === 'newer independent A', 'Stale online editor overwrote latest notes');
  check(await device.locator('#site').inputValue() === marker + '-STALE-DEVICE', 'Online conflict erased draft');
  pass('independent_context_stale_online_editor_rejects_and_keeps_unsaved_fields');
  stage = 'atomic online race after pre-read';
  await edit(device); let raced = false;
  await device.route(api + '/rest/v1/dives**', async route => {
    if (route.request().method() !== 'PATCH' || raced) return route.continue();
    raced = true;
    check(new URL(route.request().url()).searchParams.has('updated_at'), 'Update lacks expected revision filter');
    await req('/rest/v1/dives?id=eq.' + diveId, { method: 'PATCH', body: { notes: 'racing third write' } });
    return route.continue();
  });
  await device.locator('#site').fill(marker + '-RACE');
  await device.getByRole('button', { name: '保存记录', exact: true }).click();
  await device.getByText(/记录已被其他页面修改/).waitFor();
  check(raced && (await cloudRow()).notes === 'racing third write', 'Conditional update missed concurrent write');
  await device.unroute(api + '/rest/v1/dives**');
  pass('actual_updated_at_conditional_patch_rejects_write_between_preread_and_update');
  stage = 'committed update lost response retry';
  await edit(device); let lost = false;
  await device.route(api + '/rest/v1/dives**', async route => {
    if (route.request().method() !== 'PATCH' || lost) return route.continue();
    lost = true; const response = await route.fetch(); check(response.ok(), 'Synthetic update did not commit');
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic lost update reply' }) });
  });
  await device.locator('#notes').fill('lost reply exact payload');
  await device.getByRole('button', { name: '保存记录', exact: true }).click();
  await poll(cloudRow, row => row.notes === 'lost reply exact payload');
  await device.getByRole('button', { name: '保存记录', exact: true }).waitFor({ state: 'visible' });
  await device.waitForFunction(() => !document.querySelector('form fieldset')?.disabled);
  await device.getByRole('button', { name: '保存记录', exact: true }).click();
  await device.locator('#notes').waitFor({ state: 'hidden' });
  check(lost && (await cloudRow()).notes === 'lost reply exact payload', 'Lost update retry failed');
  pass('committed_lost_update_reply_retry_confirms_identical_record_without_overwrite_or_duplicate');
  check(!productionTraffic, 'Production request blocked');
} catch (error) {
  failed = true;
  console.log('INCOMPLETE: stage=' + stage + ' error=' + error.constructor.name + '; details suppressed');
  if (diagnosticPage) {
    const flags = await diagnosticPage.evaluate(() => {
      const text = document.body.innerText;
      return { path: location.pathname, loggedIn: text.includes('同步前会再次验证并请你确认'),
        syncFailed: text.includes('同步未完成'), partialSync: text.includes('仍保留在本机'),
        syncDone: text.includes('同步完成'), storageError: text.includes('无法读取本机存储'),
        buttons: [...document.querySelectorAll('button')].filter(b => b.textContent.includes('同步到我的账号')).map(b => ({ disabled: b.disabled })),
      };
    }).catch(() => ({}));
    console.log('INCOMPLETE: safe_state=' + JSON.stringify(flags));
  }
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      const absent = await request('/auth/v1/admin/users/' + user.id);
      const rows = await req('/rest/v1/dives?user_id=eq.' + user.id + '&select=id');
      check(absent.status === 404 && rows.length === 0, 'Cleanup incomplete'); cleaned = true;
      pass('exact_disposable_account_and_all_generated_rows_cleanup_verified_browser_storage_disposed');
    } catch { failed = true; console.log('INCOMPLETE: cleanup failed for disposable account ' + user.id); }
  }
  console.log('AUDIT: complete=' + (!failed && cleaned && !productionTraffic) + ' findings=' + (failed ? 'incomplete' : '0'));
  if (failed || productionTraffic || !cleaned) process.exitCode = 1;
}
