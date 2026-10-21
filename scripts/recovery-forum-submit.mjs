// Cloud-only: synthetic account, text and generated PNG. No mail or human data export.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';
const api = 'https://esovqvampbrhuhamkfcs.supabase.co';
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const source = await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8');
const anon = source.match(/const anon = '([^']+)'/)[1];
let browser, user, stage = 'preflight', cleaned = false;
const results = [], paths = new Set();
function check(ok, message) { if (!ok) throw Error(message); }
function pass(name) { results.push(name); stage = name; console.log('PASS: ' + name); }
async function req(path, { method = 'GET', body } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Invalid API path');
  const response = await fetch(api + path, { method, signal: AbortSignal.timeout(45000), headers: {
    apikey: admin, Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
  }, body: body ? JSON.stringify(body) : undefined });
  check(response.ok, 'Recovery API HTTP ' + response.status);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
async function posts() { return req(`/rest/v1/forum_posts?user_id=eq.${user.id}&select=id,title,body,location,topic,image_path,linked_dive_id`); }
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud recovery credential required');
  const suffix = randomBytes(12).toString('hex');
  const email = `forum-${suffix}@example.invalid`, password = randomBytes(32).toString('base64url');
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  const [dive] = await req('/rest/v1/dives', { method: 'POST', body: { user_id: user.id,
    country: 'Indonesia', site_name: 'FORUM-LINK-' + suffix, dive_date: '2026-10-22' } });
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
  const page = await context.newPage();
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/auth', { timeout: 60000 });
  await page.goto(site + '/forum', { waitUntil: 'networkidle' });
  await page.locator('.do-forum-compose-strip > button').click();
  const dialog = page.getByRole('dialog');
  const title = dialog.locator('.do-forum-composer-fields input').first();
  const location = dialog.locator('.do-forum-composer-fields input').nth(1);
  const body = dialog.locator('textarea');
  const submit = dialog.locator('footer button').last();
  await title.fill('FORUM-' + suffix);
  await location.fill('Synthetic site');
  await body.fill('Synthetic retained draft ' + suffix);
  await dialog.getByLabel('选择主题', { exact: true }).selectOption('gear');
  await dialog.getByLabel('关联日志', { exact: true }).selectOption(dive.id);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  let mode = 'fail', postRequests = 0, patchRequests = 0;
  await context.route(api + '/rest/v1/forum_posts*', async route => {
    const request = route.request(), method = request.method();
    if (!['POST', 'PATCH'].includes(method)) return route.continue();
    if (method === 'POST') postRequests++; else patchRequests++;
    const payload = request.postDataJSON();
    if (method === 'POST' && payload.image_path) paths.add(payload.image_path);
    await new Promise(resolve => setTimeout(resolve, 900));
    if (mode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic failure"}' });
    if (mode === 'lost' && method === 'POST') {
      await req('/rest/v1/forum_posts', { method: 'POST', body: payload });
      mode = 'pass';
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic lost response"}' });
    }
    return route.continue();
  });
  stage = 'failed publish retention';
  await submit.click();
  await dialog.getByRole('button', { name: '正在提交…', exact: true }).waitFor();
  check(!await title.isEnabled() && !await body.isEnabled() && !await submit.isEnabled(), 'Composer not locked');
  // Native synchronous double activation exercises the ref guard, not Playwright auto-wait.
  await submit.evaluate(button => { button.click(); button.click(); });
  await dialog.getByRole('button', { name: '发布', exact: true }).waitFor();
  check(postRequests === 1 && (await posts()).length === 0, 'Failed double click wrote data');
  check(await title.inputValue() === 'FORUM-' + suffix && await location.inputValue() === 'Synthetic site'
    && await body.inputValue() === 'Synthetic retained draft ' + suffix, 'Failure lost text');
  check(await dialog.getByLabel('选择主题', { exact: true }).inputValue() === 'gear'
    && await dialog.getByLabel('关联日志', { exact: true }).inputValue() === dive.id
    && await dialog.locator('input[type=file]').evaluate(input => input.files.length) === 1, 'Failure lost metadata or photo');
  pass('failed_publish_keeps_text_topic_photo_and_linked_log_and_blocks_double_click');
  mode = 'lost';
  await submit.click();
  await dialog.getByRole('button', { name: '正在提交…', exact: true }).waitFor();
  await dialog.getByRole('button', { name: '发布', exact: true }).waitFor();
  check((await posts()).length === 1, 'Lost response did not save fixture');
  pass('server_commit_lost_response_keeps_composer_for_retry');
  await submit.click();
  await dialog.waitFor({ state: 'hidden' });
  const rows = await posts();
  check(rows.length === 1 && postRequests === 2 && rows[0].linked_dive_id === dive.id, 'Retry duplicated post');
  const imagePaths = await req('/storage/v1/object/list/forum-media', { method: 'POST', body: { prefix: user.id + '/', limit: 100 } });
  check(imagePaths.length === 1, 'Retry duplicated uploaded image');
  pass('retry_confirms_original_post_and_photo_without_duplicate');
  const card = page.locator('#post-' + rows[0].id);
  await card.getByRole('button', { name: '更多操作', exact: true }).click();
  await card.getByRole('menuitem', { name: '编辑帖子', exact: true }).click();
  await body.fill('Edited synthetic ' + suffix);
  mode = 'fail';
  await submit.click();
  await dialog.getByRole('button', { name: '正在提交…', exact: true }).waitFor();
  await submit.evaluate(button => { button.click(); button.click(); });
  await dialog.getByRole('button', { name: '保存修改', exact: true }).waitFor();
  check(patchRequests === 1 && await body.inputValue() === 'Edited synthetic ' + suffix
    && (await posts())[0].body === 'Synthetic retained draft ' + suffix, 'Failed edit lost content');
  pass('failed_edit_keeps_draft_and_blocks_duplicate_save');
  mode = 'pass';
  await submit.click();
  await dialog.waitFor({ state: 'hidden' });
  check((await posts()).length === 1 && (await posts())[0].body === 'Edited synthetic ' + suffix, 'Edit retry not saved');
  pass('edit_retry_updates_original_post_successfully');
} catch (error) {
  console.error(`Forum test incomplete after ${stage} (${error.constructor.name}); details suppressed.`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      const objects = await req('/storage/v1/object/list/forum-media', { method: 'POST', body: { prefix: user.id + '/', limit: 100 } });
      for (const object of objects) paths.add(user.id + '/' + object.name);
      check([...paths].every(path => path.startsWith(user.id + '/')), 'Cleanup ownership mismatch');
      if (paths.size) await req('/storage/v1/object/forum-media', { method: 'DELETE', body: { prefixes: [...paths] } });
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      const result = await fetch(api + '/auth/v1/admin/users/' + user.id, { headers: { apikey: admin, Authorization: `Bearer ${admin}` } });
      check(result.status === 404 && (await posts()).length === 0
        && (await req(`/rest/v1/dives?user_id=eq.${user.id}&select=id`)).length === 0
        && (await req('/storage/v1/object/list/forum-media', { method: 'POST', body: { prefix: user.id + '/', limit: 100 } })).length === 0, 'Cleanup incomplete');
      cleaned = true;
    } catch { process.exitCode = 1; }
  }
  console.log(`${cleaned ? 'PASS' : 'FAIL'}: synthetic_account_posts_log_and_photo_cleanup`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify({ checks: results,
    status: process.exitCode ? 'incomplete' : 'passed', synthetic_cleanup_verified: cleaned,
    production_modified: false, local_user_data_saved: false, fixture_ids_for_cleanup: cleaned || !user ? [] : [user.id] }, null, 2) + '\n```\n');
}
