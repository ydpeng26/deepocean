// No screenshots, traces, user details, tokens or credentials are published.
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

const project = 'esovqvampbrhuhamkfcs';
const api = `https://${project}.supabase.co`;
const site = 'https://supdiver-recovery-test.vercel.app';
// This is the public anon key, not a service/admin credential.
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzb3ZxdmFtcGJyaHVoYW1rZmNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzAwMTgsImV4cCI6MjEwODA0NjAxOH0.EvOkerEKJkxdEKxKLw-18xKxShLt0tn__o21wX9sjLU';
const admin = process.env.RECOVERY_SERVICE_ROLE_KEY;
const results = [];
const created = [];
let browser;
function check(value, message) { if (!value) throw new Error(message); }
function pass(name) { results.push(name); console.log(`PASS: ${name}`); }
async function request(path, { body, adminRequest = false, token, method = 'GET' } = {}) {
  const response = await fetch(api + path, {
    method, headers: { apikey: adminRequest ? admin : anon,
      ...(adminRequest || token ? { Authorization: `Bearer ${token || admin}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  check(response.ok, 'Test-project API request failed');
  return response.status === 204 ? null : response.json();
}
async function newContext(session) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const violations = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if ((url.hostname.endsWith('.supabase.co') && url.origin !== api) ||
        ['supdiver.com', 'www.supdiver.com'].includes(url.hostname)) {
      violations.push(true);
      return route.abort();
    }
    return route.continue();
  });
  if (session) await context.addInitScript(({ project, session }) => {
    sessionStorage.setItem(`sb-${project}-auth-token`, JSON.stringify(session));
  }, { project, session });
  return { context, violations };
}

try {
  check(process.env.GITHUB_ACTIONS === 'true' && admin, 'Cloud runner and test key required');
  browser = await chromium.launch();
  // Use a disposable account; admin creation does not send a real email.
  const email = `browser-${randomBytes(12).toString('hex')}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const user = await request('/auth/v1/admin/users', { adminRequest: true, method: 'POST',
    body: { email, password, email_confirm: true } });
  created.push(user.id);
  let { context, violations } = await newContext();
  let page = await context.newPage();
  await page.goto(site + '/auth', { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(url => url.origin === site && /^\/dives\/?$/.test(url.pathname), { timeout: 60000 });
  await page.locator('nav.do-main-navigation').waitFor({ timeout: 60000 });
  pass('browser_password_login_and_passport');
  for (const path of ['/dives/logs', '/forum', '/marine', '/profile', '/dives']) {
    await page.locator(`nav.do-main-navigation a[href="${path}"]`).click();
    await page.waitForURL(url => url.origin === site && url.pathname.replace(/\/$/, '') === path, { timeout: 60000 });
    await page.locator('nav.do-main-navigation a[href="/marine"]').waitFor();
    check(await page.locator('nav.do-main-navigation a').count() === 5, 'Navigation item disappeared');
    check(!await page.getByText("This page didn't load", { exact: true }).count(), 'Application error boundary displayed');
  }
  pass('navigation_all_five_sections_persist');
  await page.locator('.do-passport-logout').click();
  await page.waitForURL(url => url.pathname === '/auth', { timeout: 30000 });
  await page.goto(site + '/dives');
  await page.waitForURL(url => url.pathname === '/auth', { timeout: 30000 });
  pass('logout_protects_authenticated_pages');
  check(violations.length === 0, 'Application attempted to connect to production');
  await context.close();

  // Restore users log in through the actual Auth service without changing passwords.
  const users = (await request('/auth/v1/admin/users?page=1&per_page=100', { adminRequest: true })).users;
  let restoredSession;
  for (const existing of users.filter(u => !created.includes(u.id))) {
    const generated = await request('/auth/v1/admin/generate_link', { adminRequest: true, method: 'POST',
      body: { type: 'magiclink', email: existing.email } });
    const session = await request('/auth/v1/verify', { method: 'POST',
      body: { type: 'magiclink', token_hash: generated.hashed_token } });
    const dives = await request('/rest/v1/dives?select=id&limit=1', { token: session.access_token });
    if (dives.length) { restoredSession = session; break; }
    await request('/auth/v1/logout?scope=global', { method: 'POST', token: session.access_token });
  }
  check(restoredSession, 'No restored dive owner fixture available');
  ({ context, violations } = await newContext(restoredSession));
  page = await context.newPage();
  await page.goto(site + '/dives', { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('nav.do-main-navigation').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => [...document.images].some(i => i.src.includes('.supabase.co/storage/') && i.complete && i.naturalWidth > 0), { timeout: 60000 });
  pass('restored_account_passport_and_photo_render');
  for (const path of ['/dives/logs', '/profile', '/gear', '/forum', '/marine']) {
    await page.goto(site + path, { waitUntil: 'networkidle', timeout: 90000 });
    await page.locator('nav.do-main-navigation').waitFor({ timeout: 60000 });
    check(!await page.getByText("This page didn't load", { exact: true }).count(), 'Restored account page error');
    check(await page.locator('nav.do-main-navigation a').count() === 5, 'Restored navigation missing');
  }
  check(violations.length === 0, 'Restored pages attempted production access');
  pass('restored_account_all_primary_pages_load');
  await request('/auth/v1/logout?scope=global', { method: 'POST', token: restoredSession.access_token });
  await context.close();

  // Test the real confirmation UI with a server-generated signup token, without mail.
  const signupEmail = `confirm-${randomBytes(12).toString('hex')}@example.invalid`;
  const generated = await request('/auth/v1/admin/generate_link', { adminRequest: true, method: 'POST',
    body: { type: 'signup', email: signupEmail, password: randomBytes(32).toString('base64url') } });
  created.push(generated.user.id);
  ({ context, violations } = await newContext());
  page = await context.newPage();
  await page.goto(site + '/auth-confirmed?token_hash=' + encodeURIComponent(generated.hashed_token), { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('heading', { name: /邮箱验证成功|Email confirmed/ }).waitFor({ timeout: 30000 });
  check(violations.length === 0, 'Confirmation attempted production redirect');
  pass('valid_signup_confirmation_ui');
  await context.close();
  ({ context, violations } = await newContext());
  page = await context.newPage();
  await page.goto(site + '/auth-confirmed?token_hash=invalid-recovery-test', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('heading', { name: /验证链接无效或已过期|invalid or expired/ }).waitFor({ timeout: 30000 });
  pass('invalid_confirmation_ui');
  await context.close();
  const report = { status: 'browser_recovery_validation_passed', site, checks: results,
    original_password_login: 'not-tested-original-password-not-provided', real_email: 'pending-receipt-and-click',
    production_modified: false, screenshots_or_traces_saved: false };
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '```json\n' + JSON.stringify(report, null, 2) + '\n```\n');
} catch {
  console.error('Browser recovery validation failed; sensitive details suppressed. Last passed check count: ' + results.length);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const id of created) {
    try { await request('/auth/v1/admin/users/' + id, { method: 'DELETE', adminRequest: true }); }
    catch { console.error('Disposable browser-account cleanup failed; details suppressed.'); process.exitCode = 1; }
  }
}
