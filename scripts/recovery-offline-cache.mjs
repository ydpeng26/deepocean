// Current recovery deployment only. Real service worker and IndexedDB; no accounts,
// credentials, backend writes, mail, screenshots, traces or exported artifacts.
import { randomUUID } from 'node:crypto';
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const site = 'https://supdiver-recovery-test.vercel.app';
let browser, context, stage = 'guard', failed = false, unexpectedTraffic = false;
const check = (ok, message) => { if (!ok) throw Error(message); };
const pass = name => console.log('PASS: ' + name);
async function drafts(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const q = indexedDB.open('supdiver-offline', 1);
    q.onerror = () => reject(Error('Read failed'));
    q.onsuccess = () => { const db = q.result, tx = db.transaction('dive-drafts', 'readonly');
      const r = tx.objectStore('dive-drafts').getAll(); let rows;
      r.onsuccess = () => { rows = r.result; };
      tx.oncomplete = () => { db.close(); resolve(rows); };
      tx.onerror = () => { db.close(); reject(Error('Transaction failed')); };
    };
  }));
}
async function settle(fn, predicate) {
  for (let i = 0; i < 80; i++) { const value = await fn(); if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 250)); }
  throw Error('State did not settle');
}
try {
  check(process.env.GITHUB_ACTIONS === 'true', 'Cloud only');
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', serviceWorkers: 'allow' });
  await context.route('**/*', route => {
    const r = route.request(), u = new URL(r.url());
    if (['supdiver.com', 'www.supdiver.com'].includes(u.hostname) ||
      (u.hostname.endsWith('.supabase.co') && u.hostname !== 'esovqvampbrhuhamkfcs.supabase.co') ||
      !['GET','HEAD','OPTIONS'].includes(r.method())) {
      unexpectedTraffic = true; return route.abort();
    }
    return route.continue();
  });
  context.on('request', r => { const u = new URL(r.url());
    if (['supdiver.com','www.supdiver.com'].includes(u.hostname) ||
      (u.hostname.endsWith('.supabase.co') && u.hostname !== 'esovqvampbrhuhamkfcs.supabase.co') ||
      !['GET','HEAD','OPTIONS'].includes(r.method())) unexpectedTraffic = true;
  });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  const page = await context.newPage(), marker = 'OFFLINE-CACHE-' + randomUUID();
  stage = 'warm real service worker';
  await page.goto(site + '/offline', { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 60000 });
  const cacheInfo = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter(k => k.startsWith('supdiver-offline-'));
    const manifest = await (await fetch('/offline-assets.json', { cache: 'no-store' })).json();
    const cache = await caches.open(keys[0]);
    const missing = [];
    for (const url of ['/auth','/offline','/offline-sync', ...manifest]) if (!await cache.match(url)) missing.push(url);
    return { cacheCount: keys.length, versioned: keys[0] && !keys[0].includes('__BUILD_ID__'), assetCount: manifest.length, missing: missing.length };
  });
  check(cacheInfo.cacheCount === 1 && cacheInfo.versioned && cacheInfo.assetCount > 0 && cacheInfo.missing === 0, 'Cache incomplete');
  pass('real_worker_active_versioned_cache_manifest_assets_and_offline_routes_complete');
  stage = 'true offline reload and save';
  await context.setOffline(true);
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
  await page.getByLabel('潜水国家', { exact: true }).fill('Indonesia');
  await page.getByLabel('潜点名称', { exact: true }).fill(marker);
  await page.getByRole('textbox', { name: '深蓝记忆', exact: true }).fill('Synthetic offline notes');
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  const rows = await settle(() => drafts(page), rows => rows.length === 1);
  check(rows[0].site_name === marker && rows[0].notes === 'Synthetic offline notes', 'Saved draft differs');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.do-offline-drafts').getByRole('button', { name: '编辑', exact: true }).click();
  check(await page.getByLabel('潜点名称', { exact: true }).inputValue() === marker, 'Reload lost draft');
  pass('true_offline_reload_actual_form_save_IndexedDB_readback_and_reload_edit_preserve_draft');
  stage = 'storage failure retains unsaved input';
  await page.getByLabel('潜点名称', { exact: true }).fill(marker + '-RETRY');
  await page.evaluate(() => { window.__originalOfflineOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function () { throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await page.getByText('本机存储失败，请检查浏览器存储权限与剩余空间', { exact: true }).waitFor();
  check(await page.getByLabel('潜点名称', { exact: true }).inputValue() === marker + '-RETRY', 'Storage error erased unsaved input');
  await page.evaluate(() => { IDBFactory.prototype.open = window.__originalOfflineOpen; });
  check((await drafts(page))[0].site_name === marker, 'Failed save changed draft');
  await page.getByRole('button', { name: '保存到此设备', exact: true }).click();
  await settle(() => drafts(page), rows => rows.length === 1 && rows[0].site_name === marker + '-RETRY');
  pass('injected_storage_failure_retains_fields_and_saved_snapshot_retry_updates_one_real_local_draft');
  stage = 'offline route reloads';
  await page.goto(site + '/auth', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '登录', exact: true }).waitFor();
  await page.goto(site + '/offline-sync', { waitUntil: 'networkidle' });
  check((await drafts(page)).length === 1, 'Route change lost draft');
  pass('cached_auth_and_sync_routes_load_offline_without_login_or_server_write');
  stage = 'network restored';
  await context.setOffline(false);
  await page.goto(site + '/offline', { waitUntil: 'networkidle' });
  check((await drafts(page)).length === 1, 'Reconnect lost draft');
  pass('reconnect_and_reload_preserve_unsynced_draft_without_auto_sync');
  check(!unexpectedTraffic, 'Unexpected network request');
} catch (error) {
  failed = true; console.log('INCOMPLETE: stage=' + stage + ' error=' + error.constructor.name + '; details suppressed');
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  console.log('AUDIT: complete=' + (!failed && !unexpectedTraffic) + '; disposable_browser_storage_disposed_no_backend_accounts_or_rows_created');
  console.log('AUDIT: current_cache_only_no_actual_cross_release_update_acceptance');
  if (failed || unexpectedTraffic) process.exitCode = 1;
}
