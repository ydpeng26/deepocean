// Cloud-only: hardcoded recovery project, disposable account and generated image.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';
const api = 'https://esovqvampbrhuhamkfcs.supabase.co';
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const source = await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8');
const anon = source.match(/const anon = '([^']+)'/)[1];
let browser, page, user, stage = 'preflight', cleaned = false;
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
async function profile() { return (await req(`/rest/v1/profiles?id=eq.${user.id}&select=id,display_name,bio,cert_level,tank_count,avatar_url`))[0]; }
async function poll(fn, predicate) {
  for (let n = 0; n < 80; n++) { const value = await fn(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw Error('Synthetic condition did not settle');
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud recovery credential required');
  const suffix = randomBytes(12).toString('hex');
  const email = `profile-${suffix}@example.invalid`, password = randomBytes(32).toString('base64url');
  const original = 'PROFILE-ORIGINAL-' + suffix, edited = 'PROFILE-EDIT-' + suffix;
  user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  await req(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', body: {
    display_name: original, bio: 'Original synthetic bio', cert_level: 'OW 开放水域', tank_count: 3,
  } });
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
  let failRead = true, failSave = false, saves = 0, uploads = 0;
  await context.route(api + '/rest/v1/profiles*', async route => {
    const request = route.request();
    if (request.method() === 'GET' && failRead) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic read failure"}' });
    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      if (payload.avatar_url) { uploads++; paths.add(payload.avatar_url); }
      else saves++;
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (!payload.avatar_url && failSave) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic save failure"}' });
    }
    return route.continue();
  });
  page = await context.newPage();
  async function login() {
    await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL(url => url.pathname !== '/auth', { timeout: 60000 });
  }
  await login();
  stage = 'read failure';
  await page.goto(site + '/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').filter({ hasText: '暂时无法读取个人资料' }).waitFor({ timeout: 45000 });
  check(await page.locator('.do-profile-fields input').count() === 0, 'Read failure exposed blank editor');
  failRead = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  const name = page.getByLabel('显示名称', { exact: true });
  const bio = page.getByLabel(/^个人简介/);
  const cert = page.locator('.do-profile-fields select');
  const tanks = page.getByLabel('累计潜水瓶数', { exact: true });
  const save = page.getByRole('button', { name: '保存个人资料', exact: true });
  await poll(() => name.inputValue(), value => value === original);
  pass('read_failure_blocks_blank_editor_and_reload_restores_actual_profile');
  stage = 'edit name'; await name.fill(edited);
  stage = 'edit bio'; await bio.fill('Edited synthetic bio ' + suffix);
  stage = 'edit certification'; await cert.selectOption('AOW 进阶开放水域');
  stage = 'edit tank count'; await tanks.fill('15');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64');
  stage = 'select avatar';
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  stage = 'avatar pending state';
  await page.getByRole('button', { name: '上传中…', exact: true }).waitFor();
  check(!await name.isEnabled() && !await save.isEnabled(), 'Avatar upload did not lock editor');
  stage = 'avatar success notice';
  await page.getByText('头像已更新', { exact: true }).waitFor();
  check(await name.inputValue() === edited && await bio.inputValue() === 'Edited synthetic bio ' + suffix
    && await cert.inputValue() === 'AOW 进阶开放水域' && await tanks.inputValue() === '15', 'Avatar upload lost edits');
  const avatarProfile = await profile();
  check(avatarProfile.display_name === original && avatarProfile.avatar_url.startsWith(user.id + '/') && uploads === 1, 'Avatar update saved unrelated draft or duplicated');
  paths.add(avatarProfile.avatar_url);
  await poll(() => page.locator('.do-passport-account img').evaluateAll(images => images.some(image => image.complete && image.naturalWidth > 0 && image.src.includes('/storage/'))), value => value);
  pass('real_avatar_upload_renders_signed_image_without_resetting_unsaved_profile_fields');
  failSave = true;
  await save.click();
  const saving = page.getByRole('button', { name: '保存中…', exact: true });
  await saving.waitFor();
  for (const field of [name, bio, cert, tanks]) check(!await field.isEnabled(), 'Save left a field editable');
  await saving.evaluate(button => { button.click(); button.click(); });
  await page.getByText('保存失败，修改内容已保留，请重试', { exact: true }).waitFor();
  await save.waitFor();
  check(saves === 1 && await name.inputValue() === edited && (await profile()).display_name === original, 'Failure discarded edits or wrote data');
  check(await page.locator('.do-profile-save-status').innerText() === '', 'Failure marked saved');
  pass('failed_save_keeps_all_edits_and_pending_double_activation_creates_one_request');
  failSave = false;
  await save.click(); await page.getByText('更改已保存', { exact: true }).waitFor();
  const confirmed = await profile();
  check(saves === 2 && confirmed.display_name === edited && confirmed.bio === 'Edited synthetic bio ' + suffix
    && confirmed.cert_level === 'AOW 进阶开放水域' && confirmed.tank_count === 15 && confirmed.avatar_url === avatarProfile.avatar_url, 'Save retry mismatch');
  pass('retry_saves_exact_text_certification_and_tank_count_without_replacing_avatar');
  await page.reload({ waitUntil: 'networkidle' });
  await poll(() => name.inputValue(), value => value === edited);
  check(await bio.inputValue() === confirmed.bio && await cert.inputValue() === confirmed.cert_level && await tanks.inputValue() === '15', 'Reload lost confirmed data');
  await page.goto(site + '/dives', { waitUntil: 'networkidle' });
  await page.locator('#passport-identity-title').filter({ hasText: edited }).waitFor();
  await page.locator('#passport-cert-title').filter({ hasText: 'AOW 进阶开放水域' }).waitFor();
  await page.locator('.do-passport-identity-row').filter({ hasText: '现有瓶数' }).getByText('15', { exact: true }).waitFor();
  pass('reload_and_passport_show_the_saved_name_certification_and_tanks');
  await page.goto(site + '/divers/' + user.id, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: edited, exact: true }).waitFor();
  await page.getByText('AOW 进阶开放水域', { exact: true }).waitFor();
  pass('authenticated_public_profile_shows_saved_identity');
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.waitForURL('**/auth', { timeout: 30000 });
  await login();
  await page.goto(site + '/profile', { waitUntil: 'networkidle' });
  await poll(() => name.inputValue(), value => value === edited);
  check(await bio.inputValue() === confirmed.bio && await cert.inputValue() === confirmed.cert_level && await tanks.inputValue() === '15', 'Relogin lost saved fields');
  await poll(() => page.locator('.do-profile-avatar img').evaluateAll(images => images.some(image => image.complete && image.naturalWidth > 0 && image.src.includes('/storage/'))), value => value);
  pass('signout_and_fresh_signin_preserve_saved_fields_and_real_avatar');
} catch (error) {
  console.error(`Profile test incomplete after ${stage} (${error.constructor.name}); details suppressed.`);
  if (page) console.log('Safe avatar diagnostic: decode-error=' + await page.getByText('无法处理该图片，请选择 JPG、PNG 或 WebP 格式', { exact: true }).count()
    + ', upload-failure=' + await page.getByText('头像上传失败', { exact: true }).count()
    + ', success-notice=' + await page.getByText('头像已更新', { exact: true }).count()
    + ', profile-avatar-stored=' + Boolean((await profile())?.avatar_url));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (user) {
    try {
      const objects = await req('/storage/v1/object/list/avatars', { method: 'POST', body: { prefix: user.id + '/', limit: 100 } });
      for (const object of objects) paths.add(user.id + '/' + object.name);
      check([...paths].every(path => path.startsWith(user.id + '/')), 'Cleanup ownership mismatch');
      if (paths.size) await req('/storage/v1/object/avatars', { method: 'DELETE', body: { prefixes: [...paths] } });
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      const result = await fetch(api + '/auth/v1/admin/users/' + user.id, { headers: { apikey: admin, Authorization: `Bearer ${admin}` } });
      check(result.status === 404 && !await profile()
        && (await req('/storage/v1/object/list/avatars', { method: 'POST', body: { prefix: user.id + '/', limit: 100 } })).length === 0, 'Cleanup incomplete');
      cleaned = true;
    } catch { process.exitCode = 1; }
  }
  console.log(`${cleaned ? 'PASS' : 'FAIL'}: synthetic_account_profile_and_avatar_cleanup`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify({ checks: results,
    status: process.exitCode ? 'incomplete' : 'passed', synthetic_cleanup_verified: cleaned,
    production_modified: false, local_user_data_saved: false, fixture_ids_for_cleanup: cleaned || !user ? [] : [user.id] }, null, 2) + '\n```\n');
}
