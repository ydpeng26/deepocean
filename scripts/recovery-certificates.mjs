// Recovery only. Disposable synthetic accounts; no screenshots, artifacts or real-user edits.
import { chromium } from 'playwright';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const api = 'https://esovqvampbrhuhamkfcs.supabase.co';
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const anon = (await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8')).match(/const anon = '([^']+)'/)[1];
const users = [], bucket = 'certificate-fronts';
let browser, stage = 'preflight', failed = false;
const check = (value, message) => { if (!value) throw Error(message); };
const pass = name => { stage = name; console.log('PASS: ' + name); };
async function response(path, { method = 'GET', body, token = admin, key = token === admin ? admin : anon } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Path');
  return fetch(api + path, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
}
async function req(path, options) {
  const result = await response(path, options); check(result.ok, 'Recovery HTTP ' + result.status);
  const text = await result.text(); return text ? JSON.parse(text) : null;
}
async function session(user) {
  return req('/auth/v1/token?grant_type=password', { method: 'POST', key: anon, token: anon, body: { email: user.email, password: user.password } });
}
async function rows(user) { return req(`/rest/v1/diver_certificates?user_id=eq.${user.id}&select=*`, { token: user.token }); }
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud recovery credentials required');
  stage = 'create disposable accounts';
  for (let i = 0; i < 2; i++) {
    const email = `certificate-${randomBytes(12).toString('hex')}@example.invalid`, password = randomBytes(32).toString('base64url');
    const user = await req('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    users.push({ id: user.id, email, password });
    users[i].token = (await session(users[i])).access_token;
  }
  const [a,b] = users, fixture = { id: randomUUID(), user_id: a.id, agency: 'PADI', level: 'API-PRIVATE', certificate_number: 'NEVER-PUBLIC', is_public: false };
  await req('/rest/v1/diver_certificates', { method: 'POST', token: a.token, body: fixture });
  check((await rows(a)).length === 1 && (await req('/rest/v1/diver_certificates?select=*', { token: b.token })).length === 0, 'Owner only, including unfiltered malicious read');
  check(!(await response('/rest/v1/diver_certificates', { method: 'POST', token: b.token, body: { ...fixture, id: randomUUID() } })).ok, 'Forged owner insert denied');
  check((await req(`/rest/v1/diver_certificates?id=eq.${fixture.id}`, { method: 'PATCH', token: b.token, body: { level: 'FORGED' } })).length === 0, 'Other owner update denied');
  check(!(await fetch(api + '/rest/v1/diver_certificates?on_conflict=id', { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ ...fixture, user_id: b.id }), signal: AbortSignal.timeout(45000) })).ok, 'Cannot take over another certificate through upsert');
  check(!(await response('/rest/v1/diver_certificates?select=*', { token: anon })).ok, 'Anonymous table denied');
  check((await req('/rest/v1/rpc/get_public_diver_certificates', { method: 'POST', token: b.token, body: { target_user_id: a.id } })).length === 0, 'Private summary hidden');
  await req(`/rest/v1/diver_certificates?id=eq.${fixture.id}`, { method: 'PATCH', token: a.token, body: { is_public: true } });
  const publicRows = await req('/rest/v1/rpc/get_public_diver_certificates', { method: 'POST', token: b.token, body: { target_user_id: a.id } });
  check(publicRows.length === 1 && Object.keys(publicRows[0]).sort().join(',') === 'agency,id,issued_at,issued_on,level', 'Safe summary columns');
  check(!(await response('/rest/v1/rpc/get_public_diver_certificates', { method: 'POST', token: anon, body: { target_user_id: a.id } })).ok, 'Anonymous RPC denied');
  await req(`/rest/v1/diver_certificates?id=eq.${fixture.id}`, { method: 'PATCH', token: a.token, body: { deleted_at: new Date().toISOString() } });
  check((await req('/rest/v1/rpc/get_public_diver_certificates', { method: 'POST', token: b.token, body: { target_user_id: a.id } })).length === 0, 'Archived hidden');
  await req(`/rest/v1/diver_certificates?id=eq.${fixture.id}`, { method: 'DELETE', token: a.token });
  pass('api_owner_isolation_forgery_denials_public_allowlist_and_archive');
  stage = 'PC browser';
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ((url.hostname.endsWith('.supabase.co') && url.origin !== api) || ['supdiver.com','www.supdiver.com'].includes(url.hostname)) {
      failed = true; return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  async function login(user) {
    await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
    await page.getByLabel('邮箱', { exact: true }).fill(user.email);
    await page.getByLabel('密码', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL(url => url.pathname !== '/auth', { timeout: 60000 });
  }
  await login(a);
  await page.goto(site + '/certificates', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '新增证书', exact: true }).click();
  await page.getByLabel('证书等级', { exact: true }).fill('OW-SYNTHETIC');
  await page.getByLabel('证书编号（仅本人可见）', { exact: true }).fill('NUMBER-SYNTHETIC-PRIVATE');
  await page.getByLabel('签发日期', { exact: true }).fill('2025-04-12');
  await page.getByLabel('签发地点', { exact: true }).fill('Synthetic dive centre');
  check(await page.locator('select').inputValue() === 'private', 'Default private');
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64') });
  let failSave = true;
  await context.route(api + '/rest/v1/diver_certificates*', route => {
    if (route.request().method() === 'POST' && failSave) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic failure"}' });
    return route.continue();
  });
  await page.getByRole('button', { name: '保存证书', exact: true }).click();
  await page.getByText(/保存失败，修改与照片仍保留/).waitFor();
  check(await page.getByLabel('证书等级', { exact: true }).inputValue() === 'OW-SYNTHETIC', 'Draft retained');
  check((await rows(a)).length === 0, 'No false success');
  failSave = false;
  await page.getByRole('button', { name: '保存证书', exact: true }).click();
  await page.getByRole('button', { name: '编辑证书', exact: true }).waitFor();
  let saved = (await rows(a))[0];
  check(saved && saved.is_public === false && saved.front_photo_path.startsWith(a.id + '/'), 'Real private row and photo');
  check((await rows(a)).length === 1, 'No retry duplicate');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('img', { name: '证书正面', exact: true }).waitFor();
  check(await page.getByRole('img', { name: '证书正面', exact: true }).evaluate(img => img.complete && img.naturalWidth > 0), 'Real image decoded');
  pass('browser_private_front_photo_failed_save_retry_and_reload');
  await page.getByRole('button', { name: '编辑证书', exact: true }).click();
  await page.getByLabel('证书等级', { exact: true }).fill('AOW-SYNTHETIC');
  await page.locator('select').selectOption('public');
  await page.getByRole('button', { name: '保存证书', exact: true }).click();
  await page.getByRole('button', { name: '编辑证书', exact: true }).waitFor();
  saved = (await rows(a))[0];
  check(saved.level === 'AOW-SYNTHETIC' && saved.is_public, 'Edit and visibility persisted');
  await page.getByRole('button', { name: '新增证书', exact: true }).click();
  await page.getByLabel('认证机构', { exact: true }).fill('SSI');
  await page.getByLabel('证书等级', { exact: true }).fill('NITROX-PRIVATE');
  await page.getByRole('button', { name: '保存证书', exact: true }).click();
  await page.getByRole('button', { name: '编辑证书', exact: true }).waitFor();
  check((await rows(a)).length === 2, 'Multiple real certificates');
  check(!(await response(`/storage/v1/object/sign/${bucket}/${saved.front_photo_path}`, { method: 'POST', token: b.token, body: { expiresIn: 60 } })).ok, 'Other owner cannot sign public credential photo');
  check(!(await response(`/storage/v1/object/authenticated/${bucket}/${saved.front_photo_path}`, { token: b.token })).ok, 'Other owner cannot read private photo');
  check(!(await response(`/storage/v1/object/public/${bucket}/${saved.front_photo_path}`, { token: anon })).ok, 'No public image endpoint');
  check((await req(`/rest/v1/diver_certificates?user_id=eq.${a.id}&select=*`, { token: b.token })).length === 0, 'Public credential raw row still private');
  const maliciousWrite = await fetch(api + '/storage/v1/object/' + bucket + '/' + saved.front_photo_path, { method: 'PUT', headers: { apikey: anon, Authorization: `Bearer ${b.token}`, 'Content-Type': 'image/jpeg' }, body: Buffer.from('synthetic-forbidden-overwrite'), signal: AbortSignal.timeout(45000) });
  check(!maliciousWrite.ok, 'Other owner cannot overwrite photo');
  pass('multiple_records_public_summary_still_blocks_private_number_and_photo');
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await login(b);
  await page.goto(site + '/divers/' + a.id, { waitUntil: 'networkidle' });
  const summary = page.getByRole('region', { name: '公开证书摘要', exact: true });
  await summary.getByText('AOW-SYNTHETIC', { exact: true }).waitFor();
  const publicText = await summary.innerText();
  check(!publicText.includes('NITROX-PRIVATE') && !publicText.includes('NUMBER-SYNTHETIC-PRIVATE') && await summary.locator('img').count() === 0, 'No private content in public UI');
  await page.goto(site + '/certificates', { waitUntil: 'networkidle' });
  await page.getByText('还没有证书档案', { exact: true }).waitFor();
  pass('second_account_public_ui_safe_and_own_archive_empty');
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await login(a);
  await page.goto(site + '/certificates', { waitUntil: 'networkidle' });
  await page.locator('.do-cert-live-list button').filter({ hasText: 'AOW-SYNTHETIC' }).click();
  await page.getByRole('button', { name: '编辑证书', exact: true }).click();
  await page.getByRole('button', { name: '移除正面照片', exact: true }).click();
  await page.getByRole('button', { name: '保存证书', exact: true }).click();
  await page.getByRole('button', { name: '编辑证书', exact: true }).waitFor();
  check((await rows(a)).find(r => r.id === saved.id).front_photo_path === null, 'Photo detached');
  await page.getByRole('button', { name: '移除此证书', exact: true }).click();
  await page.getByText('证书已移除', { exact: true }).waitFor();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.locator('.do-cert-live-list button').filter({ hasText: 'AOW-SYNTHETIC' }).waitFor();
  check((await rows(a)).find(r => r.id === saved.id).deleted_at === null, 'Undo restored');
  check(!failed, 'No production request');
  pass('fresh_login_photo_removal_and_archive_undo');
} catch (error) {
  console.error(`Certificate test incomplete after ${stage} (${error.constructor.name}); details suppressed.`);
  failed = true;
} finally {
  await browser?.close();
  try {
    for (const user of users) {
      const list = await req('/storage/v1/object/list/' + bucket, { method: 'POST', body: { prefix: user.id + '/', limit: 1000 } });
      const paths = list.filter(item => item.id).map(item => user.id + '/' + item.name);
      check(paths.every(path => path.startsWith(user.id + '/')), 'Cleanup prefix');
      if (paths.length) await req('/storage/v1/object/' + bucket, { method: 'DELETE', body: { prefixes: paths } });
      check((await req('/storage/v1/object/list/' + bucket, { method: 'POST', body: { prefix: user.id + '/', limit: 1000 } })).length === 0, 'Files removed');
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE' });
      check((await response('/auth/v1/admin/users/' + user.id)).status === 404, 'Account removed');
      check((await req('/rest/v1/diver_certificates?user_id=eq.' + user.id + '&select=id')).length === 0, 'Rows removed');
    }
    pass('disposable_accounts_rows_and_photos_removed_and_verified');
  } catch (error) { console.error('Certificate fixture cleanup incomplete (' + error.constructor.name + '); details suppressed.'); failed = true; }
}
if (failed) process.exitCode = 1;
