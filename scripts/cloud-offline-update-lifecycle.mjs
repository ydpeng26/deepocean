// Real Chromium lifecycle with a cloud-loopback two-release fixture. Uses actual
// worker sources + update observer, synthetic HTML/IndexedDB, no external app/data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const ts = (await import(process.env.RECOVERY_TYPESCRIPT_MODULE || 'typescript')).default;
const { chromium } = await import(process.env.RECOVERY_PLAYWRIGHT_MODULE || 'playwright');
const fixed = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const legacy = execFileSync('git', ['show', '2afc408bea57dd426a1e2c1f5ea44611bb2290cc:public/sw.js'], { encoding: 'utf8' });
const observer = ts.transpileModule(await readFile(new URL('../src/lib/offline-updates.ts', import.meta.url), 'utf8'), { compilerOptions: { target: 9, module: 99 } }).outputText;
let phase = 'legacy', browser, context, server, failed = false, stage = 'guard';
const check = (ok, reason) => { if (!ok) { const error = Error(reason); error.auditReason = reason; throw error; } };
const pass = message => console.log('PASS: ' + message);
async function poll(fn, predicate) { for (let i = 0; i < 120; i++) { const value = await fn(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 250)); } throw Error('Lifecycle did not settle'); }
try {
  check(process.env.GITHUB_ACTIONS === 'true', 'Cloud only');
  server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end((phase === 'legacy' ? legacy : fixed).replace('__BUILD_ID__', phase) + '\nself.__fixtureVersion=' + JSON.stringify(phase) + ';');
    }
    if (path === '/offline-assets.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(['/assets/' + phase + '.js', '/assets/observer.js'])); }
    if (path === '/assets/observer.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(observer); }
    if (path.startsWith('/assets/')) { res.setHeader('Content-Type', 'application/javascript'); if (phase === 'broken' && path === '/assets/broken.js') res.statusCode = 503; return res.end('/* synthetic lazy chunk */'); }
    if (path.startsWith('/images/')) return res.end('synthetic static asset');
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><body><textarea id="draft"></textarea><p id="notice"></p><script type="module">import {watchOfflineUpdates} from "/assets/observer.js";window.fixtureVersion=' + JSON.stringify(phase) + ';window.documentToken=crypto.randomUUID();watchOfflineUpdates(navigator.serviceWorker,()=>{document.querySelector("#notice").textContent="Update ready. Save before closing all tabs."});</script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const site = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: process.env.RECOVERY_BROWSER_CHANNEL || undefined });
  context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(site + '/offline'); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('#draft').fill('unsaved legacy input');
  const token = await page.evaluate(() => { window.initialController = navigator.serviceWorker.controller; return window.documentToken; });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const q = indexedDB.open('synthetic-update-drafts', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('drafts');
    q.onerror = reject; q.onsuccess = () => { const db = q.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put('saved fixture', 'one'); tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  stage = 'legacy to fixed waits without losing old cache'; phase = 'fixed1';
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
  check(await page.evaluate(() => navigator.serviceWorker.controller === window.initialController && window.documentToken) === token, 'Legacy page replaced');
  check(await page.locator('#draft').inputValue() === 'unsaved legacy input', 'Legacy input changed');
  await context.setOffline(true);
  check(await page.evaluate(async () => (await fetch('/assets/legacy.js')).ok), 'Old lazy chunk unavailable offline');
  pass('real_legacy_to_fixed_install_waits_preserves_document_unsaved_input_and_offline_old_lazy_chunk');
  await context.setOffline(false); await page.close();
  async function activeVersion(version) {
    return poll(async () => {
      for (const worker of context.serviceWorkers()) {
        try { const state = await worker.evaluate(async () => ({ version: self.__fixtureVersion, activeState: self.registration.active?.state, waiting: !!self.registration.waiting, installing: !!self.registration.installing, keys: await caches.keys() }));
          if (state.version === version && state.activeState === 'activated' && !state.waiting && !state.installing) return state;
        } catch { /* Retired worker, not the new worker. */ }
      }
      return null;
    }, value => !!value);
  }
  await activeVersion('fixed1');
  const a = await context.newPage(), b = await context.newPage();
  await a.goto(site + '/offline'); await b.goto(site + '/offline');
  await a.waitForFunction(() => window.fixtureVersion === 'fixed1' && !!navigator.serviceWorker.controller);
  await a.locator('#draft').fill('unsaved tab A'); await b.locator('#draft').fill('unsaved tab B');
  stage = 'fixed to fixed two real tabs'; phase = 'fixed2';
  stage = 'request fixed2 update';
  await a.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  stage = 'fixed2 waiting';
  await a.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
  stage = 'fixed2 update notice';
  await a.locator('#notice').getByText('Update ready. Save before closing all tabs.', { exact: true }).waitFor();
  stage = 'fixed2 input retention';
  check(await a.locator('#draft').inputValue() === 'unsaved tab A' && await b.locator('#draft').inputValue() === 'unsaved tab B', 'Update erased input');
  stage = 'fixed1 old chunk offline';
  await context.setOffline(true);
  check(await a.evaluate(async () => (await fetch('/assets/fixed1.js')).ok), 'Old fixed chunk unavailable');
  stage = 'close only first tab';
  await a.close();
  check(await b.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), 'One remaining tab did not retain waiting worker');
  check(await b.locator('#draft').inputValue() === 'unsaved tab B', 'Remaining tab changed');
  stage = 'close last tab and activate fixed2';
  await b.close(); const active = await activeVersion('fixed2');
  check(!active.keys.includes('supdiver-offline-fixed1'), 'Old cache not retired when windowless');
  stage = 'reopen fixed2 offline';
  const fresh = await context.newPage();
  await fresh.goto(site + '/offline'); await fresh.waitForFunction(() => window.fixtureVersion === 'fixed2');
  check(await fresh.evaluate(async () => (await fetch('/assets/fixed2.js')).ok), 'New offline chunk unavailable');
  const saved = await fresh.evaluate(() => new Promise((resolve, reject) => { const q = indexedDB.open('synthetic-update-drafts', 1); q.onerror = reject;
    q.onsuccess = () => { const db = q.result, tx = db.transaction('drafts', 'readonly'), r = tx.objectStore('drafts').get('one'); r.onsuccess = () => resolve(r.result); tx.oncomplete = () => db.close(); }; }));
  check(saved === 'saved fixture', 'Version activation changed IndexedDB');
  pass('real_two_tab_update_notice_no_reload_waits_until_all_close_windowless_cleanup_offline_reopen_and_saved_IndexedDB_survives');
  stage = 'failed new installation'; await context.setOffline(false); phase = 'broken';
  await fresh.locator('#draft').fill('input survives failed install');
  await fresh.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration();
    window.installFailed = new Promise(resolve => r.addEventListener('updatefound', () => { const w = r.installing; w.addEventListener('statechange', () => { if (w.state === 'redundant') resolve(true); }); }, { once: true }));
    await r.update(); });
  check(await fresh.evaluate(() => window.installFailed), 'Broken worker did not reject');
  check(await fresh.locator('#draft').inputValue() === 'input survives failed install', 'Failed install changed input');
  check(await fresh.evaluate(async () => !(await navigator.serviceWorker.getRegistration()).waiting && (await caches.keys()).includes('supdiver-offline-fixed2')), 'Failed install replaced working cache');
  pass('real_partial_install_failure_keeps_active_worker_cache_and_unsaved_input');
} catch (error) { failed = true; console.log('INCOMPLETE: stage=' + stage + ' error=' + error.constructor.name + '; check=' + (error.auditReason || 'browser_operation') + '; details suppressed'); }
finally {
  if (context) await context.close(); if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
  console.log('AUDIT: controlled_loopback_actual_worker_lifecycle_complete=' + !failed + '; synthetic_shell_not_full_app_cross_release_no_backend_data');
  if (failed) process.exitCode = 1;
}
