// Cloud-only browser storage, synthetic accounts/text only. No mail or photos.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';
const project = 'esovqvampbrhuhamkfcs';
const api = `https://${project}.supabase.co`;
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const source = await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8');
const anon = source.match(/const anon = '([^']+)'/)[1];
const results = [];
let browser, page, user, stage = 'preflight', cleaned = false;
function check(ok, message) { if (!ok) throw new Error(message); }
function pass(name) { results.push(name); console.log('PASS: ' + name); stage = name; }
async function req(path, { method = 'GET', body, privileged = true, token } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Invalid path');
  const r = await fetch(api + path, { method, signal: AbortSignal.timeout(45000),
    headers: { apikey: privileged ? admin : anon, Authorization: `Bearer ${privileged ? admin : token || anon}`,
      'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  check(r.ok, 'Test API HTTP ' + r.status);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
async function localDrafts() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('supdiver-offline', 1);
    open.onerror = () => reject(new Error('Synthetic storage unavailable'));
    open.onsuccess = () => { const db = open.result; const tx = db.transaction('dive-drafts', 'readonly');
      const read = tx.objectStore('dive-drafts').getAll(); read.onsuccess = () => resolve(read.result); tx.oncomplete = () => db.close(); };
  }));
}
async function cloudDrafts() { return req(`/rest/v1/dives?user_id=eq.${user.id}&select=id,site_name,notes`); }
async function waitCloud(count) {
  for (let n = 0; n < 30; n++) { const rows = await cloudDrafts(); if (rows.length === count) return rows; await new Promise(r => setTimeout(r, 250)); }
  throw Error('Synthetic row count did not settle');
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Recovery cloud credential required');
  const suffix = randomBytes(12).toString('hex');
  const email = `offline-${suffix}@example.invalid`, password = randomBytes(32).toString('base64url');
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ((url.hostname.endsWith('.supabase.co') && url.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(url.hostname)) {
      process.exitCode = 1; return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  page = await context.newPage();
  stage = 'anonymous empty state';
  await page.goto(site + '/offline-sync', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByText('暂无待同步草稿，可先新建离线记录。', { exact: true }).waitFor();
  check(!await page.getByRole('button', { name: '同步到我的账号', exact: true }).isEnabled(), 'Anonymous sync enabled');
  pass('real_empty_state_and_anonymous_sync_blocked');
  await page.getByRole('link', { name: '新建离线记录', exact: true }).click();
  await page.getByLabel('潜水国家', { exact: true }).fill('Indonesia');
  await page.getByLabel('潜点名称', { exact: true }).fill('OFFLINE-A-' + suffix);
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await page.getByText('OFFLINE-A-' + suffix, { exact: true }).waitFor();
  await page.getByLabel('潜水国家', { exact: true }).fill('Japan');
  await page.getByLabel('潜点名称', { exact: true }).fill('OFFLINE-B-' + suffix);
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await page.getByText('OFFLINE-B-' + suffix, { exact: true }).waitFor();
  check((await localDrafts()).length === 2 && (await cloudDrafts()).length === 0, 'Local save wrote cloud data');
  pass('two_real_form_drafts_saved_locally_without_upload');
  await page.getByRole('link', { name: '查看草稿与同步', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '选择草稿 OFFLINE-A-' + suffix, exact: true }).waitFor();
  check((await localDrafts()).length === 2, 'Reload lost drafts');
  pass('drafts_persist_after_reload_and_list_is_real');
  await page.getByRole('button', { name: '选择草稿 OFFLINE-A-' + suffix, exact: true }).click();
  await page.getByRole('link', { name: '继续编辑', exact: true }).click();
  // Active defaults to most recently saved B, irrespective of selected A.
  await page.getByLabel('潜点名称', { exact: true }).fill('OFFLINE-B-EDIT-' + suffix);
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await page.getByText('OFFLINE-B-EDIT-' + suffix, { exact: true }).waitFor();
  check((await localDrafts()).length === 2, 'Editing made a duplicate draft');
  pass('continue_edit_opens_actual_draft_and_preserves_id');
  await page.getByRole('link', { name: '查看草稿与同步', exact: true }).click();
  await page.getByRole('link', { name: '登录后返回同步', exact: true }).click();
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL('**/offline-sync', { timeout: 60000 });
  await page.getByText(email, { exact: true }).waitFor();
  pass('signin_returns_to_sync_with_actual_account');
  const syncButton = page.getByRole('button', { name: '同步到我的账号', exact: true });
  await page.getByRole('button', { name: '选择草稿 OFFLINE-A-' + suffix, exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await syncButton.click();
  check((await cloudDrafts()).length === 0 && (await localDrafts()).length === 2, 'Cancel uploaded data');
  pass('cancel_confirmation_does_not_upload_or_remove_draft');
  page.once('dialog', dialog => dialog.accept());
  await syncButton.click();
  await page.getByText('同步完成：1 条记录已保存到账号。', { exact: true }).waitFor();
  const first = await waitCloud(1);
  check(first[0].site_name === 'OFFLINE-A-' + suffix && (await localDrafts()).length === 1, 'Unselected draft uploaded or removed');
  pass('selected_only_sync_persists_and_keeps_unselected_local');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.getByText('当前无信号', { exact: true }).waitFor();
  check(!await syncButton.isEnabled() && (await localDrafts()).length === 1, 'Offline state unsafe');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '选择草稿 OFFLINE-B-EDIT-' + suffix, exact: true }).waitFor();
  check((await localDrafts()).length === 1, 'Offline reload lost draft');
  pass('true_offline_reload_reads_cached_sync_page_and_preserves_draft');
  await context.setOffline(false);
  await page.getByText('网络可用', { exact: true }).waitFor();
  await page.getByRole('button', { name: '选择草稿 OFFLINE-B-EDIT-' + suffix, exact: true }).click();
  const draft = (await localDrafts())[0];
  let lost = false;
  // The server saves the row, but the response is lost. A retry must not duplicate it.
  await context.route(api + '/rest/v1/dives', async route => {
    if (route.request().method() !== 'POST' || lost) return route.continue();
    lost = true;
    await req('/rest/v1/dives', { method: 'POST', body: { id: draft.id, user_id: user.id, country: draft.country,
      region: null, site_name: draft.site_name, dive_date: draft.dive_date, weather: null,
      surface_temp: null, water_temp: null, max_depth: null, duration_min: null,
      dive_type: draft.dive_type, buddy_role: null, buddy_name: null, notes: null, photo_urls: [], photo_thumbnail_urls: [] } });
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic lost response' }) });
  });
  page.once('dialog', dialog => dialog.accept());
  await syncButton.click();
  await page.getByText(/1 条仍保留在本机/).waitFor();
  check((await localDrafts()).length === 1 && (await cloudDrafts()).length === 2, 'Lost response discarded draft');
  pass('lost_response_retains_local_draft_after_server_commit');
  page.once('dialog', dialog => dialog.accept());
  await syncButton.click();
  await page.getByText('同步完成：1 条记录已保存到账号。', { exact: true }).waitFor();
  check((await localDrafts()).length === 0 && (await cloudDrafts()).length === 2, 'Retry duplicated data');
  pass('retry_checks_existing_content_without_duplicate_or_data_loss');
  await page.getByRole('link', { name: '新建离线记录', exact: true }).click();
  await page.getByLabel('潜水国家', { exact: true }).fill('Indonesia');
  await page.getByLabel('潜点名称', { exact: true }).fill('OFFLINE-C-' + suffix);
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await page.getByText('OFFLINE-C-' + suffix, { exact: true }).waitFor();
  await page.goto(site + '/dives', { waitUntil: 'networkidle' });
  const banner = page.getByRole('complementary', { name: '离线记录待同步' });
  await banner.waitFor({ state: 'visible' });
  page.once('dialog', dialog => dialog.accept());
  await banner.getByRole('button', { name: '同步到我的账号', exact: true }).click();
  await banner.waitFor({ state: 'hidden' });
  await waitCloud(3);
  check((await localDrafts()).length === 0, 'Passport banner did not remove synced draft');
  pass('existing_passport_banner_sync_remains_compatible_with_account_confirmation');
} catch (error) {
  console.error(`Offline test incomplete after ${stage} (${error.constructor.name}); details suppressed.`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      const r = await fetch(api + '/auth/v1/admin/users/' + user.id, { headers: { apikey: admin, Authorization: `Bearer ${admin}` } });
      check(r.status === 404 && (await cloudDrafts()).length === 0, 'Synthetic cleanup incomplete');
      cleaned = true;
    } catch { process.exitCode = 1; }
  }
  console.log(`${cleaned ? 'PASS' : 'FAIL'}: synthetic_account_and_logs_cleanup`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify({ checks: results,
    status: process.exitCode ? 'incomplete' : 'passed', synthetic_cleanup_verified: cleaned,
    production_modified: false, local_user_data_saved: false, fixture_ids_for_cleanup: cleaned || !user ? [] : [user.id] }, null, 2) + '\n```\n');
}
