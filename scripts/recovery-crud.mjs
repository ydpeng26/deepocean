// Cloud-only CRUD tests. Never use restored accounts or publish traces/payloads.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';

const project = 'esovqvampbrhuhamkfcs';
const api = `https://${project}.supabase.co`;
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
// Reuse the public test-project key from the existing browser harness.
const source = await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8');
const anon = source.match(/const anon = '([^']+)'/)[1];
const marker = `RECOVERY-CRUD-${process.env.GITHUB_RUN_ID}-${randomBytes(4).toString('hex')}`;
const users = [], contexts = [], files = [], checks = [];
let browser;
let stage = 'preflight';
function check(ok, message) { if (!ok) throw new Error(message); }
function pass(name) { checks.push(name); console.log('PASS: ' + name); stage = name; }
async function response(path, { method = 'GET', body, token, privileged = false, raw = false } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Invalid API path');
  const r = await fetch(api + path, { method, signal: AbortSignal.timeout(60000),
    headers: { apikey: privileged ? admin : anon, Prefer: 'return=representation',
      ...(token || privileged ? { Authorization: `Bearer ${token || admin}` } : {}),
      ...(body ? { 'Content-Type': raw ? 'image/png' : 'application/json' } : {}) },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  return r;
}
async function req(path, options) {
  const r = await response(path, options);
  check(r.ok, `Test API failed HTTP ${r.status}`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
async function rows(table, id, token, options = {}) {
  return req(`/rest/v1/${table}?id=eq.${id}&select=*`, { token, ...options });
}
async function poll(fn, predicate, label) {
  for (let n = 0; n < 25; n++) {
    const value = await fn(); if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(label);
}
async function context(session) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(c);
  await c.route('**/*', route => {
    const u = new URL(route.request().url());
    if ((u.hostname.endsWith('.supabase.co') && u.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(u.hostname)) {
      process.exitCode = 1;
      return route.abort();
    }
    return route.continue();
  });
  await c.addInitScript(({ project, session }) => {
    sessionStorage.setItem(`sb-${project}-auth-token`, JSON.stringify(session));
  }, { project, session });
  return c;
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud runner and recovery key required');
  for (let n = 0; n < 2; n++) {
    const email = `crud-${randomBytes(12).toString('hex')}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const user = await req('/auth/v1/admin/users', { method: 'POST', privileged: true,
      body: { email, password, email_confirm: true, user_metadata: { display_name: marker } } });
    users.push({ id: user.id });
    const session = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    Object.assign(users[n], { session, token: session.access_token });
  }
  const [a, b] = users;
  pass('two_disposable_accounts_created_without_email');
  browser = await chromium.launch();
  const ca = await context(a.session), page = await ca.newPage();
  await page.goto(site + '/dives/new', { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('#country').fill('Indonesia');
  await page.locator('#site').fill(marker);
  await page.locator('#notes').fill('Disposable recovery validation');
  // Synthetic PNG only, never a real user's photograph.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64');
  await page.locator('#photos').setInputFiles({ name: 'recovery-fixture.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  const dives = await poll(() => req(`/rest/v1/dives?user_id=eq.${a.id}&select=*`, { token: a.token }), d => d.length === 1, 'Browser dive create not persisted');
  const dive = dives[0];
  for (const path of [...dive.photo_urls, ...(dive.photo_thumbnail_urls || [])].filter(Boolean)) files.push({ bucket: 'dive-photos', path });
  check(dive.site_name === marker && dive.photo_urls.length === 1, 'Dive/photo payload mismatch');
  pass('browser_log_create_with_synthetic_photo_persisted');
  await page.goto(site + '/dives/' + dive.id, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => [...document.images].some(i => i.src.includes('/storage/') && i.complete && i.naturalWidth > 0), { timeout: 30000 });
  pass('browser_uploaded_photo_rendered');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('#site').fill(marker + '-EDIT');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await poll(() => rows('dives', dive.id, a.token), d => d[0]?.site_name === marker + '-EDIT', 'Browser edit not persisted');
  pass('browser_log_edit_persisted');
  check((await rows('dives', dive.id, b.token)).length === 0, 'Other user sees private dive');
  check((await rows('dives', dive.id, b.token, { method: 'PATCH', body: { notes: 'unauthorized' } })).length === 0, 'Other user modified dive');
  check((await rows('dives', dive.id, b.token, { method: 'DELETE' })).length === 0, 'Other user deleted dive');
  const forged = await response('/rest/v1/dives', { method: 'POST', token: b.token,
    body: { user_id: a.id, country: 'Indonesia', site_name: marker, dive_date: '2026-10-20' } });
  check(!forged.ok, 'Forged dive ownership accepted');
  pass('private_log_read_update_delete_and_owner_forgery_denied');

  const photo = files.find(f => f.bucket === 'dive-photos');
  const signed = await req('/storage/v1/object/sign/dive-photos/' + photo.path, { method: 'POST', token: a.token, body: { expiresIn: 60 } });
  const download = await fetch(api + '/storage/v1' + signed.signedURL);
  check(download.ok && (await download.arrayBuffer()).byteLength > 0, 'Owner cannot download photo');
  const denied = await response('/storage/v1/object/sign/dive-photos/' + photo.path, { method: 'POST', token: b.token, body: { expiresIn: 60 } });
  check(!denied.ok, 'Other user can sign private photo');
  const overwrite = await response('/storage/v1/object/dive-photos/' + photo.path, { method: 'PUT', token: b.token, body: png, raw: true });
  check(!overwrite.ok, 'Other user overwrote photo');
  pass('private_photo_owner_download_and_cross_user_sign_overwrite_denied');

  await page.goto(site + '/forum', { waitUntil: 'networkidle' });
  stage = 'forum_composer_open';
  await page.locator('.do-forum-compose-strip > button').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.do-forum-composer-fields input').first().fill(marker);
  await dialog.locator('textarea').fill('Disposable forum recovery test');
  await dialog.locator('footer button').last().click();
  stage = 'forum_post_persistence';
  const posts = await poll(() => req(`/rest/v1/forum_posts?user_id=eq.${a.id}&select=*`, { token: a.token }), p => p.length === 1, 'Browser post create not persisted');
  const post = posts[0];
  pass('browser_forum_post_create_persisted');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: marker, exact: true }) });
  stage = 'forum_bookmark_toggle';
  await card.getByRole('button', { name: '收藏', exact: true }).click();
  const bookmarks = () => req(`/rest/v1/forum_bookmarks?post_id=eq.${post.id}&select=*`, { token: a.token });
  await poll(bookmarks, r => r.length === 1, 'Bookmark not persisted');
  check((await req(`/rest/v1/forum_bookmarks?post_id=eq.${post.id}&select=*`, { token: b.token })).length === 0, 'Other user sees private bookmark');
  await card.getByRole('button', { name: '收藏', exact: true }).click();
  await poll(bookmarks, r => r.length === 0, 'Bookmark removal not persisted');
  pass('browser_bookmark_add_remove_and_private_isolation');
  await card.getByRole('button', { name: '阅读全文', exact: true }).click();
  stage = 'forum_comment_create';
  await page.getByRole('dialog').locator('textarea').fill(marker + '-COMMENT');
  await page.getByRole('dialog').getByRole('button', { name: '发送', exact: true }).click();
  const comments = await poll(() => req(`/rest/v1/forum_comments?post_id=eq.${post.id}&select=*`, { token: a.token }), c => c.length === 1, 'Browser comment not persisted');
  pass('browser_comment_create_persisted');
  const comment = comments[0];
  check((await rows('forum_posts', post.id, b.token)).length === 1, 'Members cannot read shared posts');
  for (const [table, id] of [['forum_posts', post.id], ['forum_comments', comment.id]]) {
    check((await rows(table, id, b.token, { method: 'PATCH', body: { body: 'unauthorized' } })).length === 0, 'Other user modified shared content');
    check((await rows(table, id, b.token, { method: 'DELETE' })).length === 0, 'Other user deleted shared content');
    const updated = await rows(table, id, a.token, { method: 'PATCH', body: { body: 'Edited disposable content' } });
    check(updated[0]?.body === 'Edited disposable content', 'Owner shared content edit failed');
    const anonymous = await response(`/rest/v1/${table}?id=eq.${id}&select=*`);
    check(anonymous.status === 401 || anonymous.status === 403 ||
      (anonymous.ok && (await anonymous.json()).length === 0), 'Anonymous shared content read allowed');
  }
  pass('forum_owner_edit_member_read_outsider_write_denial');
  await rows('forum_comments', comment.id, a.token, { method: 'DELETE' });
  await rows('forum_posts', post.id, a.token, { method: 'DELETE' });
  check((await rows('forum_posts', post.id, a.token)).length === 0, 'Post deletion failed');
  pass('forum_comment_and_post_owner_delete_api');
  await page.goto(site + '/dives/' + dive.id, { waitUntil: 'networkidle' });
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await poll(() => rows('dives', dive.id, a.token), d => d.length === 0, 'Browser dive delete failed');
  pass('browser_log_delete_persisted');
  // Storage objects are verified and removed explicitly, not assumed cascaded.
  for (const bucket of [...new Set(files.map(f => f.bucket))]) {
    const paths = files.filter(f => f.bucket === bucket).map(f => f.path);
    await req('/storage/v1/object/' + bucket, { method: 'DELETE', token: a.token, body: { prefixes: paths } });
    for (const path of paths) {
      const r = await response('/storage/v1/object/sign/' + bucket + '/' + path, { method: 'POST', token: a.token, body: { expiresIn: 60 } });
      check(!r.ok, 'Photo deletion did not persist');
    }
  }
  pass('synthetic_photo_and_thumbnail_explicit_delete_verified');
} catch (e) {
  console.error('Business test failed after stage: ' + stage + '; details suppressed (' + e.constructor.name + ').');
  process.exitCode = 1;
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  if (browser) await browser.close();
  let cleanup = true;
  // Also collect uploads from a partially failed browser submit before a row existed.
  for (const u of users) {
    for (const bucket of ['dive-photos', 'forum-media']) {
      try {
        for (const prefix of [u.id, u.id + '/thumbs']) {
          const list = await req('/storage/v1/object/list/' + bucket, { method: 'POST', privileged: true,
            body: { prefix, limit: 1000 } });
          for (const item of list) if (item.id) files.push({ bucket, path: prefix + '/' + item.name });
        }
      } catch { cleanup = false; }
    }
  }
  for (const f of files) {
    try { await req('/storage/v1/object/' + f.bucket, { method: 'DELETE', privileged: true, body: { prefixes: [f.path] } }); }
    catch { cleanup = false; }
  }
  for (const u of users) {
    try {
      // Only this run's recorded UUIDs, never search/delete other accounts.
      await req('/auth/v1/admin/users/' + u.id, { method: 'DELETE', privileged: true });
      const r = await response('/auth/v1/admin/users/' + u.id, { privileged: true });
      check(r.status === 404, 'Synthetic account remains');
      for (const table of ['dives', 'forum_posts', 'forum_comments', 'forum_bookmarks']) {
        const remaining = await req(`/rest/v1/${table}?user_id=eq.${u.id}&select=user_id`, { privileged: true });
        check(remaining.length === 0, 'Synthetic rows remain');
      }
    } catch { cleanup = false; }
  }
  if (!cleanup) { process.exitCode = 1; console.error('Synthetic cleanup needs attention.'); }
  else console.log('PASS: synthetic_account_and_storage_cleanup_verified');
  const report = { checks, status: process.exitCode ? 'incomplete' : 'passed', target: project,
    synthetic_cleanup_verified: cleanup, production_modified: false, local_user_data_saved: false,
    frontend: 'log create/edit/delete, photo upload/render, post/comment create, bookmark toggle',
    api: 'ownership isolation, private reads, forged owner denial, post/comment edit/delete, photo delete',
    fixture_ids_for_cleanup: process.exitCode ? users.map(u => u.id) : [] };
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify(report, null, 2) + '\n```\n');
}
