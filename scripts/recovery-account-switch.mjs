// Cloud-only synthetic PC test. No restored accounts, mail, photos or artifacts.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, appendFile } from 'node:fs/promises';

const project = 'esovqvampbrhuhamkfcs';
const api = `https://${project}.supabase.co`;
const site = 'https://supdiver-recovery-test.vercel.app';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const source = await readFile(new URL('./recovery-browser.mjs', import.meta.url), 'utf8');
const anon = source.match(/const anon = '([^']+)'/)[1];
const users = [], results = [];
let browser, page, stage = 'preflight', cleaned = true;
function check(value, message) { if (!value) throw new Error(message); }
function record(name, passed) {
  results.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
  if (!passed) process.exitCode = 1;
}
async function request(path, { method = 'GET', body, token, privileged = false } = {}) {
  check(path.startsWith('/') && !path.startsWith('//'), 'Invalid API path');
  return fetch(api + path, { method, signal: AbortSignal.timeout(45000),
    headers: { apikey: privileged ? admin : anon, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(privileged || token ? { Authorization: `Bearer ${privileged ? admin : token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
}
async function req(path, options) {
  const response = await request(path, options);
  check(response.ok, `Test API HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Recovery cloud credential required');
  stage = 'synthetic fixtures';
  for (const label of ['A', 'B']) {
    const suffix = randomBytes(10).toString('hex');
    const email = `pc-switch-${suffix}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const name = `PC-SWITCH-${label}-${suffix}`;
    const user = await req('/auth/v1/admin/users', { method: 'POST', privileged: true,
      body: { email, password, email_confirm: true, user_metadata: { display_name: name } } });
    users.push({ id: user.id, email, password, name, siteName: `PC-DIVE-${label}-${suffix}` });
    await req(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', privileged: true, body: { display_name: name } });
    await req('/rest/v1/dives', { method: 'POST', privileged: true, body: {
      user_id: user.id, country: 'Indonesia', site_name: users.at(-1).siteName,
      dive_date: '2026-10-21', dive_type: 'recreational', photo_urls: [], photo_thumbnail_urls: [] } });
  }
  record('two_synthetic_recovery_accounts_and_logs_created_without_email', true);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ((url.hostname.endsWith('.supabase.co') && url.origin !== api) || ['supdiver.com', 'www.supdiver.com'].includes(url.hostname)) {
      process.exitCode = 1;
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => localStorage.setItem('deepocean-language', 'zh-CN'));
  page = await context.newPage();
  async function login(user) {
    await page.getByLabel('邮箱', { exact: true }).fill(user.email);
    await page.getByLabel('密码', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL('**/dives', { timeout: 60000 });
    await page.waitForLoadState('networkidle');
  }
  stage = 'first account browser login';
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await login(users[0]);
  stage = 'first account log render';
  await page.getByText(users[0].siteName, { exact: true }).waitFor({ state: 'visible' });
  record('account_A_profile_and_log_rendered', (await page.locator('.do-member-header').innerText()).includes(users[0].name));
  // Preserve this exact document and router cache across logout/login.
  const documentId = await page.evaluate(() => performance.timeOrigin);
  stage = 'same-tab logout';
  await page.locator('.do-member-header').getByRole('button', { name: '退出', exact: true }).click();
  await page.waitForURL('**/auth', { timeout: 30000 });
  record('logout_returns_to_signin', await page.getByRole('button', { name: '登录', exact: true }).isVisible());
  stage = 'second account browser login';
  // SPA navigation can retain the document's earlier networkidle state. Observe
  // stale content throughout the transition and await B's actual rendered data.
  await page.evaluate(({ name, siteName }) => {
    window.__pcOldAccountVisible = false;
    new MutationObserver(() => {
      if (location.pathname !== '/dives') return;
      const text = document.body.innerText;
      if (text.includes(name) || text.includes(siteName)) window.__pcOldAccountVisible = true;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }, { name: users[0].name, siteName: users[0].siteName });
  await login(users[1]);
  record('same_document_preserved_for_cache_test', documentId === await page.evaluate(() => performance.timeOrigin));
  const transition = await page.locator('body').innerText();
  record('old_account_not_visible_while_B_loads', !transition.includes(users[0].name) && !transition.includes(users[0].siteName));
  stage = 'second account data render';
  await page.getByText(users[1].siteName, { exact: true }).waitFor({ state: 'visible' });
  await page.locator('.do-member-header').getByText(users[1].name, { exact: true }).waitFor({ state: 'visible' });
  const view = await page.locator('body').innerText();
  record('account_B_profile_replaces_A', view.includes(users[1].name) && !view.includes(users[0].name));
  record('account_B_log_replaces_A', view.includes(users[1].siteName) && !view.includes(users[0].siteName));
  record('no_old_account_flash_during_B_transition', !(await page.evaluate(() => window.__pcOldAccountVisible)));
  stage = 'independent API isolation';
  const session = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: users[1].email, password: users[1].password } });
  const rows = await req('/rest/v1/dives?select=user_id,site_name', { token: session.access_token });
  record('account_B_API_sees_only_own_synthetic_log', rows.length === 1 && rows[0].user_id === users[1].id);
  stage = 'full-reload control';
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(users[1].siteName, { exact: true }).waitFor({ state: 'visible' });
  const refreshed = await page.locator('body').innerText();
  record('full_reload_shows_B_without_A', refreshed.includes(users[1].name) && !refreshed.includes(users[0].name) && !refreshed.includes(users[0].siteName));
  stage = 'reset-link verification regression';
  // Generate a link without sending mail or changing a password. Verify that
  // session changes do not remount this page after it consumes its one-use token.
  await page.locator('.do-member-header').getByRole('button', { name: '退出', exact: true }).click();
  await page.waitForURL('**/auth');
  const recovery = await req('/auth/v1/admin/generate_link', { method: 'POST', privileged: true,
    body: { type: 'recovery', email: users[1].email } });
  check(recovery.hashed_token, 'Synthetic recovery token unavailable');
  await page.goto(site + '/reset-password?token_hash=' + encodeURIComponent(recovery.hashed_token), { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '保存新密码', exact: true }).waitFor({ state: 'visible' });
  record('recovery_link_unlocks_form_without_password_change_or_email', true);
  record('recovery_token_removed_from_address', !page.url().includes('token_hash'));
} catch (error) {
  console.error(`Test incomplete at ${stage}; details suppressed (${error.constructor.name}).`);
  if (page) {
    try {
      const body = await page.locator('body').innerText({ timeout: 5000 });
      console.log('Safe UI diagnostic: ' + JSON.stringify({
        path: new URL(page.url()).pathname,
        signinVisible: await page.getByRole('button', { name: '登录', exact: true }).isVisible(),
        memberHeader: await page.locator('.do-member-header').count(),
        accountAVisible: Boolean(users[0] && body.includes(users[0].name)),
        logAVisible: Boolean(users[0] && body.includes(users[0].siteName)),
        loadingVisible: /载入|加载/.test(body),
        errorVisible: /失败|出了点问题|Something went wrong|didn't load/.test(body),
      }));
    } catch { console.log('Safe UI diagnostic unavailable.'); }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const user of users) {
    try {
      await req('/auth/v1/admin/users/' + user.id, { method: 'DELETE', privileged: true });
      check((await request('/auth/v1/admin/users/' + user.id, { privileged: true })).status === 404, 'Synthetic user remains');
      check((await req(`/rest/v1/dives?user_id=eq.${user.id}&select=id`, { privileged: true })).length === 0, 'Synthetic log remains');
    } catch { cleaned = false; process.exitCode = 1; }
  }
  console.log(`${cleaned ? 'PASS' : 'FAIL'}: synthetic_account_and_log_cleanup`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify({ results, stage,
    synthetic_cleanup_verified: cleaned, production_modified: false, local_user_data_saved: false,
    fixture_ids_for_cleanup: cleaned ? [] : users.map(user => user.id) }, null, 2) + '\n```\n');
}
